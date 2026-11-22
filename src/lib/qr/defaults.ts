import type { QrCustomization } from "@/lib/qr/types";

export const DEFAULT_CUSTOMIZATION: QrCustomization = {
  foreground: "#101828",
  background: "#FFFFFF",
  size: 320,
  margin: 4,
  padding: 6,
  logoDataUrl: null
};

export const QR_LIMITS = {
  size: { min: 180, max: 1400 },
  margin: { min: 0, max: 12 },
  padding: { min: 0, max: 40 }
} as const;

export const SIZE_PRESETS = [
  { label: "Small", value: 240 },
  { label: "Medium", value: 320 },
  { label: "Large", value: 420 },
  { label: "Poster", value: 640 }
];
