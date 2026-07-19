import { isTrustedProxyUrl, normalizeUrl } from "@/lib/validators";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export function buildProxyHeaders(targetUrl: string): Record<string, string> {
  const host = new URL(targetUrl).hostname.toLowerCase();
  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    Accept: "*/*",
  };

  if (host.includes("instagram.com")) {
    headers.Referer = "https://www.instagram.com/";
    headers["Sec-Fetch-Site"] = "cross-site";
  }

  if (host.includes("facebook.com") || host.includes("fbcdn.net")) {
    headers.Referer = "https://www.facebook.com/";
    headers["Sec-Fetch-Site"] = "cross-site";
  }

  if (host.includes("vimeo.com")) {
    headers.Referer = "https://vimeo.com/";
  }

  if (host.includes("tiktok.com") || host.includes("twimg.com") || host.includes("twitter.com") || host.includes("x.com")) {
    headers.Referer = "https://www.tiktok.com/";
  }

  return headers;
}

export function buildProxyUrl(rawUrl: string): string | null {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized || !isTrustedProxyUrl(normalized)) {
    return null;
  }

  return `/api/proxy?url=${encodeURIComponent(normalized)}`;
}
