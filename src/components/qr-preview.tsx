"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Download, ImageDown, LoaderCircle } from "lucide-react";
import { cn, fileSafeName } from "@/lib/utils";
import type { QrCustomization } from "@/lib/qr/types";

type RawExtension = "png" | "svg";

interface QrPreviewProps {
  value: string;
  title: string;
  customization: QrCustomization;
  isReady: boolean;
  muted?: boolean;
}

export interface QrPreviewHandle {
  download: (extension: RawExtension) => Promise<void>;
  downloadPdf: () => Promise<void>;
  copyImage: () => Promise<void>;
}

type QrInstance = {
  append: (node: HTMLElement) => void;
  update: (options: Record<string, unknown>) => void;
  getRawData: (extension: RawExtension) => Promise<Blob | ArrayBuffer | ArrayBufferView | null>;
};

function createObjectUrl(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read QR image."));
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(blob);
  });
}

function toSafeArrayBuffer(raw: ArrayBuffer | ArrayBufferView) {
  const source =
    raw instanceof ArrayBuffer
      ? new Uint8Array(raw)
      : new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  const copy = new Uint8Array(source.byteLength);
  copy.set(source);
  return copy.buffer;
}

export const QrPreview = forwardRef<QrPreviewHandle, QrPreviewProps>(function QrPreview(
  { value, title, customization, isReady, muted = false },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<QrInstance | null>(null);
  const [libraryLoaded, setLibraryLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const { default: QRCodeStyling } = await import("qr-code-styling");

      if (cancelled || !containerRef.current) {
        return;
      }

      const instance = new QRCodeStyling({
        width: 320,
        height: 320,
        data: "https://example.com",
        margin: 2,
        dotsOptions: {
          color: "#101828",
          type: "rounded"
        },
        cornersSquareOptions: {
          color: "#101828",
          type: "extra-rounded"
        },
        backgroundOptions: {
          color: "#FDF6EC"
        },
        qrOptions: {
          errorCorrectionLevel: "Q"
        }
      }) as QrInstance;

      containerRef.current.innerHTML = "";
      instance.append(containerRef.current);
      instanceRef.current = instance;
      setLibraryLoaded(true);
    }

    void boot();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!instanceRef.current) {
      return;
    }

    instanceRef.current.update({
      width: customization.size,
      height: customization.size,
      data: value || "https://example.com",
      margin: customization.margin,
      image: customization.logoDataUrl ?? undefined,
      imageOptions: {
        margin: customization.padding,
        imageSize: 0.28,
        hideBackgroundDots: false
      },
      dotsOptions: {
        color: customization.foreground,
        type: "rounded"
      },
      cornersSquareOptions: {
        color: customization.foreground,
        type: "extra-rounded"
      },
      backgroundOptions: {
        color: customization.background
      },
      qrOptions: {
        errorCorrectionLevel: customization.logoDataUrl ? "H" : "Q"
      }
    });
  }, [customization, value]);

  useImperativeHandle(
    ref,
    () => ({
      async download(extension) {
        const blob = await getBlob(extension);
        createObjectUrl(blob, `${fileSafeName(title)}.${extension}`);
      },

      async downloadPdf() {
        const blob = await getBlob("png");
        const { jsPDF } = await import("jspdf");
        const imageDataUrl = await blobToDataUrl(blob);
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "pt",
          format: [customization.size + 80, customization.size + 80]
        });

        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, customization.size + 80, customization.size + 80, "F");
        pdf.addImage(imageDataUrl, "PNG", 40, 40, customization.size, customization.size);
        pdf.save(`${fileSafeName(title)}.pdf`);
      },

      async copyImage() {
        const blob = await getBlob("png");

        if (!("ClipboardItem" in window)) {
          throw new Error("Clipboard image copy is not supported in this browser.");
        }

        await navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob
          })
        ]);
      }
    }),
    [customization.size, title]
  );

  async function getBlob(extension: RawExtension) {
    if (!instanceRef.current) {
      throw new Error("QR preview is still loading.");
    }

    const raw = await instanceRef.current.getRawData(extension);

    if (!raw) {
      throw new Error("Unable to export QR code.");
    }

    if (raw instanceof Blob) {
      return raw;
    }

    if (raw instanceof ArrayBuffer) {
      return new Blob([toSafeArrayBuffer(raw)], {
        type: extension === "svg" ? "image/svg+xml" : "image/png"
      });
    }

    if (ArrayBuffer.isView(raw)) {
      return new Blob([toSafeArrayBuffer(raw)], {
        type: extension === "svg" ? "image/svg+xml" : "image/png"
      });
    }

    throw new Error("Unsupported QR export payload.");
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[28px] border border-border/80 bg-white/85 p-4 transition duration-300 dark:bg-slate-950/80",
        muted && "opacity-70 saturate-75"
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.26),transparent_55%)]" />
      <div className="relative flex min-h-[360px] items-center justify-center rounded-[24px] bg-[linear-gradient(145deg,rgba(255,255,255,0.92),rgba(249,241,230,0.92))] p-6 dark:bg-[linear-gradient(145deg,rgba(15,23,42,0.98),rgba(30,41,59,0.92))]">
        {!libraryLoaded ? (
          <div className="flex items-center gap-2 text-sm text-ink/60">
            <LoaderCircle className="size-4 animate-spin" />
            Preparing renderer
          </div>
        ) : null}

        <div
          ref={containerRef}
          className={cn(
            "transition duration-300",
            libraryLoaded ? "scale-100 opacity-100" : "scale-95 opacity-0"
          )}
        />

        {!isReady ? (
          <div className="absolute inset-x-6 bottom-6 rounded-2xl border border-border/80 bg-surface/90 px-4 py-3 text-sm text-ink/72 shadow-soft backdrop-blur">
            Add a valid destination to unlock download, copy, and share actions.
          </div>
        ) : null}
      </div>

      <div className="relative mt-4 flex flex-wrap gap-2 text-xs text-ink/64">
        <span className="inline-flex items-center gap-1">
          <Download className="size-3.5" />
          High-DPI PNG, SVG, and PDF exports
        </span>
        <span className="inline-flex items-center gap-1">
          <ImageDown className="size-3.5" />
          Logo-safe error correction
        </span>
      </div>
    </div>
  );
});
