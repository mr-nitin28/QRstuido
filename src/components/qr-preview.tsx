"use client";

import { forwardRef, useImperativeHandle, useMemo } from "react";
import Image from "next/image";
import { QrCode } from "lucide-react";
import { fileSafeName } from "@/lib/utils";
import { renderQrSvg, type QrSymbol } from "@/lib/qr/artwork";
import type { QrCustomization } from "@/lib/qr/types";

interface QrPreviewProps {
  symbol: QrSymbol | null;
  title: string;
  customization: QrCustomization;
  status: string | null;
}

export interface QrPreviewHandle {
  download: (extension: "png" | "svg") => Promise<void>;
  downloadPdf: () => Promise<void>;
  copyImage: () => Promise<void>;
}

async function rasterize(src: string, size: number) {
  const image = new window.Image();
  image.src = src;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image export is unavailable in this browser.");
  context.drawImage(image, 0, 0, size, size);
  return canvas;
}

function pngBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Unable to create PNG.")), "image/png")
  );
}

export const QrPreview = forwardRef<QrPreviewHandle, QrPreviewProps>(function QrPreview(
  { symbol, title, customization, status }, ref
) {
  const svg = useMemo(() => symbol ? renderQrSvg(symbol, customization) : "", [symbol, customization]);
  const src = useMemo(() => svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : "", [svg]);
  const { size, margin } = customization;
  useImperativeHandle(ref, () => ({
    async download(extension) {
      const blob = extension === "svg"
        ? new Blob([svg], { type: "image/svg+xml" })
        : await pngBlob(await rasterize(src, size));
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileSafeName(title)}.${extension}`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    async downloadPdf() {
      const [{ jsPDF }, canvas] = await Promise.all([import("jspdf"), rasterize(src, size)]);
      const points = size * 72 / 96;
      const pdf = new jsPDF({ unit: "pt", format: [points, points] });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, points, points);
      pdf.save(`${fileSafeName(title)}.pdf`);
    },
    async copyImage() {
      if (!window.ClipboardItem || !navigator.clipboard?.write) {
        throw new Error("Image copy is unavailable in this browser. Download a PNG instead.");
      }
      await navigator.clipboard.write([new ClipboardItem({ "image/png": rasterize(src, size).then(pngBlob) })]);
    }
  }), [size, src, svg, title]);

  return (
    <figure className="min-w-0 rounded-2xl border border-border bg-surfaceAlt/45 p-3 sm:p-4">
      <div className="flex justify-center rounded-xl bg-surface p-2 sm:p-4">
        <div className="flex aspect-square w-full min-w-0 max-w-[clamp(180px,60svh,360px)] items-center justify-center">
          {src ? (
            <Image src={src} unoptimized width={size} height={size}
              alt={status ? "Sample QR code" : `QR code for ${title}`}
              className="block h-auto max-w-full" style={{ width: size }} />
          ) : <QrCode aria-hidden="true" className="size-16 text-ink/35" />}
        </div>
      </div>
      <figcaption className="pt-3 text-sm text-ink/75">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="font-semibold text-ink">{size} × {size} px</span>
          <span>Margin · {margin} {margin === 1 ? "module" : "modules"}</span>
        </div>
        {status && <p role="status" className="mt-2 border-t border-border pt-2">{status}</p>}
      </figcaption>
    </figure>
  );
});
