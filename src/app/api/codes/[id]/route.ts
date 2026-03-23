import { NextRequest, NextResponse } from "next/server";
import { toRecordResponse } from "@/lib/qr/analytics";
import { DEFAULT_CUSTOMIZATION } from "@/lib/qr/defaults";
import { sanitizePayload } from "@/lib/qr/url-safety";
import { checkRateLimit } from "@/lib/rate-limit";
import { getBaseUrl, getRequestIp } from "@/lib/request";
import { getQrRepository } from "@/lib/store/repository";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const repository = await getQrRepository();
  const record = await repository.getById(id);

  if (!record) {
    return NextResponse.json({ error: "QR code not found." }, { status: 404 });
  }

  return NextResponse.json({
    record: toRecordResponse(record, getBaseUrl(request))
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ip = getRequestIp(request);
  const limit = checkRateLimit({
    key: `${ip}:codes:update`,
    limit: 80,
    windowMs: 10 * 60 * 1000
  });

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many update requests. Try again shortly." },
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
  const record = await repository.update(id, payload);

  if (!record) {
    return NextResponse.json({ error: "QR code not found." }, { status: 404 });
  }

  return NextResponse.json({
    record: toRecordResponse(record, getBaseUrl(request))
  });
}

