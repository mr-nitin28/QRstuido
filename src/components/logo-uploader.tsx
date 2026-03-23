"use client";

import Image from "next/image";
import { ImagePlus, Trash2 } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface LogoUploaderProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function LogoUploader({ value, onChange }: LogoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (file.size > 256_000) {
      setError("Use a logo under 256 KB for reliable rendering.");
      return;
    }

    setError(null);

    const reader = new FileReader();
    reader.onload = () => {
      onChange(typeof reader.result === "string" ? reader.result : null);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
          <ImagePlus className="size-4" />
          {value ? "Replace Logo" : "Upload Logo"}
        </Button>
        {value ? (
          <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
            <Trash2 className="size-4" />
            Remove
          </Button>
        ) : null}
        <Badge tone="neutral">PNG or SVG</Badge>
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
          <div className="relative size-14 overflow-hidden rounded-xl bg-white">
            <Image alt="Logo preview" src={value} fill className="object-contain p-2" />
          </div>
          <p className="text-sm text-ink/70">
            Center logos render with high error correction. Keep contrast strong to preserve scan reliability.
          </p>
        </div>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}

