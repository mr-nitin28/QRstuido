import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { createSlug } from "@/lib/qr/slug";
import type { QrRecord, ScanEvent, UpsertQrPayload } from "@/lib/qr/types";
import { buildCustomization, getStorePath, normalizeTitle, sortRecords } from "@/lib/store/shared";
import type { QrRepository } from "@/lib/store/types";

interface FileStoreShape {
  records: QrRecord[];
}

let writeQueue = Promise.resolve<void>(undefined);

async function ensureStore() {
  const storePath = getStorePath();
  await mkdir(dirname(storePath), { recursive: true });

  try {
    await readFile(storePath, "utf8");
  } catch {
    const initial: FileStoreShape = { records: [] };
    await writeFile(storePath, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readStore() {
  await ensureStore();
  const content = await readFile(getStorePath(), "utf8");
  return JSON.parse(content) as FileStoreShape;
}

async function writeStore(next: FileStoreShape) {
  await writeFile(getStorePath(), JSON.stringify(next, null, 2), "utf8");
}

async function mutateStore<T>(mutator: (store: FileStoreShape) => Promise<T>) {
  let result!: T;

  writeQueue = writeQueue.then(async () => {
    const store = await readStore();
    result = await mutator(store);
    await writeStore(store);
  });

  await writeQueue;
  return result;
}

function createRecord(payload: UpsertQrPayload): QrRecord {
  const now = new Date().toISOString();

  return {
    id: randomUUID(),
    slug: payload.mode === "dynamic" ? createSlug() : null,
    title: normalizeTitle(payload),
    mode: payload.mode,
    destinationUrl: payload.destinationUrl,
    customization: buildCustomization(payload.customization),
    createdAt: now,
    updatedAt: now,
    lastScannedAt: null,
    scans: []
  };
}

export const fileRepository: QrRepository = {
  async list() {
    const store = await readStore();
    return sortRecords(store.records);
  },

  async getById(id) {
    const store = await readStore();
    return store.records.find((record) => record.id === id) ?? null;
  },

  async getBySlug(slug) {
    const store = await readStore();
    return store.records.find((record) => record.slug === slug) ?? null;
  },

  async create(payload) {
    return mutateStore(async (store) => {
      const record = createRecord(payload);
      store.records.unshift(record);
      return record;
    });
  },

  async update(id, payload) {
    return mutateStore(async (store) => {
      const record = store.records.find((item) => item.id === id);

      if (!record) {
        return null;
      }

      record.title = normalizeTitle(payload);
      record.mode = payload.mode;
      record.destinationUrl = payload.destinationUrl;
      record.customization = buildCustomization(payload.customization);
      record.updatedAt = new Date().toISOString();

      if (payload.mode === "dynamic" && !record.slug) {
        record.slug = createSlug();
      }

      if (payload.mode === "static") {
        record.slug = null;
      }

      return record;
    });
  },

  async logScan(id, input) {
    return mutateStore(async (store) => {
      const record = store.records.find((item) => item.id === id);

      if (!record) {
        return null;
      }

      const scan: ScanEvent = {
        id: randomUUID(),
        deviceType: input.deviceType,
        userAgent: input.userAgent,
        ipHash: input.ipHash,
        country: input.country,
        city: input.city,
        referrer: input.referrer,
        scannedAt: new Date().toISOString()
      };

      record.scans.unshift(scan);
      record.lastScannedAt = scan.scannedAt;
      record.updatedAt = scan.scannedAt;

      return scan;
    });
  }
};
