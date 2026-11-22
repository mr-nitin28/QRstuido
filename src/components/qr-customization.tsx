"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LogoUploader } from "@/components/logo-uploader";
import { QR_LIMITS, SIZE_PRESETS } from "@/lib/qr/defaults";
import type { QrCustomization } from "@/lib/qr/types";
import { clamp } from "@/lib/utils";

interface Props {
  value: QrCustomization;
  paddingLimit: number;
  onChange: <K extends keyof QrCustomization>(key: K, value: QrCustomization[K]) => void;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const id = `qr-${label.toLowerCase()}`;
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={value.slice(0, 7)} aria-label={`Pick ${label.toLowerCase()} color`}
          onChange={(event) => { setDraft(null); onChange(event.target.value); }}
          className="size-11 shrink-0 cursor-pointer rounded-xl border border-border bg-surface p-1" />
        <Input id={id} value={draft ?? value} spellCheck={false} maxLength={9} className="min-w-0 font-mono"
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next);
            if (/^#(?:[\da-f]{6}|[\da-f]{8})$/i.test(next)) onChange(next);
          }}
          onBlur={() => setDraft(null)} />
      </div>
    </div>
  );
}

function Slider({ label, id, value, min, max, unit, disabled, onChange }: {
  label: string; id: string; value: number; min: number; max: number; unit: string;
  disabled?: boolean; onChange: (value: number) => void;
}) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <label htmlFor={id} className="font-medium">{label}</label>
        <output htmlFor={id} className="tabular-nums text-ink/70">{value} {unit}</output>
      </div>
      <input id={id} type="range" min={min} max={max} value={value} disabled={disabled}
        aria-valuetext={`${value} ${unit}`} onChange={(event) => onChange(event.target.valueAsNumber)}
        className="block h-11 w-full min-w-0 accent-[rgb(var(--accent))] disabled:opacity-45" />
    </div>
  );
}

export function QrCustomizationPanel({ value, paddingLimit, onChange }: Props) {
  const [sizeDraft, setSizeDraft] = useState<string | null>(null);
  const sizePreset = SIZE_PRESETS.find((preset) => preset.value === value.size);
  const hasLogo = Boolean(value.logoDataUrl);
  function changeSize(size: number) {
    setSizeDraft(null);
    onChange("size", size);
  }

  return (
    <section aria-label="QR appearance" className="space-y-5 border-t border-border pt-5">
      <h3 className="font-display text-lg font-semibold">Appearance</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <ColorField label="Foreground" value={value.foreground} onChange={(color) => onChange("foreground", color)} />
        <ColorField label="Background" value={value.background} onChange={(color) => onChange("background", color)} />
      </div>
      <div className="space-y-3 rounded-2xl border border-border bg-surfaceAlt/35 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="qr-size" className="text-sm font-semibold">Output size</label>
          <div className="flex items-center gap-2 text-sm">
            <input id="qr-size" type="number" {...QR_LIMITS.size} step={1} value={sizeDraft ?? value.size}
              inputMode="numeric" className="h-11 w-20 rounded-lg border border-border bg-surface px-2 text-right text-base tabular-nums"
              onChange={(event) => {
                const { value: text, valueAsNumber: number } = event.target;
                setSizeDraft(text);
                if (Number.isInteger(number) && number >= QR_LIMITS.size.min && number <= QR_LIMITS.size.max) onChange("size", number);
              }}
              onBlur={() => changeSize(sizeDraft?.trim() && Number.isFinite(Number(sizeDraft))
                ? clamp(Math.round(Number(sizeDraft)), QR_LIMITS.size.min, QR_LIMITS.size.max) : value.size)} />
            <span>px</span>
          </div>
        </div>
        <input type="range" aria-label="Custom size" aria-valuetext={`${value.size} pixels`}
          {...QR_LIMITS.size} step={1} value={value.size} onChange={(event) => changeSize(event.target.valueAsNumber)}
          className="block h-11 w-full min-w-0 accent-[rgb(var(--accent))]" />
        <div role="group" aria-label="Size presets" className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-4">
          {SIZE_PRESETS.map((preset) => (
            <Button key={preset.value} size="sm" className="!px-1" aria-pressed={preset === sizePreset}
              variant={preset === sizePreset ? "primary" : "secondary"} onClick={() => changeSize(preset.value)}>
              {preset.label}
            </Button>
          ))}
        </div>
        <div className="border-t border-border pt-3">
          <Slider id="qr-margin" label="Outer margin" unit={value.margin === 1 ? "module" : "modules"}
            value={value.margin} {...QR_LIMITS.margin} onChange={(margin) => onChange("margin", margin)} />
        </div>
      </div>
      <div className="space-y-3 rounded-2xl border border-border p-4">
        <h4 className="text-sm font-semibold">Logo</h4>
        <LogoUploader value={value.logoDataUrl} onChange={(logo) => onChange("logoDataUrl", logo)} />
        <Slider id="qr-logo-padding" label="Logo padding" unit="px" min={0} max={hasLogo ? paddingLimit : QR_LIMITS.padding.max}
          value={hasLogo ? Math.min(value.padding, paddingLimit) : value.padding} disabled={!hasLogo || !paddingLimit}
          onChange={(padding) => onChange("padding", padding)} />
      </div>
    </section>
  );
}
