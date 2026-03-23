import { clamp } from "@/lib/utils";
import type { QrCustomization, UpsertQrPayload, UrlAnalysis } from "@/lib/qr/types";

const BLOCKED_PROTOCOLS = new Set(["javascript:", "data:", "vbscript:", "file:"]);
const DOMAIN_LIKE_PATTERN =
  /^(localhost|([a-z0-9-]+\.)+[a-z]{2,}|(\d{1,3}\.){3}\d{1,3})(:\d+)?([/?#].*)?$/i;
const HEX_COLOR = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const PRIVATE_IPV4_PATTERNS = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./
];

const SUSPICIOUS_TOKENS = [
  "verify",
  "wallet",
  "password",
  "seed",
  "recovery",
  "private-key",
  "token",
  "credential"
];

function isPrivateIpv4(hostname: string) {
  return PRIVATE_IPV4_PATTERNS.some((pattern) => pattern.test(hostname));
}

function normalizeCandidate(input: string) {
  const trimmed = input.trim();

  if (!trimmed) {
    return "";
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return trimmed;
  }

  if (DOMAIN_LIKE_PATTERN.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

function pushWarning(messages: string[], value: string) {
  if (!messages.includes(value)) {
    messages.push(value);
  }
}

export function analyzeUrl(input: string): UrlAnalysis {
  const rawInput = input;
  const candidate = normalizeCandidate(input);

  if (!candidate) {
    return {
      rawInput,
      normalizedUrl: null,
      isValid: false,
      isBlocked: false,
      severity: "neutral",
      messages: ["Enter a full URL or app link to generate a QR code."],
      label: "Awaiting input"
    };
  }

  try {
    const parsed = new URL(candidate);
    const messages: string[] = [];

    if (BLOCKED_PROTOCOLS.has(parsed.protocol)) {
      return {
        rawInput,
        normalizedUrl: null,
        isValid: false,
        isBlocked: true,
        severity: "danger",
        messages: ["This scheme is unsafe for QR redirects and has been blocked."],
        label: "Blocked"
      };
    }

    if (parsed.username || parsed.password) {
      pushWarning(messages, "Embedded usernames or passwords can expose credentials.");
    }

    if (parsed.protocol === "http:") {
      pushWarning(messages, "This URL uses HTTP instead of HTTPS.");
    }

    if (parsed.hostname === "localhost" || isPrivateIpv4(parsed.hostname)) {
      pushWarning(messages, "Local or private-network targets may not work outside your environment.");
    }

    if (parsed.hostname.startsWith("xn--")) {
      pushWarning(messages, "This hostname uses punycode and should be verified carefully.");
    }

    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(parsed.hostname)) {
      pushWarning(messages, "Raw IP-based destinations are harder to trust than named domains.");
    }

    const suspiciousHits = SUSPICIOUS_TOKENS.filter((token) =>
      parsed.href.toLowerCase().includes(token)
    );

    if (suspiciousHits.length >= 2) {
      pushWarning(messages, "This link contains phishing-adjacent keywords. Verify the destination.");
    }

    if (parsed.href.length > 1800) {
      pushWarning(messages, "Very long URLs can reduce scannability on lower-end cameras.");
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      pushWarning(messages, "Custom app-link schemes depend on installed apps on the scanning device.");
    }

    const normalizedUrl = parsed.toString();

    return {
      rawInput,
      normalizedUrl,
      isValid: true,
      isBlocked: false,
      severity: messages.length ? "warning" : "safe",
      messages: messages.length ? messages : ["Ready to generate a scanner-safe QR code."],
      label: messages.length ? "Use caution" : "Valid URL"
    };
  } catch {
    return {
      rawInput,
      normalizedUrl: null,
      isValid: false,
      isBlocked: false,
      severity: "danger",
      messages: ["This is not a valid absolute URL or app link."],
      label: "Invalid URL"
    };
  }
}

function assertColor(value: unknown, fallback: string) {
  return typeof value === "string" && HEX_COLOR.test(value) ? value : fallback;
}

function assertInteger(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? clamp(Math.round(value), min, max)
    : fallback;
}

function assertLogo(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("data:image/")) {
    return null;
  }

  return value.length <= 600_000 ? value : null;
}

export function sanitizeCustomization(value: unknown, fallback: QrCustomization): QrCustomization {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    foreground: assertColor(input.foreground, fallback.foreground),
    background: assertColor(input.background, fallback.background),
    size: assertInteger(input.size, fallback.size, 180, 1400),
    margin: assertInteger(input.margin, fallback.margin, 0, 12),
    padding: assertInteger(input.padding, fallback.padding, 0, 40),
    logoDataUrl: assertLogo(input.logoDataUrl)
  };
}

export function sanitizePayload(value: unknown, fallback: QrCustomization): UpsertQrPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const input = value as Record<string, unknown>;
  const title = typeof input.title === "string" ? input.title.trim().slice(0, 80) : "";
  const mode = input.mode === "dynamic" ? "dynamic" : "static";
  const destination = typeof input.destinationUrl === "string" ? input.destinationUrl : "";
  const analysis = analyzeUrl(destination);

  if (!analysis.isValid || analysis.isBlocked || !analysis.normalizedUrl) {
    return null;
  }

  return {
    title,
    mode,
    destinationUrl: analysis.normalizedUrl,
    customization: sanitizeCustomization(input.customization, fallback)
  };
}

