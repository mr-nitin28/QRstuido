import QRCode, { type BitMatrix } from "qrcode";
import { QR_LIMITS } from "./defaults";
import type { QrCustomization } from "./types";

interface LogoBox {
  x: number;
  y: number;
  side: number;
}

// Find the nearest clear square to the center. Dense codes can have an
// alignment marker in the very middle, which must survive the logo cutout.
function findLogoBox(matrix: BitMatrix): LogoBox {
  const n = matrix.size;
  const limit = Math.max(3, Math.floor(n * 0.22));
  const clear = new Uint16Array(n + 1);
  let best = { x: 0, y: 0, side: 0 };
  let distance = Infinity;
  for (let y = 0; y < n; y++) {
    let diagonal = 0;
    for (let x = 0; x < n; x++) {
      const above = clear[x + 1];
      const side = matrix.isReserved(y, x) ? 0 : Math.min(above, clear[x], diagonal, limit - 1) + 1;
      clear[x + 1] = side;
      diagonal = above;
      const dx = x + 1 - side / 2 - n / 2;
      const dy = y + 1 - side / 2 - n / 2;
      const score = dx * dx + dy * dy;
      if (side > best.side || (side === best.side && score < distance)) {
        best = { x: x + 1 - side, y: y + 1 - side, side };
        distance = score;
      }
    }
  }
  return best;
}

export function buildSymbol(value: string, branded: boolean) {
  const { modules } = QRCode.create(value, { errorCorrectionLevel: branded ? "H" : "Q" });
  const n = modules.size;
  const logoBox = branded ? findLogoBox(modules) : null;
  function isDot(x: number, y: number) {
    if (x >= n || y >= n || !modules.get(y, x)) return false;
    if ((x < 7 && (y < 7 || y >= n - 7)) || (x >= n - 7 && y < 7)) return false;
    return !logoBox || x < logoBox.x || y < logoBox.y ||
      x >= logoBox.x + logoBox.side || y >= logoBox.y + logoBox.side;
  }

  // Round-ended runs join adjacent cells in both directions.
  const runs: string[] = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!isDot(x, y)) continue;
      if (x === 0 || !isDot(x - 1, y)) {
        let end = x + 1;
        while (isDot(end, y)) end++;
        runs.push(`M${x + 0.5} ${y + 0.5}h${end - x - 1 || 0.001}`);
      }
      if ((y === 0 || !isDot(x, y - 1)) && isDot(x, y + 1)) {
        let end = y + 2;
        while (isDot(x, end)) end++;
        runs.push(`M${x + 0.5} ${y + 0.5}v${end - y - 1}`);
      }
    }
  }
  return { count: n, path: runs.join(""), logoBox };
}

export type QrSymbol = ReturnType<typeof buildSymbol>;

export function maxLogoPadding(symbol: QrSymbol, { size, margin }: QrCustomization) {
  const boxPixels = (symbol.logoBox?.side ?? 0) * size / (symbol.count + 2 * margin);
  return Math.min(QR_LIMITS.padding.max, Math.floor(boxPixels / 4));
}

function xmlAttribute(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function renderQrSvg(symbol: QrSymbol, settings: QrCustomization) {
  const { size, margin, foreground, background, logoDataUrl } = settings;
  const { count, path, logoBox } = symbol;
  const extent = count + 2 * margin;
  const modulePixels = size / extent;
  const ink = xmlAttribute(foreground);
  const finders = [[0, 0], [count - 7, 0], [0, count - 7]].map(([x, y]) =>
    `<g transform="translate(${x} ${y})"><rect x=".5" y=".5" width="6" height="6" rx="1.7" fill="none" stroke="${ink}"/><rect x="2" y="2" width="3" height="3" rx=".6" fill="${ink}"/></g>`
  ).join("");
  let logo = "";
  if (logoBox && logoDataUrl?.startsWith("data:image/")) {
    const inset = Math.min(settings.padding, maxLogoPadding(symbol, settings));
    const side = logoBox.side * modulePixels - 2 * inset;
    const x = (margin + logoBox.x) * modulePixels + inset;
    const y = (margin + logoBox.y) * modulePixels + inset;
    logo = `<image x="${x}" y="${y}" width="${side}" height="${side}" preserveAspectRatio="xMidYMid meet" xlink:href="${xmlAttribute(logoDataUrl)}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="100%" height="100%" fill="${xmlAttribute(background)}"/><g transform="scale(${modulePixels}) translate(${margin} ${margin})"><path d="${path}" fill="none" stroke="${ink}" stroke-linecap="round"/>${finders}</g>${logo}</svg>`;
}
