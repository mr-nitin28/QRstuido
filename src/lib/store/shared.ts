import path from "node:path";
import type { QrCustomization, QrRecord, UpsertQrPayload } from "@/lib/qr/types";

export function getStorePath() {
  return path.join(process.cwd(), "data", "qr-store.json");
}

export function normalizeTitle(payload: UpsertQrPayload) {
  if (payload.title?.trim()) {
    return payload.title.trim();
  }

  try {
    return new URL(payload.destinationUrl).hostname.replace(/^www\./, "") || "Untitled QR";
  } catch {
    return "Untitled QR";
  }
}

export function buildCustomization(customization: QrCustomization): QrCustomization {
  return {
    foreground: customization.foreground,
    background: customization.background,
    size: customization.size,
    margin: customization.margin,
    padding: customization.padding,
    logoDataUrl: customization.logoDataUrl
  };
}

export function sortRecords(records: QrRecord[]) {
  return [...records].sort(
    (left, right) => Number(new Date(right.updatedAt)) - Number(new Date(left.updatedAt))
  );
}

