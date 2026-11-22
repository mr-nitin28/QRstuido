"use client";

import dynamic from "next/dynamic";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  History,
  Link2,
  LoaderCircle,
  QrCode,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles
} from "lucide-react";
import { QrCustomizationPanel } from "@/components/qr-customization";
import { buildSymbol, maxLogoPadding } from "@/lib/qr/artwork";
import { QrPreview, type QrPreviewHandle } from "@/components/qr-preview";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { DEFAULT_CUSTOMIZATION } from "@/lib/qr/defaults";
import type { QrCustomization, QrMode, QrRecordResponse, UpsertQrPayload } from "@/lib/qr/types";
import { analyzeUrl } from "@/lib/qr/url-safety";
import { cn, formatCompactNumber } from "@/lib/utils";

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

const workspaceViews = [
  { id: "editor", label: "Editor", icon: SlidersHorizontal },
  { id: "preview", label: "Preview", icon: Eye },
  { id: "history", label: "History", icon: History }
] as const;
type WorkspaceView = (typeof workspaceViews)[number]["id"];

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

async function fetchHistoryData(deletedIds: Set<string>) {
  const data = await requestJson<{ records: QrRecordResponse[] }>("/api/history", {
    cache: "no-store"
  });

  return data.records.filter((record) => !deletedIds.has(record.id));
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
  const [view, setView] = useState<WorkspaceView>("editor");
  const workspace = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<QrMode>("static");
  const [title, setTitle] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [customization, setCustomization] = useState<QrCustomization>(DEFAULT_CUSTOMIZATION);
  const [history, setHistory] = useState<QrRecordResponse[]>([]);
  const deletedIds = useRef(new Set<string>());
  const [currentRecord, setCurrentRecord] = useState<QrRecordResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [dynamicState, setDynamicState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [notice, setNotice] = useState<Notice | null>(null);
  const previewRef = useRef<QrPreviewHandle>(null);
  const dynamicSignatureRef = useRef("");
  const isOnline = useOnlineStatus();
  const syncSession = useRef(0);
  const syncInFlight = useRef(false);
  const analysis = useMemo(() => analyzeUrl(urlInput), [urlInput]);
  const payload = useMemo(() => ({
    title: title.trim(), mode, destinationUrl: analysis.normalizedUrl, customization
  }), [title, mode, analysis.normalizedUrl, customization]);
  const debouncedPayload = useDebouncedValue(payload, 700);
  const validDestination = Boolean(analysis.isValid && !analysis.isBlocked && analysis.normalizedUrl);
  const previewUrl = mode === "dynamic"
    ? (currentRecord?.mode === "dynamic" ? currentRecord.redirectUrl : "")
    : (validDestination ? analysis.normalizedUrl! : "");
  const branded = Boolean(customization.logoDataUrl);
  const symbol = useMemo(() => {
    try {
      return buildSymbol(previewUrl || "https://example.com", branded);
    } catch {
      return null;
    }
  }, [previewUrl, branded]);
  const canPreview = Boolean(previewUrl && symbol);
  const actionsDisabled = !canPreview || busyAction !== null;
  let previewStatus: string | null = null;
  if (!symbol) previewStatus = "This destination exceeds the QR capacity. Shorten the URL or use a dynamic link.";
  else if (!previewUrl) previewStatus = validDestination && mode === "dynamic"
    ? "Exports unlock when the dynamic link is ready."
    : "Enter a valid destination to export or copy this code.";

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      if (!isOnline) {
        setHistoryLoading(false);
        return;
      }

      try {
        const records = await fetchHistoryData(deletedIds.current);

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
    if (mode !== "dynamic" || !isOnline || !validDestination || payload !== debouncedPayload ||
        !payload.destinationUrl || syncInFlight.current) return;

    const id = currentRecord?.id;
    const signature = JSON.stringify({ id: id ?? "new", payload });
    if (dynamicSignatureRef.current === signature) return;
    const session = syncSession.current;
    const update: UpsertQrPayload = { ...payload, destinationUrl: payload.destinationUrl };
    syncInFlight.current = true;
    dynamicSignatureRef.current = signature;
    setDynamicState("saving");
    void upsertRecord(update, id).then((record) => {
      if (session !== syncSession.current) return;
      syncInFlight.current = false;
      dynamicSignatureRef.current = JSON.stringify({ id: record.id, payload });
      setCurrentRecord(record);
      setHistory((records) => [record, ...records.filter((item) => item.id !== record.id)]);
      setDynamicState("saved");
    }).catch((error: unknown) => {
      if (session !== syncSession.current) return;
      syncInFlight.current = false;
      setDynamicState("error");
      setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Unable to sync dynamic QR code." });
    });
  }, [mode, isOnline, validDestination, payload, debouncedPayload, currentRecord?.id, dynamicState]);

  function resetSync() {
    syncSession.current++;
    syncInFlight.current = false;
    dynamicSignatureRef.current = "";
  }

  function changeMode(next: QrMode) {
    if (next === mode) return;
    resetSync();
    setMode(next);
    setCurrentRecord(null);
    setDynamicState("idle");
  }

  function updateCustomization<K extends keyof QrCustomization>(key: K, value: QrCustomization[K]) {
    setCustomization((current) => ({
      ...current,
      [key]: value
    }));
  }

  function showView(next: WorkspaceView) {
    setView(next);
    const control = document.getElementById(`show-${next}`);
    if (!control?.getClientRects().length) return;
    control.focus({ preventScroll: true });
    if (workspace.current && workspace.current.getBoundingClientRect().top < 0) {
      workspace.current.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }

  function applyRecord(record: QrRecordResponse) {
    showView("editor");
    resetSync();
    setDynamicState(record.mode === "dynamic" ? "saved" : "idle");
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
      const records = await fetchHistoryData(deletedIds.current);
      startTransition(() => setHistory(records));
    } finally {
      setHistoryLoading(false);
    }
  }

  async function saveStatic() {
    const session = syncSession.current;
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
        mode === "static" ? currentRecord?.id : undefined
      );

      if (mode === "static" && session === syncSession.current) setCurrentRecord(record);
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

  async function deleteFromHistory(record: QrRecordResponse) {
    const session = syncSession.current;
    await requestJson(`/api/codes/${encodeURIComponent(record.id)}`, { method: "DELETE" });
    deletedIds.current.add(record.id);
    setHistory((records) => records.filter((item) => item.id !== record.id));
    if (currentRecord?.id === record.id && session === syncSession.current) {
      resetSync();
      setCurrentRecord(null);
      setMode("static");
      setDynamicState("idle");
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


  return (
    <main className="page-frame mx-auto flex w-full max-w-7xl flex-col gap-3 lg:gap-6">
      <header className="rounded-2xl border border-border bg-surface p-4 lg:rounded-[32px] lg:p-7 lg:shadow-soft">
        <div className="flex items-center justify-between gap-3 lg:items-end lg:gap-6">
          <div className="min-w-0 max-w-3xl lg:space-y-4">
            <div className="hidden flex-wrap items-center gap-3 lg:flex">
              <Badge tone="success">Fast, safe, printable</Badge>
              <Badge tone="neutral">{formatCompactNumber(history.length)} saved codes</Badge>
              <Badge tone={isOnline ? "success" : "warning"}>
                {isOnline ? "Online sync enabled" : "Offline local mode"}
              </Badge>
            </div>
            <div className="lg:space-y-3">
              <h1 className="font-display text-2xl font-semibold tracking-[-0.04em] text-ink lg:text-5xl">
                <span className="flex items-center gap-2 lg:hidden"><QrCode aria-hidden="true" className="size-6" />QR Studio</span>
                <span className="hidden lg:inline">Generate polished QR codes for URLs, app links, and dynamic campaigns.</span>
              </h1>
              <p className="mt-1 text-sm text-muted lg:hidden">
                {isOnline ? "Online" : "Offline"} Â· {formatCompactNumber(history.length)} saved
              </p>
              <p className="hidden max-w-2xl text-lg leading-7 text-muted lg:block">
                QR Studio combines live generation, brand customization, downloadable print assets, dynamic redirects,
                and built-in scan analytics in one responsive workspace.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <ThemeToggle />
            <div className="hidden rounded-full border border-border bg-surfaceAlt px-4 py-2 text-sm text-muted lg:block">
              {mode === "dynamic" ? "Editable short link mode" : "Direct destination mode"}
            </div>
          </div>
        </div>
      </header>
      <div ref={workspace} className="min-w-0">
        <nav aria-label="Workspace views" className="workspace-nav sticky z-20 mb-3 grid grid-cols-3 gap-1 rounded-2xl border border-border bg-surface p-1 shadow-sm lg:hidden">
          {workspaceViews.map(({ id, label, icon: Icon }) => (
            <button key={id} id={`show-${id}`} type="button" aria-controls={`workspace-${id}`}
              aria-pressed={view === id} onClick={() => showView(id)}
              className={cn("flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl px-1 text-sm font-semibold transition-colors",
                view === id ? "bg-ink text-surface" : "text-muted hover:bg-surfaceAlt")}>
              <Icon aria-hidden="true" className="size-4 shrink-0" />{label}
            </button>
          ))}
        </nav>
        {notice ? (
          <div
            role="status"
            className={cn(
              "mb-3 rounded-2xl px-4 py-3 text-sm [overflow-wrap:anywhere]",
              notice.tone === "success" && "bg-success/10 text-success",
              notice.tone === "warning" && "bg-warning/10 text-warning",
              notice.tone === "danger" && "bg-danger/10 text-danger",
              notice.tone === "neutral" && "bg-surfaceAlt text-muted"
            )}
          >
            {notice.text}
          </div>
        ) : null}
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-6">
          <Card id="workspace-editor" className={cn("min-w-0", view !== "editor" && "hidden lg:block")}>
            <CardHeader>
              <CardTitle>Configure Destination</CardTitle>
              <CardDescription>
                Static codes keep their destination. Dynamic codes let you change it later.
              </CardDescription>
            </CardHeader>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <button
                  type="button"
                  aria-pressed={mode === "static"}
                  onClick={() => changeMode("static")}
                  className={cn(
                    "min-w-0 rounded-2xl border p-3 text-left transition-colors sm:p-4",
                    mode === "static"
                      ? "border-accentEdge bg-surface ring-1 ring-accentEdge"
                      : "border-control bg-surface hover:border-accentEdge"
                  )}
                >
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                    <Link2 className="size-4" />
                    Static QR
                  </div>
                  <p className="text-sm leading-6 text-muted">
                    Direct link
                  </p>
                </button>

                <button
                  type="button"
                  aria-pressed={mode === "dynamic"}
                  onClick={() => changeMode("dynamic")}
                  className={cn(
                    "min-w-0 rounded-2xl border p-3 text-left transition-colors sm:p-4",
                    mode === "dynamic"
                      ? "border-accentEdge bg-surface ring-1 ring-accentEdge"
                      : "border-control bg-surface hover:border-accentEdge"
                  )}
                >
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                    <Sparkles className="size-4" />
                    Dynamic QR
                  </div>
                  <p className="text-sm leading-6 text-muted">
                    Editable link
                  </p>
                </button>
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <label htmlFor="qr-destination" className="text-sm font-medium text-ink">Destination URL</label>
                  <Textarea
                    id="qr-destination"
                    inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                    placeholder="https://example.com or myapp://open/deeplink"
                    value={urlInput}
                    onChange={(event) => setUrlInput(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="qr-title" className="text-sm font-medium text-ink">Title</label>
                  <Input
                    id="qr-title"
                    placeholder="Campaign landing page"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </div>

                <div
                  className={cn(
                    "rounded-2xl border p-4 text-sm",
                    analysis.severity === "safe" && "border-success/30 bg-success/10 text-success",
                    analysis.severity === "warning" && "border-warning/30 bg-warning/10 text-warning",
                    analysis.severity === "danger" && "border-danger/30 bg-danger/10 text-danger",
                    analysis.severity === "neutral" && "border-border bg-surface text-muted"
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

              <QrCustomizationPanel key={syncSession.current} value={customization} onChange={updateCustomization}
                paddingLimit={symbol ? maxLogoPadding(symbol, customization) : 0} />
            </div>
          </Card>

          <div id="workspace-preview" className={cn("min-w-0", view !== "preview" && "hidden lg:block")}>
            <Card className="lg:sticky lg:top-4">
              <CardHeader className="items-start">
                <div>
                  <CardTitle>Live Preview</CardTitle>
                  <CardDescription>
                    The preview fits this panel. Downloads use your selected output size.
                  </CardDescription>
                </div>
                {mode === "dynamic" && dynamicState === "idle" ? <Badge tone="neutral">Dynamic mode</Badge> : <SyncStatus state={dynamicState} />}
                {mode === "dynamic" && dynamicState === "error" && isOnline && validDestination && (
                  <Button size="sm" variant="secondary" onClick={() => {
                    dynamicSignatureRef.current = "";
                    setDynamicState("idle");
                  }}>Retry sync</Button>
                )}
              </CardHeader>

              <div className="grid min-w-0 gap-4 sm:max-lg:grid-cols-2 sm:max-lg:items-start">
                <QrPreview
                  ref={previewRef}
                  title={title || currentRecord?.title || "qr-code"}
                  symbol={symbol}
                  customization={customization}
                  status={previewStatus}
                />

                <div className="export-actions grid gap-2">
                  <Button
                    disabled={actionsDisabled}
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
                    disabled={actionsDisabled}
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
                    disabled={actionsDisabled}
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
                    disabled={actionsDisabled}
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
                    disabled={actionsDisabled}
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
                    disabled={!validDestination || !isOnline || busyAction !== null || (mode === "static" && !symbol)}
                  >
                    {busyAction === "save" ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                    {mode === "dynamic" ? "Save Current Snapshot" : "Save to History"}
                  </Button>
                </div>
              </div>
              {mode === "dynamic" && currentRecord?.shareUrl ? (
                <div className="mt-5 rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
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
          <div id="workspace-history" className={cn("min-w-0 lg:col-span-2", view !== "history" && "hidden lg:block")}>
            <LazyHistoryPanel records={history} loading={historyLoading} online={isOnline}
              onLoadRecord={applyRecord} onDeleteRecord={deleteFromHistory} />
          </div>
        </div>
      </div>
    </main>
  );
}
