import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";

export function getRequestIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}

export function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function getBaseUrl(request: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  return request.nextUrl.origin;
}

export function getBaseUrlFromHeaders(headers: Headers) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const protocol = headers.get("x-forwarded-proto") ?? "http";
  const host = headers.get("x-forwarded-host") ?? headers.get("host");

  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

export function detectDeviceType(userAgent: string | null) {
  if (!userAgent) {
    return "unknown";
  }

  const value = userAgent.toLowerCase();

  if (value.includes("bot") || value.includes("spider") || value.includes("crawl")) {
    return "bot";
  }

  if (value.includes("tablet") || value.includes("ipad")) {
    return "tablet";
  }

  if (
    value.includes("mobile") ||
    value.includes("iphone") ||
    value.includes("android")
  ) {
    return "mobile";
  }

  return "desktop";
}
