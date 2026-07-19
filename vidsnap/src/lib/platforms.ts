export type PlatformName =
  | "youtube"
  | "instagram"
  | "facebook"
  | "reddit"
  | "vimeo"
  | "tiktok"
  | "twitter"
  | "unknown";

const PLATFORM_HOSTNAMES: Record<PlatformName, RegExp> = {
  youtube: /(^|\.)((youtube\.com|youtu\.be))$/i,
  instagram: /(^|\.)((instagram\.com|instagr\.am))$/i,
  facebook: /(^|\.)((facebook\.com|fb\.com|fb\.watch))$/i,
  reddit: /(^|\.)((reddit\.com|redd\.it))$/i,
  vimeo: /(^|\.)((vimeo\.com|player\.vimeo\.com))$/i,
  tiktok: /(^|\.)((tiktok\.com|vm\.tiktok\.com))$/i,
  twitter: /(^|\.)((twitter\.com|x\.com|t\.co))$/i,
  unknown: /./,
};

export function getPlatform(url: string): PlatformName {
  try {
    const normalized = url.trim();
    const target = normalized.startsWith("http") ? normalized : `https://${normalized}`;
    const parsed = new URL(target);
    const hostname = parsed.hostname.toLowerCase();

    for (const platform of Object.keys(PLATFORM_HOSTNAMES) as PlatformName[]) {
      if (platform === "unknown") continue;
      if (PLATFORM_HOSTNAMES[platform].test(hostname)) {
        return platform;
      }
    }
  } catch {
    return "unknown";
  }

  return "unknown";
}

export function isVideoPlatform(platform: PlatformName): boolean {
  return platform !== "unknown";
}
