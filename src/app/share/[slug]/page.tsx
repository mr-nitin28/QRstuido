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
  const qrCode = await generateQrDataUrl({
    value: redirectUrl,
    size: 560,
    foreground: record.customization.foreground,
    background: record.customization.background,
    margin: record.customization.margin
  });
  const analytics = buildAnalytics(record.scans);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid w-full gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="overflow-hidden bg-surface/84">
          <div
            className="rounded-[28px] p-6"
            style={{
              background: `linear-gradient(140deg, ${record.customization.background}, rgba(255,255,255,0.9))`
            }}
          >
            <Image
              src={qrCode}
              alt={`QR code for ${record.title}`}
              width={560}
              height={560}
              unoptimized
              className="mx-auto aspect-square w-full max-w-[420px] rounded-[24px] bg-white p-4 shadow-soft"
            />
          </div>
        </Card>

        <Card className="bg-surface/84">
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
            <CardTitle className="mt-2 text-3xl">{record.title}</CardTitle>
            <CardDescription>
              Scan to open the destination or use the button below. The QR resolves through a tracked redirect link.
            </CardDescription>
          </CardHeader>

          <div className="space-y-5">
            <div className="rounded-2xl border border-border/70 bg-surfaceAlt/55 p-4">
              <p className="mb-2 text-xs uppercase tracking-[0.18em] text-ink/44">Destination</p>
              <p className="break-all text-sm text-ink/72">{record.destinationUrl}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
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

            <Link
              href={redirectUrl}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-slate-950 transition hover:bg-accent/90"
            >
              <ExternalLink className="size-4" />
              Open Destination
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}
