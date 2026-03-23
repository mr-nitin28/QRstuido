export type QrMode = "static" | "dynamic";

export interface QrCustomization {
  foreground: string;
  background: string;
  size: number;
  margin: number;
  padding: number;
  logoDataUrl: string | null;
}

export interface ScanEvent {
  id: string;
  deviceType: string;
  userAgent: string | null;
  ipHash: string | null;
  country: string | null;
  city: string | null;
  referrer: string | null;
  scannedAt: string;
}

export interface AnalyticsBucket {
  label: string;
  count: number;
}

export interface AnalyticsSummary {
  totalScans: number;
  devices: AnalyticsBucket[];
  locations: AnalyticsBucket[];
  recent: ScanEvent[];
}

export interface QrRecord {
  id: string;
  slug: string | null;
  title: string;
  mode: QrMode;
  destinationUrl: string;
  customization: QrCustomization;
  createdAt: string;
  updatedAt: string;
  lastScannedAt: string | null;
  scans: ScanEvent[];
}

export interface QrRecordResponse extends QrRecord {
  redirectUrl: string;
  shareUrl: string | null;
  analytics: AnalyticsSummary;
}

export interface UpsertQrPayload {
  title?: string;
  mode: QrMode;
  destinationUrl: string;
  customization: QrCustomization;
}

export interface UrlAnalysis {
  rawInput: string;
  normalizedUrl: string | null;
  isValid: boolean;
  isBlocked: boolean;
  severity: "neutral" | "safe" | "warning" | "danger";
  messages: string[];
  label: string;
}

