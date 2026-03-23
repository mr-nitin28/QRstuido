import { NextRequest, NextResponse } from "next/server";
import { toRecordResponse } from "@/lib/qr/analytics";
import { getBaseUrl } from "@/lib/request";
import { getQrRepository } from "@/lib/store/repository";

export async function GET(request: NextRequest) {
  const repository = await getQrRepository();
  const origin = getBaseUrl(request);
  const records = await repository.list();

  return NextResponse.json({
    records: records.map((record) => toRecordResponse(record, origin))
  });
}

