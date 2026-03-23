"use client";

import dynamic from "next/dynamic";
import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  Link2,
  LoaderCircle,
  QrCode,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { LogoUploader } from "@/components/logo-uploader";
import { QrPreview, type QrPreviewHandle } from "@/components/qr-preview";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { DEFAULT_CUSTOMIZATION, SIZE_PRESETS } from "@/lib/qr/defaults";
import type { QrCustomization, QrMode, QrRecordResponse, UpsertQrPayload } from "@/lib/qr/types";
import { analyzeUrl } from "@/lib/qr/url-safety";
import { clamp, cn, formatCompactNumber } from "@/lib/utils";

const LazyHistoryPanel = dynamic(
  () => import("@/components/history-panel").then((module) => module.HistoryPanel),
  {
    ssr: false,
    loading: () => (
      <Card className="min-h-[360px] animate-pulse bg-surfaceAlt/40">
        <div className="h-10 w-56 rounded-full bg-surfaceAlt" />
      </Card>
    )
  }
);

type NoticeTone = "neutral" | "success" | "warning" | "danger";

interface Notice {
  tone: NoticeTone;
  text: string;
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  const data = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? "Request failed");
  }

  return data;
}

async function fetchHistoryData() {
  const data = await requestJson<{ records: QrRecordResponse[] }>("/api/history", {
    cache: "no-store"
  });

  return data.records;
}

async function upsertRecord(payload: UpsertQrPayload, id?: string) {
  const data = await requestJson<{ record: QrRecordResponse }>(
    id ? `/api/codes/${id}` : "/api/codes",
    {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(payload)
    }
  );

  return data.record;
}

function SyncStatus({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  if (state === "idle") {
    return <Badge tone="neutral">Static mode</Badge>;
  }

  if (state === "saving") {
    return (
      <Badge tone="warning" className="gap-1">
        <LoaderCircle className="size-3 animate-spin" />
        Syncing dynamic link
      </Badge>
    );
  }

  if (state === "saved") {
    return (
      <Badge tone="success" className="gap-1">
        <CheckCircle2 className="size-3" />
        Dynamic link ready
      </Badge>
    );
  }

  return (
    <Badge tone="danger" className="gap-1">
      <AlertTriangle className="size-3" />
      Dynamic sync failed
    </Badge>
  );
}

export function DashboardShell() {
  const [mode, setMode] = useState<QrMode>("static");
  const [title, setTitle] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [customization, setCustomization] = useState<QrCustomization>(DEFAULT_CUSTOMIZATION);
  const [history, setHistory] = useState<QrRecordResponse[]>([]);
  const [currentRecord, setCurrentRecord] = useState<QrRecordResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [dynamicState, setDynamicState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [notice, setNotice] = useState<Notice | null>(null);
  const previewRef = useRef<QrPreviewHandle>(null);
  const dynamicSignatureRef = useRef("");
  const isOnline = useOnlineStatus();
  const deferredUrl = useDeferredValue(urlInput);
  const analysis = analyzeUrl(deferredUrl);
  const debouncedDynamicPayload = useDebouncedValue(
    {
      title: title.trim(),
      mode,
      destinationUrl: analysis.normalizedUrl,
      customization
    },
    700
  );

  const previewUrl =
    mode === "dynamic"
      ? currentRecord?.redirectUrl ?? analysis.normalizedUrl ?? ""
      : analysis.normalizedUrl ?? "";

  const canPreview =
    mode === "dynamic"
      ? Boolean(currentRecord?.redirectUrl || (analysis.isValid && !analysis.isBlocked))
      : Boolean(analysis.normalizedUrl && analysis.isValid && !analysis.isBlocked);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      if (!isOnline) {
        setHistoryLoading(false);
        return;
      }

      try {
        const records = await fetchHistoryData();

        if (!cancelled) {
          startTransition(() => setHistory(records));
        }
      } catch {
        if (!cancelled) {
          setNotice({
            tone: "warning",
            text: "History is unavailable right now. Core QR generation still works locally."
          });
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [isOnline]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (mode !== "dynamic") {
      setDynamicState("idle");
      return;
    }

    if (!isOnline) {
      setDynamicState("error");
      return;
    }

    if (!debouncedDynamicPayload.destinationUrl || !analysis.isValid || analysis.isBlocked) {
      return;
    }

    const payload: UpsertQrPayload = {
      title: debouncedDynamicPayload.title,
      mode: "dynamic",
      destinationUrl: debouncedDynamicPayload.destinationUrl,
      customization: debouncedDynamicPayload.customization
    };

    const signature = JSON.stringify({
      id: currentRecord?.id ?? "new",
      payload
    });

    if (dynamicSignatureRef.current === signature) {
      return;
    }

    let cancelled = false;

    async function syncDynamicRecord() {
      setDynamicState("saving");

      try {
        const record = await upsertRecord(payload, currentRecord?.id);

        if (cancelled) {
          return;
        }

        dynamicSignatureRef.current = JSON.stringify({
          id: record.id,
          payload
        });
        setCurrentRecord(record);
        setDynamicState("saved");

        try {
          const records = await fetchHistoryData();

          if (!cancelled) {
            startTransition(() => setHistory(records));
          }
        } catch {
          // History refresh is secondary to the live QR flow.
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        dynamicSignatureRef.current = "";
        setDynamicState("error");
        setNotice({
          tone: "danger",
          text: error instanceof Error ? error.message : "Unable to sync dynamic QR code."
        });
      }
    }

    void syncDynamicRecord();

    return () => {
      cancelled = true;
    };
  }, [
    analysis.isBlocked,
    analysis.isValid,
    currentRecord?.id,
    debouncedDynamicPayload,
    isOnline,
    mode
  ]);

  useEffect(() => {
    if (mode === "dynamic") {
      return;
    }

    if (currentRecord?.mode === "dynamic") {
      setCurrentRecord(null);
      dynamicSignatureRef.current = "";
    }
  }, [currentRecord?.mode, mode]);

  function updateCustomization<K extends keyof QrCustomization>(key: K, value: QrCustomization[K]) {
    setCustomization((current) => ({
      ...current,
      [key]: value
    }));
  }

  function applyRecord(record: QrRecordResponse) {
    setCurrentRecord(record);
    setMode(record.mode);
    setTitle(record.title);
    setUrlInput(record.destinationUrl);
    setCustomization(record.customization);
    dynamicSignatureRef.current = JSON.stringify({
      id: record.id,
      payload: {
        title: record.title,
        mode: record.mode,
        destinationUrl: record.destinationUrl,
        customization: record.customization
      }
    });
    setNotice({
      tone: "success",
      text: `Loaded ${record.title} into the editor.`
    });
  }

  async function refreshHistory() {
    if (!isOnline) {
      return;
    }

    setHistoryLoading(true);

    try {
      const records = await fetchHistoryData();
      startTransition(() => setHistory(records));
    } finally {
      setHistoryLoading(false);
    }
  }

  async function saveStatic() {
    if (!analysis.normalizedUrl || !analysis.isValid || analysis.isBlocked) {
      setNotice({
        tone: "danger",
        text: "Fix the destination URL before saving."
      });
      return;
    }

    if (!isOnline) {
      setNotice({
        tone: "warning",
        text: "Offline mode can preview locally, but save/history requires a connection."
      });
      return;
    }

    setBusyAction("save");

    try {
      const record = await upsertRecord(
        {
          title: title.trim(),
          mode: "static",
          destinationUrl: analysis.normalizedUrl,
          customization
        },
        currentRecord?.id
      );

      setCurrentRecord(record);
      dynamicSignatureRef.current = JSON.stringify({
        id: record.id,
        payload: {
          title: record.title,
          mode: record.mode,
          destinationUrl: record.destinationUrl,
          customization: record.customization
        }
      });

      await refreshHistory();
      setNotice({
        tone: "success",
        text: "Static QR code saved to history."
      });
    } catch (error) {
      setNotice({
        tone: "danger",
        text: error instanceof Error ? error.message : "Unable to save QR code."
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function withPreviewAction(action: string, run: () => Promise<void>) {
    if (!canPreview || !previewRef.current) {
      setNotice({
        tone: "danger",
        text: "Add a valid destination before exporting."
      });
      return;
    }

    setBusyAction(action);

    try {
      await run();
      setNotice({
        tone: "success",
        text: "Action completed."
      });
    } catch (error) {
      setNotice({
        tone: "danger",
        text: error instanceof Error ? error.message : "Action failed."
      });
    } finally {
      setBusyAction(null);
    }
  }

  const sizeLabel = SIZE_PRESETS.find((preset) => preset.value === customization.size)?.label ?? "Custom";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="animate-reveal rounded-[32px] border border-border/80 bg-surface/75 p-5 shadow-soft backdrop-blur-sm sm:p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="success">Fast, safe, printable</Badge>
              <Badge tone="neutral">{formatCompactNumber(history.length)} saved codes</Badge>
              <Badge tone={isOnline ? "success" : "warning"}>
                {isOnline ? "Online sync enabled" : "Offline local mode"}
              </Badge>
            </div>
            <div className="space-y-3">
              <h1 className="font-display text-4xl font-semibold tracking-[-0.04em] text-ink sm:text-5xl">
                Generate polished QR codes for URLs, app links, and dynamic campaigns.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-ink/72 sm:text-lg">
                QR Studio combines live generation, brand customization, downloadable print assets, dynamic redirects,
                and built-in scan analytics in one responsive workspace.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <ThemeToggle />
            <div className="rounded-full border border-border/80 bg-surfaceAlt/65 px-4 py-2 text-sm text-ink/68">
              {mode === "dynamic" ? "Editable short link mode" : "Direct destination mode"}
            </div>
          </div>
        </div>

        {notice ? (
          <div
            className={cn(
              "mt-5 rounded-2xl px-4 py-3 text-sm",
              notice.tone === "success" && "bg-success/12 text-success",
              notice.tone === "warning" && "bg-warning/12 text-warning",
              notice.tone === "danger" && "bg-danger/12 text-danger",
              notice.tone === "neutral" && "bg-surfaceAlt/70 text-ink/72"
            )}
          >
            {notice.text}
          </div>
        ) : null}
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="animate-reveal">
          <CardHeader>
            <CardTitle>Configure Destination</CardTitle>
            <CardDescription>
              Static mode points directly to the URL. Dynamic mode issues a short redirect that you can edit later.
            </CardDescription>
          </CardHeader>

          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode("static")}
                className={cn(
                  "rounded-2xl border p-4 text-left transition",
                  mode === "static"
                    ? "border-accent bg-accent/12 shadow-soft"
                    : "border-border bg-surfaceAlt/45 hover:border-accent/40"
                )}
              >
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                  <Link2 className="size-4" />
                  Static QR
                </div>
                <p className="text-sm leading-6 text-ink/66">
                  Best for permanent URLs and instant offline-compatible generation.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode("dynamic")}
                className={cn(
                  "rounded-2xl border p-4 text-left transition",
                  mode === "dynamic"
                    ? "border-accent bg-accent/12 shadow-soft"
                    : "border-border bg-surfaceAlt/45 hover:border-accent/40"
                )}
              >
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                  <Sparkles className="size-4" />
                  Dynamic QR
                </div>
                <p className="text-sm leading-6 text-ink/66">
                  Generates an editable short link with scan logging and share pages.
                </p>
              </button>
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-ink/80">Title</label>
                <Input
                  placeholder="Campaign landing page"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-ink/80">Destination URL</label>
                <Textarea
                  placeholder="https://example.com or myapp://open/deeplink"
                  value={urlInput}
                  onChange={(event) => setUrlInput(event.target.value)}
                />
              </div>

              <div
                className={cn(
                  "rounded-2xl border p-4 text-sm",
                  analysis.severity === "safe" && "border-success/30 bg-success/10 text-success",
                  analysis.severity === "warning" && "border-warning/30 bg-warning/10 text-warning",
                  analysis.severity === "danger" && "border-danger/30 bg-danger/10 text-danger",
                  analysis.severity === "neutral" && "border-border bg-surfaceAlt/50 text-ink/66"
                )}
              >
                <div className="mb-2 flex items-center gap-2 font-semibold">
                  {analysis.severity === "danger" ? (
                    <AlertTriangle className="size-4" />
                  ) : analysis.severity === "safe" ? (
                    <ShieldCheck className="size-4" />
                  ) : (
                    <QrCode className="size-4" />
                  )}
                  {analysis.label}
                </div>
                <div className="space-y-1">
                  {analysis.messages.map((message) => (
                    <p key={message}>{message}</p>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-ink/80">Foreground Color</label>
                  <div className="flex gap-3">
                    <input
                      type="color"
                      value={customization.foreground}
                      onChange={(event) => updateCustomization("foreground", event.target.value)}
                      className="h-12 w-16 cursor-pointer rounded-2xl border border-border bg-transparent p-1"
                    />
                    <Input
                      value={customization.foreground}
                      onChange={(event) => updateCustomization("foreground", event.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-ink/80">Background Color</label>
                  <div className="flex gap-3">
                    <input
                      type="color"
                      value={customization.background}
                      onChange={(event) => updateCustomization("background", event.target.value)}
                      className="h-12 w-16 cursor-pointer rounded-2xl border border-border bg-transparent p-1"
                    />
                    <Input
                      value={customization.background}
                      onChange={(event) => updateCustomization("background", event.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-ink/80">Size Presets</label>
                    <Badge tone="neutral">{sizeLabel}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {SIZE_PRESETS.map((preset) => (
                      <Button
                        key={preset.value}
                        variant={customization.size === preset.value ? "primary" : "secondary"}
                        size="sm"
                        onClick={() => updateCustomization("size", preset.value)}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm font-medium text-ink/80">
                    <span>Custom Size</span>
                    <span>{customization.size}px</span>
                  </div>
                  <input
                    type="range"
                    min={180}
                    max={1400}
                    step={20}
                    value={customization.size}
                    onChange={(event) =>
                      updateCustomization("size", clamp(Number(event.target.value), 180, 1400))
                    }
                    className="w-full accent-[rgb(var(--accent))]"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm font-medium text-ink/80">
                      <span>Margin</span>
                      <span>{customization.margin}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={12}
                      step={1}
                      value={customization.margin}
                      onChange={(event) =>
                        updateCustomization("margin", clamp(Number(event.target.value), 0, 12))
                      }
                      className="w-full accent-[rgb(var(--accent))]"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm font-medium text-ink/80">
                      <span>Logo Padding</span>
                      <span>{customization.padding}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={40}
                      step={1}
                      value={customization.padding}
                      onChange={(event) =>
                        updateCustomization("padding", clamp(Number(event.target.value), 0, 40))
                      }
                      className="w-full accent-[rgb(var(--accent))]"
                    />
                  </div>
                </div>

                <LogoUploader
                  value={customization.logoDataUrl}
                  onChange={(value) => updateCustomization("logoDataUrl", value)}
                />
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="animate-reveal xl:sticky xl:top-6">
            <CardHeader className="flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Live Preview</CardTitle>
                <CardDescription>
                  The preview updates in real time and exports with high print fidelity.
                </CardDescription>
              </div>
              <SyncStatus state={dynamicState} />
            </CardHeader>

            <QrPreview
              ref={previewRef}
              title={title || currentRecord?.title || "qr-code"}
              value={previewUrl}
              customization={customization}
              isReady={canPreview}
              muted={!canPreview}
            />

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Button
                onClick={() =>
                  void withPreviewAction("copy-link", async () => {
                    await navigator.clipboard.writeText(previewUrl);
                  })
                }
                variant="secondary"
              >
                <Copy className="size-4" />
                Copy Link
              </Button>
              <Button
                onClick={() =>
                  void withPreviewAction("copy-image", async () => {
                    await previewRef.current?.copyImage();
                  })
                }
                variant="secondary"
              >
                <Copy className="size-4" />
                Copy QR Image
              </Button>
              <Button
                onClick={() =>
                  void withPreviewAction("png", async () => {
                    await previewRef.current?.download("png");
                  })
                }
              >
                {busyAction === "png" ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                Download PNG
              </Button>
              <Button
                onClick={() =>
                  void withPreviewAction("svg", async () => {
                    await previewRef.current?.download("svg");
                  })
                }
                variant="secondary"
              >
                Download SVG
              </Button>
              <Button
                onClick={() =>
                  void withPreviewAction("pdf", async () => {
                    await previewRef.current?.downloadPdf();
                  })
                }
                variant="secondary"
              >
                Download PDF
              </Button>
              <Button
                onClick={() => void saveStatic()}
                variant={mode === "dynamic" ? "ghost" : "primary"}
                disabled={busyAction === "save"}
              >
                {busyAction === "save" ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {mode === "dynamic" ? "Save Current Snapshot" : "Save to History"}
              </Button>
            </div>

            {mode === "dynamic" && currentRecord?.shareUrl ? (
              <div className="mt-5 rounded-2xl border border-border/80 bg-surfaceAlt/55 p-4 text-sm text-ink/68">
                <p className="font-semibold text-ink">Shareable dynamic page</p>
                <p className="mt-1 truncate">{currentRecord.shareUrl}</p>
              </div>
            ) : null}

            {mode === "dynamic" && currentRecord && (!analysis.isValid || analysis.isBlocked) ? (
              <div className="mt-5 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
                The current QR still points to the last saved dynamic link. Fix the destination field to sync your edits.
              </div>
            ) : null}
          </Card>
        </div>
      </div>

      <LazyHistoryPanel records={history} loading={historyLoading} onLoadRecord={applyRecord} />
    </div>
  );
}
