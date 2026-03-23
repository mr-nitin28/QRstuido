import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_CUSTOMIZATION } from "@/lib/qr/defaults";
import { generateQrDataUrl } from "@/lib/qr/server";
import { analyzeUrl, sanitizeCustomization } from "@/lib/qr/url-safety";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request";

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const limit = checkRateLimit({
    key: `${ip}:generate`,
    limit: 60,
    windowMs: 10 * 60 * 1000
  });

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000))
        }
      }
    );
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const input = typeof body?.url === "string" ? body.url : "";
  const analysis = analyzeUrl(input);

  if (!analysis.isValid || analysis.isBlocked || !analysis.normalizedUrl) {
    return NextResponse.json(
      { error: analysis.messages[0] ?? "Invalid URL." },
      { status: 400 }
    );
  }

  const customization = sanitizeCustomization(body?.customization, DEFAULT_CUSTOMIZATION);
  const qrCode = await generateQrDataUrl({
    value: analysis.normalizedUrl,
    size: customization.size,
    foreground: customization.foreground,
    background: customization.background,
    margin: customization.margin
  });

  return NextResponse.json({
    qrCode,
    warnings: analysis.severity === "warning" ? analysis.messages : []
  });
}

