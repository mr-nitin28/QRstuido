"use client";

import { Copy, ExternalLink, LoaderCircle, PencilLine, ScanLine, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader } from "@/components/ui/card";
import { topBucketLabel } from "@/lib/qr/analytics";
import type { QrRecordResponse } from "@/lib/qr/types";
import { formatCompactNumber, formatDate } from "@/lib/utils";

interface HistoryPanelProps {
  records: QrRecordResponse[];
  loading: boolean;
  online: boolean;
  onLoadRecord: (record: QrRecordResponse) => void;
  onDeleteRecord: (record: QrRecordResponse) => Promise<void>;
}

export function HistoryPanel({ records, loading, online, onLoadRecord, onDeleteRecord }: HistoryPanelProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<QrRecordResponse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (selected) dialog.current?.showModal();
  }, [selected]);

  async function confirmDelete() {
    if (!selected || deleting) return;
    setDeleting(true);
    setError("");
    try {
      await onDeleteRecord(selected);
      dialog.current?.close();
      setFeedback(`Deleted “${selected.title}” from history.`);
      heading.current?.focus({ preventScroll: true });
    } catch (cause) {
      setError(cause instanceof Error && !(cause instanceof TypeError)
        ? cause.message : "Couldn’t delete this code. Check your connection and try again.");
    } finally {
      setDeleting(false);
    }
  }

  async function copyShareLink(record: QrRecordResponse) {
    const target = record.shareUrl ?? record.redirectUrl;
    await navigator.clipboard.writeText(target);
    setCopiedId(record.id);
    window.setTimeout(() => setCopiedId(null), 1400);
  }

  return (
    <Card>
      <CardHeader className="items-start sm:!flex-row sm:justify-between">
        <div>
          <h2 ref={heading} tabIndex={-1} className="font-display text-xl font-semibold text-ink">History & Analytics</h2>
          <CardDescription>
            Previously generated codes, dynamic redirects, and top scan insights.
          </CardDescription>
        </div>
        <Badge tone="neutral" className="shrink-0">{loading ? "Loading" : `${records.length} saved`}</Badge>
      </CardHeader>
      <p role="status" className="empty:hidden mb-4 break-words text-sm text-ink/75">{feedback}</p>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-44 animate-pulse rounded-2xl border border-border/70 bg-surfaceAlt/60"
            />
          ))}
        </div>
      ) : records.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {records.map((record) => (
            <article
              key={record.id}
              className="min-w-0 rounded-2xl border border-border/70 bg-surfaceAlt/55 p-3 transition-colors [overflow-wrap:anywhere] hover:border-accent/40 hover:bg-surfaceAlt/75 sm:p-4"
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0 space-y-2 [overflow-wrap:anywhere]">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={record.mode === "dynamic" ? "success" : "neutral"}>
                      {record.mode === "dynamic" ? "Dynamic" : "Static"}
                    </Badge>
                    <Badge tone="neutral">{formatCompactNumber(record.analytics.totalScans)} scans</Badge>
                  </div>
                  <h3 className="font-display text-lg font-semibold text-ink">{record.title}</h3>
                  <p className="line-clamp-2 text-sm text-ink/66">{record.destinationUrl}</p>
                </div>
                <button type="button" disabled={!online}
                  aria-label={`Delete ${record.title} from history`} aria-haspopup="dialog"
                  title={online ? "Delete from history" : "Connect to delete"}
                  onClick={() => { setError(""); setFeedback(""); setSelected(record); }}
                  className="grid size-11 place-items-center rounded-full border border-border text-ink/70 transition-colors hover:border-danger/50 hover:bg-danger/10 hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-danger disabled:opacity-50">
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>

              <div className="mt-4 grid gap-2 min-[440px]:grid-cols-3">
                <div className="rounded-2xl bg-surface/85 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-ink/44">Last Scan</p>
                  <p className="mt-2 text-sm font-medium text-ink">{formatDate(record.lastScannedAt)}</p>
                </div>
                <div className="rounded-2xl bg-surface/85 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-ink/44">Top Device</p>
                  <p className="mt-2 text-sm font-medium text-ink">
                    {topBucketLabel(record.analytics.devices)}
                  </p>
                </div>
                <div className="rounded-2xl bg-surface/85 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-ink/44">Top Region</p>
                  <p className="mt-2 text-sm font-medium text-ink">
                    {topBucketLabel(record.analytics.locations)}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" onClick={() => onLoadRecord(record)}>
                  <PencilLine className="size-4" /> Load
                </Button>
                <Button variant="secondary" size="sm" onClick={() => void copyShareLink(record)}>
                  <Copy className="size-4" />
                  {copiedId === record.id ? "Copied" : "Copy Link"}
                </Button>
                {record.shareUrl ? (
                  <Button variant="ghost" size="sm" onClick={() => window.open(record.shareUrl!, "_blank")}>
                    <Sparkles className="size-4" />
                    Share Page
                  </Button>
                ) : null}
                <Button variant="ghost" size="sm" onClick={() => window.open(record.redirectUrl, "_blank")}>
                  <ExternalLink className="size-4" />
                  Open Target
                </Button>
              </div>

              {record.analytics.recent.length ? (
                <div className="mt-4 rounded-2xl border border-border/70 bg-surface/80 p-3">
                  <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-ink/44">
                    <ScanLine className="size-3.5" />
                    Recent Activity
                  </p>
                  <div className="space-y-2 text-sm text-ink/68">
                    {record.analytics.recent.slice(0, 3).map((scan) => (
                      <p key={scan.id}>
                        {formatDate(scan.scannedAt)} · {scan.deviceType} ·{" "}
                        {[scan.city, scan.country].filter(Boolean).join(", ") || "Unknown region"}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-ink/66 sm:p-10">
          Save a QR code to build a reusable history with editable dynamic links and scan telemetry.
        </div>
      )}
      <dialog ref={dialog} aria-labelledby="delete-qr-heading" aria-describedby="delete-qr-description"
        onClose={() => setSelected(null)} onCancel={(event) => { if (deleting) event.preventDefault(); }}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-sm overflow-y-auto overscroll-contain rounded-2xl border border-border bg-surface p-5 text-ink shadow-soft backdrop:bg-black/45">
        <h3 id="delete-qr-heading" className="font-display text-lg font-semibold">Delete from history?</h3>
        <p id="delete-qr-description" className="mt-2 text-sm leading-6 text-ink/75 [overflow-wrap:anywhere]">
          This permanently deletes <strong>“{selected?.title}”</strong> and its scan history.
          {selected?.mode === "dynamic" && " Its dynamic QR code and share link will stop working."}
        </p>
        {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button autoFocus variant="secondary" disabled={deleting} onClick={() => dialog.current?.close()}>Cancel</Button>
          <Button variant="danger" disabled={deleting || !online} onClick={() => void confirmDelete()}>
            {deleting ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </dialog>
    </Card>
  );
}
