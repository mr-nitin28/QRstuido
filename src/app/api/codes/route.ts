import { NextRequest, NextResponse } from "next/server";
import { toRecordResponse } from "@/lib/qr/analytics";
import { DEFAULT_CUSTOMIZATION } from "@/lib/qr/defaults";
import { sanitizePayload } from "@/lib/qr/url-safety";
import { checkRateLimit } from "@/lib/rate-limit";
import { getBaseUrl, getRequestIp } from "@/lib/request";
import { getQrRepository } from "@/lib/store/repository";

export async function GET(request: NextRequest) {
  const repository = await getQrRepository();
  const records = await repository.list();
  const origin = getBaseUrl(request);

  return NextResponse.json({
    records: records.map((record) => toRecordResponse(record, origin))
  });
}

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const limit = checkRateLimit({
    key: `${ip}:codes:create`,
    limit: 40,
    windowMs: 10 * 60 * 1000
  });

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many QR requests. Try again in a minute." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const payload = sanitizePayload(body, DEFAULT_CUSTOMIZATION);

  if (!payload) {
    return NextResponse.json(
      { error: "Invalid payload or blocked destination." },
      { status: 400 }
    );
  }

  const repository = await getQrRepository();
  const record = await repository.create(payload);

  return NextResponse.json({
    record: toRecordResponse(record, getBaseUrl(request))
  });
}

