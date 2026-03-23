import type { QrCustomization } from "@/lib/qr/types";

export const DEFAULT_CUSTOMIZATION: QrCustomization = {
  foreground: "#101828",
  background: "#FDF6EC",
  size: 320,
  margin: 2,
  padding: 6,
  logoDataUrl: null
};

export const SIZE_PRESETS = [
  { label: "Small", value: 240 },
  { label: "Medium", value: 320 },
  { label: "Large", value: 420 },
  { label: "Poster", value: 640 }
];
