"use client";

import Image from "next/image";
import { ImagePlus, Trash2 } from "lucide-react";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface LogoUploaderProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

async function readLogo(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject();
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function LogoUploader({ value, onChange }: LogoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const revision = useRef(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => () => { revision.current++; }, []);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const selection = ++revision.current;
    if (!["image/png", "image/svg+xml", "image/webp"].includes(file.type)) {
      setError("Choose a PNG, SVG, or WebP image.");
      return;
    }
    if (file.size > 256_000) {
      setError("Use a logo under 256 KB for reliable rendering.");
      return;
    }

    setError(null);

    try {
      let source = await readLogo(file);
      const image = new window.Image();
      image.src = source;
      await image.decode();
      if (file.type === "image/svg+xml") {
        const svg = new DOMParser().parseFromString(await file.text(), "image/svg+xml").documentElement;
        if (svg.localName !== "svg") throw new Error("Invalid SVG");
        // A viewBox preserves the original coordinates in square SVG image slots.
        if (!svg.hasAttribute("viewBox")) {
          svg.setAttribute("viewBox", `0 0 ${image.naturalWidth} ${image.naturalHeight}`);
          source = await readLogo(new Blob([new XMLSerializer().serializeToString(svg)], { type: file.type }));
        }
      }
      if (selection === revision.current) onChange(source);
    } catch {
      if (selection === revision.current) setError("This image could not be read. Choose another logo.");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
          <ImagePlus className="size-4" />
          {value ? "Replace Logo" : "Upload Logo"}
        </Button>
        {value ? (
          <Button variant="ghost" size="sm" onClick={() => { revision.current++; setError(null); onChange(null); }}>
            <Trash2 className="size-4" />
            Remove
          </Button>
        ) : null}
        <span className="text-xs text-ink/70">PNG, SVG or WebP · Up to 256 KB</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/svg+xml,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {value ? (
        <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-surfaceAlt/60 p-3">
          <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-white">
            <Image alt="Uploaded logo" src={value} fill unoptimized sizes="56px" className="object-contain p-2" />
          </div>
          <p className="text-sm text-ink/70">
            Padding is limited to keep your logo visible at this output size.
          </p>
        </div>
      ) : null}

      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}

