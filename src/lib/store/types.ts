import type { QrRecord, ScanEvent, UpsertQrPayload } from "@/lib/qr/types";

export interface ScanLogInput {
  deviceType: string;
  userAgent: string | null;
  ipHash: string | null;
  country: string | null;
  city: string | null;
  referrer: string | null;
}

export interface QrRepository {
  list(): Promise<QrRecord[]>;
  getById(id: string): Promise<QrRecord | null>;
  getBySlug(slug: string): Promise<QrRecord | null>;
  create(payload: UpsertQrPayload): Promise<QrRecord>;
  update(id: string, payload: UpsertQrPayload): Promise<QrRecord | null>;
  delete(id: string): Promise<void>;
  logScan(id: string, input: ScanLogInput): Promise<ScanEvent | null>;
}

