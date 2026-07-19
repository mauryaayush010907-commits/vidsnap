import { sanitizeUrl as rawSanitizeUrl } from "@braintree/sanitize-url";

const TRUSTED_PROXY_HOSTNAMES = [
  "instagram.com",
  "cdninstagram.com",
  "facebook.com",
  "fbcdn.net",
  "youtube.com",
  "youtu.be",
  "ytimg.com",
  "reddit.com",
  "redd.it",
  "v.redd.it",
  "vimeo.com",
  "player.vimeo.com",
  "tiktok.com",
  "vm.tiktok.com",
  "twitter.com",
  "x.com",
  "video.twimg.com",
  "twimg.com",
  "pbs.twimg.com",
];

export function normalizeUrl(value: string): string | null {
  const sanitized = rawSanitizeUrl(value || "").trim();

  if (!sanitized || sanitized === "about:blank") return null;

  try {
    const parsed = new URL(sanitized);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function isValidUrl(value: string): boolean {
  return Boolean(normalizeUrl(value));
}

export function getHostname(value: string): string | null {
  const normalized = normalizeUrl(value);
  if (!normalized) return null;
  try {
    return new URL(normalized).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isTrustedProxyHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return TRUSTED_PROXY_HOSTNAMES.some((allowed) => normalized === allowed || normalized.endsWith(`.${allowed}`));
}

export function isTrustedProxyUrl(value: string): boolean {
  const normalized = normalizeUrl(value);
  if (!normalized) return false;
  const hostname = getHostname(normalized);
  return hostname ? isTrustedProxyHostname(hostname) : false;
}
