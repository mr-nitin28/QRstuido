import { NextRequest, NextResponse } from "next/server";
import { detectDeviceType, getRequestIp, hashValue } from "@/lib/request";
import { getQrRepository } from "@/lib/store/repository";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const repository = await getQrRepository();
  const record = await repository.getBySlug(slug);

  if (!record) {
    return NextResponse.redirect(new URL("/", request.url), 307);
  }

  const userAgent = request.headers.get("user-agent");
  const ip = getRequestIp(request);

  await repository.logScan(record.id, {
    deviceType: detectDeviceType(userAgent),
    userAgent,
    ipHash: ip === "unknown" ? null : hashValue(ip),
    country: request.headers.get("x-vercel-ip-country"),
    city: request.headers.get("x-vercel-ip-city"),
    referrer: request.headers.get("referer")
  });

  return NextResponse.redirect(record.destinationUrl, 307);
}

