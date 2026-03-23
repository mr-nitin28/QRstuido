import QRCode from "qrcode";

interface GenerateOptions {
  value: string;
  size: number;
  foreground: string;
  background: string;
  margin: number;
}

const qrCache = new Map<string, string>();
const MAX_CACHE_SIZE = 100;

export async function generateQrDataUrl(options: GenerateOptions) {
  const cacheKey = JSON.stringify(options);
  const cached = qrCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const dataUrl = await QRCode.toDataURL(options.value, {
    width: options.size,
    margin: options.margin,
    errorCorrectionLevel: "H",
    color: {
      dark: options.foreground,
      light: options.background
    }
  });

  qrCache.set(cacheKey, dataUrl);

  if (qrCache.size > MAX_CACHE_SIZE) {
    const oldest = qrCache.keys().next().value;

    if (oldest) {
      qrCache.delete(oldest);
    }
  }

  return dataUrl;
}

