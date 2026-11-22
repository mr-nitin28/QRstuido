import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ExternalLink, QrCode, ScanLine, Sparkles } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildAnalytics } from "@/lib/qr/analytics";
import { generateQrDataUrl } from "@/lib/qr/server";
import { getBaseUrlFromHeaders } from "@/lib/request";
import { getQrRepository } from "@/lib/store/repository";
import { formatDate } from "@/lib/utils";

export default async function SharePage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const repository = await getQrRepository();
  const record = await repository.getBySlug(slug);

  if (!record) {
    notFound();
  }

  const headerStore = await headers();
  const origin = getBaseUrlFromHeaders(headerStore);
  const redirectUrl = `${origin}/q/${slug}`;
  const qrCode = await generateQrDataUrl(redirectUrl, record.customization);
  const analytics = buildAnalytics(record.scans);

  return (
    <main className="page-frame mx-auto flex min-h-svh max-w-5xl items-center">
      <div className="grid w-full min-w-0 gap-3 sm:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] sm:items-start lg:gap-6">
        <Card className="overflow-hidden">
          <div className="rounded-2xl bg-surface p-2 sm:p-4">
            <Image
              src={qrCode}
              alt={`QR code for ${record.title}`}
              width={record.customization.size}
              height={record.customization.size}
              unoptimized
              className="mx-auto block h-auto max-h-[min(64svh,28rem)] max-w-full object-contain"
            />
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
                <Sparkles className="mr-1 size-3.5" />
                Shared QR Page
              </span>
              <span className="inline-flex items-center rounded-full bg-surfaceAlt px-3 py-1 text-xs font-semibold text-ink/72">
                {record.mode === "dynamic" ? "Dynamic link" : "Static link"}
              </span>
            </div>
            <CardTitle className="mt-2 text-2xl [overflow-wrap:anywhere] lg:text-3xl">{record.title}</CardTitle>
            <CardDescription>
              Scan to open the destination or use the button below. The QR resolves through a tracked redirect link.
            </CardDescription>
          </CardHeader>

          <div className="space-y-5">
            <div className="rounded-2xl border border-border/70 bg-surfaceAlt/55 p-4">
              <p className="mb-2 text-xs uppercase tracking-[0.18em] text-ink/44">Destination</p>
              <p className="break-all text-sm text-ink/72">{record.destinationUrl}</p>
            </div>

            <Link
              href={redirectUrl}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-accent/90 sm:w-auto"
            >
              <ExternalLink className="size-4" />
              Open Destination
            </Link>

            <div className="grid gap-3 lg:grid-cols-3 [overflow-wrap:anywhere]">
              <div className="rounded-2xl border border-border/70 bg-surfaceAlt/55 p-4">
                <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-ink/44">
                  <ScanLine className="size-3.5" />
                  Total Scans
                </p>
                <p className="text-2xl font-semibold text-ink">{analytics.totalScans}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-surfaceAlt/55 p-4">
                <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-ink/44">
                  <QrCode className="size-3.5" />
                  Last Scan
                </p>
                <p className="text-sm font-medium text-ink">{formatDate(record.lastScannedAt)}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-surfaceAlt/55 p-4">
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-ink/44">Top Device</p>
                <p className="text-sm font-medium text-ink">{analytics.devices[0]?.label ?? "Unknown"}</p>
              </div>
            </div>

          </div>
        </Card>
      </div>
    </main>
  );
}
