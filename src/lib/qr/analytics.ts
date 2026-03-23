import type {
  AnalyticsBucket,
  AnalyticsSummary,
  QrRecord,
  QrRecordResponse,
  ScanEvent
} from "@/lib/qr/types";

function summarize(values: string[], fallback: string) {
  const counts = new Map<string, number>();

  for (const value of values) {
    const key = value || fallback;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

export function buildAnalytics(scans: ScanEvent[]): AnalyticsSummary {
  const recent = [...scans]
    .sort((left, right) => Number(new Date(right.scannedAt)) - Number(new Date(left.scannedAt)))
    .slice(0, 8);

  const devices = summarize(
    scans.map((scan) => scan.deviceType),
    "Unknown"
  );

  const locations = summarize(
    scans.map((scan) => [scan.city, scan.country].filter(Boolean).join(", ")),
    "Unknown"
  );

  return {
    totalScans: scans.length,
    devices: devices.slice(0, 4),
    locations: locations.slice(0, 4),
    recent
  };
}

export function toRecordResponse(record: QrRecord, origin: string): QrRecordResponse {
  const redirectUrl = record.mode === "dynamic" && record.slug ? `${origin}/q/${record.slug}` : record.destinationUrl;
  const shareUrl = record.slug ? `${origin}/share/${record.slug}` : null;

  return {
    ...record,
    redirectUrl,
    shareUrl,
    analytics: buildAnalytics(record.scans)
  };
}

export function topBucketLabel(buckets: AnalyticsBucket[]) {
  return buckets[0]?.label ?? "Unknown";
}

