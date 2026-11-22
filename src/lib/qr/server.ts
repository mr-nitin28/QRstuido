import sharp from "sharp";
import { buildSymbol, renderQrSvg } from "./artwork";
import type { QrCustomization } from "./types";

const qrCache = new Map<string, string>();
const MAX_CACHE_SIZE = 100;

export async function generateQrDataUrl(value: string, customization: QrCustomization) {
  const cacheKey = JSON.stringify([value, customization]);
  const cached = qrCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const symbol = buildSymbol(value, Boolean(customization.logoDataUrl));
  let logoDataUrl = customization.logoDataUrl;
  if (logoDataUrl && symbol.logoBox) {
    // Decode the original format before embedding. SVG rasterizers differ
    // in their support for WebP and intrinsic sizing of nested SVG images.
    const comma = logoDataUrl.indexOf(",");
    const header = logoDataUrl.slice(0, comma);
    const content = logoDataUrl.slice(comma + 1);
    const bytes = header.endsWith(";base64")
      ? Buffer.from(content, "base64")
      : Buffer.from(decodeURIComponent(content));
    const side = Math.ceil(symbol.logoBox.side * customization.size / (symbol.count + 2 * customization.margin));
    const logo = await sharp(bytes, { limitInputPixels: 32_000_000 })
      .resize(side, side, { fit: "inside" }).png().toBuffer();
    logoDataUrl = `data:image/png;base64,${logo.toString("base64")}`;
  }
  const svg = renderQrSvg(symbol, { ...customization, logoDataUrl });
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const dataUrl = `data:image/png;base64,${png.toString("base64")}`;

  qrCache.set(cacheKey, dataUrl);

  if (qrCache.size > MAX_CACHE_SIZE) {
    const oldest = qrCache.keys().next().value;

    if (oldest) {
      qrCache.delete(oldest);
    }
  }

  return dataUrl;
}

