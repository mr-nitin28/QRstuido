"use client";

import { Copy, ExternalLink, PencilLine, ScanLine, Sparkles } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { topBucketLabel } from "@/lib/qr/analytics";
import type { QrRecordResponse } from "@/lib/qr/types";
import { formatCompactNumber, formatDate } from "@/lib/utils";

interface HistoryPanelProps {
  records: QrRecordResponse[];
  loading: boolean;
  onLoadRecord: (record: QrRecordResponse) => void;
}

export function HistoryPanel({ records, loading, onLoadRecord }: HistoryPanelProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copyShareLink(record: QrRecordResponse) {
    const target = record.shareUrl ?? record.redirectUrl;
    await navigator.clipboard.writeText(target);
    setCopiedId(record.id);
    window.setTimeout(() => setCopiedId(null), 1400);
  }

  return (
    <Card className="min-h-[360px]">
      <CardHeader className="flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>History & Analytics</CardTitle>
          <CardDescription>
            Previously generated codes, dynamic redirects, and top scan insights.
          </CardDescription>
        </div>
        <Badge tone="neutral">{loading ? "Loading" : `${records.length} saved`}</Badge>
      </CardHeader>

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
              className="rounded-2xl border border-border/70 bg-surfaceAlt/55 p-4 transition hover:border-accent/40 hover:bg-surfaceAlt/75"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={record.mode === "dynamic" ? "success" : "neutral"}>
                      {record.mode === "dynamic" ? "Dynamic" : "Static"}
                    </Badge>
                    <Badge tone="neutral">{formatCompactNumber(record.analytics.totalScans)} scans</Badge>
                  </div>
                  <h3 className="font-display text-lg font-semibold text-ink">{record.title}</h3>
                  <p className="line-clamp-2 text-sm text-ink/66">{record.destinationUrl}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => onLoadRecord(record)}>
                  <PencilLine className="size-4" />
                  Load
                </Button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
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
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-ink/66">
          Save a QR code to build a reusable history with editable dynamic links and scan telemetry.
        </div>
      )}
    </Card>
  );
}
