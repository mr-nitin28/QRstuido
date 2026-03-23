import { PrismaClient, QrCodeMode } from "@prisma/client";
import { createSlug } from "@/lib/qr/slug";
import type { QrCustomization, QrRecord, ScanEvent, UpsertQrPayload } from "@/lib/qr/types";
import { buildCustomization, normalizeTitle, sortRecords } from "@/lib/store/shared";
import type { QrRepository } from "@/lib/store/types";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

function toCustomization(record: {
  foreground: string;
  background: string;
  size: number;
  margin: number;
  padding: number;
  logoDataUrl: string | null;
}): QrCustomization {
  return {
    foreground: record.foreground,
    background: record.background,
    size: record.size,
    margin: record.margin,
    padding: record.padding,
    logoDataUrl: record.logoDataUrl
  };
}

function toScan(scan: {
  id: string;
  deviceType: string | null;
  userAgent: string | null;
  ipHash: string | null;
  country: string | null;
  city: string | null;
  referrer: string | null;
  scannedAt: Date;
}): ScanEvent {
  return {
    id: scan.id,
    deviceType: scan.deviceType ?? "unknown",
    userAgent: scan.userAgent,
    ipHash: scan.ipHash,
    country: scan.country,
    city: scan.city,
    referrer: scan.referrer,
    scannedAt: scan.scannedAt.toISOString()
  };
}

function toRecord(record: {
  id: string;
  slug: string | null;
  title: string | null;
  mode: QrCodeMode;
  destinationUrl: string;
  foreground: string;
  background: string;
  size: number;
  margin: number;
  padding: number;
  logoDataUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastScannedAt: Date | null;
  scans: Array<{
    id: string;
    deviceType: string | null;
    userAgent: string | null;
    ipHash: string | null;
    country: string | null;
    city: string | null;
    referrer: string | null;
    scannedAt: Date;
  }>;
}): QrRecord {
  return {
    id: record.id,
    slug: record.slug,
    title: record.title ?? "Untitled QR",
    mode: record.mode === "DYNAMIC" ? "dynamic" : "static",
    destinationUrl: record.destinationUrl,
    customization: toCustomization(record),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    lastScannedAt: record.lastScannedAt?.toISOString() ?? null,
    scans: record.scans.map(toScan)
  };
}

function mapPayload(payload: UpsertQrPayload) {
  const customization = buildCustomization(payload.customization);

  return {
    title: normalizeTitle(payload),
    mode: payload.mode === "dynamic" ? QrCodeMode.DYNAMIC : QrCodeMode.STATIC,
    destinationUrl: payload.destinationUrl,
    foreground: customization.foreground,
    background: customization.background,
    size: customization.size,
    margin: customization.margin,
    padding: customization.padding,
    logoDataUrl: customization.logoDataUrl
  };
}

const include = {
  scans: {
    orderBy: {
      scannedAt: "desc"
    }
  }
} as const;

export const prismaRepository: QrRepository = {
  async list() {
    const records = await prisma.qrCode.findMany({
      include,
      orderBy: {
        updatedAt: "desc"
      }
    });

    return sortRecords(records.map(toRecord));
  },

  async getById(id) {
    const record = await prisma.qrCode.findUnique({
      where: { id },
      include
    });

    return record ? toRecord(record) : null;
  },

  async getBySlug(slug) {
    const record = await prisma.qrCode.findUnique({
      where: { slug },
      include
    });

    return record ? toRecord(record) : null;
  },

  async create(payload) {
    const record = await prisma.qrCode.create({
      data: {
        ...mapPayload(payload),
        slug: payload.mode === "dynamic" ? createSlug() : null
      },
      include
    });

    return toRecord(record);
  },

  async update(id, payload) {
    const existing = await prisma.qrCode.findUnique({
      where: { id },
      select: {
        slug: true
      }
    });

    if (!existing) {
      return null;
    }

    const record = await prisma.qrCode.update({
      where: { id },
      data: {
        ...mapPayload(payload),
        slug:
          payload.mode === "dynamic"
            ? existing.slug ?? createSlug()
            : null
      },
      include
    });

    return toRecord(record);
  },

  async logScan(id, input) {
    const scan = await prisma.scanEvent.create({
      data: {
        qrCodeId: id,
        deviceType: input.deviceType,
        userAgent: input.userAgent,
        ipHash: input.ipHash,
        country: input.country,
        city: input.city,
        referrer: input.referrer
      }
    });

    await prisma.qrCode.update({
      where: { id },
      data: {
        lastScannedAt: scan.scannedAt
      }
    });

    return toScan(scan);
  }
};
