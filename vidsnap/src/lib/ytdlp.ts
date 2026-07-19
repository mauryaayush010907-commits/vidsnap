import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import ffmpegPath from "ffmpeg-static";

import { normalizeUrl } from "@/lib/validators";
import { getPlatform, PlatformName } from "@/lib/platforms";

function getYtdlpBinary(): string {
  return (
    process.env.YTDLP_BINARY || path.join(process.cwd(), "yt-dlp.exe")
  );
}

function getInstagramCookiesPath(): string | undefined {
  return process.env.INSTAGRAM_COOKIES_PATH
    ? path.resolve(process.env.INSTAGRAM_COOKIES_PATH)
    : undefined;
}

function hasInstagramCookies(): boolean {
  const p = getInstagramCookiesPath();
  return p ? fs.existsSync(p) : false;
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const MAX_YTDLP_ATTEMPTS = 3;

export interface QualityOption {
  quality: string;
  height: number;
  formatId: string;
  ext: string;
  filesize: number | null;
  fps: number | null;
  needsMerge: boolean;
}

export interface AudioOption {
  quality: string;
  formatId: string;
  ext: string;
  abr: number | null;
}

export interface VideoInfo {
  platform: PlatformName;
  title: string;
  thumbnail: string;
  duration: number | null;
  uploader: string;
  webpage_url: string;
  previewUrl?: string;
  previewMime?: string;
  qualities: QualityOption[];
  audioOnly: AudioOption[];
  isPrivate?: boolean;
  cookiesRequired?: boolean;
}

interface YtdlpFormat {
  format_id?: string;
  ext?: string;
  height?: number;
  fps?: number;
  filesize?: number;
  tbr?: number;
  abr?: number;
  vcodec?: string;
  acodec?: string;
  url?: string;
  protocol?: string;
}

export function isValidUrl(url: string): boolean {
  return Boolean(normalizeUrl(url));
}

function getReferer(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    if (hostname.includes("instagram.com")) {
      return "https://www.instagram.com/";
    }

    if (
      hostname.includes("facebook.com") ||
      hostname.includes("fbcdn.net")
    ) {
      return "https://www.facebook.com/";
    }

    if (hostname.includes("tiktok.com")) {
      return "https://www.tiktok.com/";
    }

    if (
      hostname.includes("twitter.com") ||
      hostname.includes("x.com")
    ) {
      return "https://twitter.com/";
    }

    if (hostname.includes("reddit.com")) {
      return "https://www.reddit.com/";
    }

    if (hostname.includes("vimeo.com")) {
      return "https://vimeo.com/";
    }
  } catch {
    //
  }

  return "https://www.google.com/";
}

function formatContentType(ext: string): string {
  switch (ext.toLowerCase()) {
    case "mp4":
      return "video/mp4";

    case "webm":
      return "video/webm";

    case "m4a":
      return "audio/mp4";

    case "mp3":
      return "audio/mpeg";

    case "ogg":
      return "audio/ogg";

    case "wav":
      return "audio/wav";

    default:
      return "application/octet-stream";
  }
}

function getCommonHeaders(url: string): string[] {
  const referer = getReferer(url);

  return [
    "--add-header",
    `Referer:${referer}`,

    "--add-header",
    `User-Agent:${USER_AGENT}`,
  ];
}

function getYtdlpArgs(url: string): string[] {
  const args = [
    "--dump-single-json",
    "--no-playlist",
    "--no-warnings",
    "--extractor-retries",
    "3",
    "--socket-timeout",
    "30",
    "--ignore-config",
    "--no-call-home",
    "--prefer-free-formats",
    "--no-progress",
    "--geo-bypass",

    ...getCommonHeaders(url),
  ];

  if (hasInstagramCookies() && getInstagramCookiesPath()) {
    args.push("--cookies", String(getInstagramCookiesPath()));
  }

  args.push(url);

  return args;
}

function isTemporaryYtdlpError(message: string): boolean {
  const normalized = message.toLowerCase();

  return [
    "http error",
    "download error",
    "unable to download",
    "timeout",
    "timed out",
    "connection",
  ].some((item) => normalized.includes(item));
}

function runYtDlp(args: string[]): Promise<string> {
  let attempts = 0;

  return new Promise((resolve, reject) => {
    const execute = () => {
      attempts++;

      const bin = getYtdlpBinary();

      if (!fs.existsSync(bin)) {
        reject(
          new Error(`yt-dlp binary not found at ${bin}`)
        );

        return;
      }

      const proc = spawn(bin, args, {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on("error", (err) => {
        reject(
          new Error(`Failed to start yt-dlp: ${err.message}`)
        );
      });

      proc.on("close", (code) => {
        const errorMessage = stderr.trim();

        if (code === 0) {
          resolve(stdout);
          return;
        }

        if (
          attempts < MAX_YTDLP_ATTEMPTS &&
          isTemporaryYtdlpError(errorMessage)
        ) {
          setTimeout(execute, attempts * 1000);
          return;
        }

        reject(
          new Error(
            `yt-dlp exited with code ${
              code ?? "unknown"
            }: ${errorMessage}`
          )
        );
      });
    };

    execute();
  });
}

function choosePreviewFormat(
  formats: YtdlpFormat[]
): YtdlpFormat | null {
  const validFormats = formats.filter(
    (format) =>
      format.url &&
      format.vcodec &&
      format.vcodec !== "none"
  );

  if (validFormats.length === 0) {
    return null;
  }

  return validFormats.sort(
    (a, b) => Number(b.height ?? 0) - Number(a.height ?? 0)
  )[0];
}

function getPreviewData(format: YtdlpFormat | null) {
  if (!format?.url) {
    return null;
  }

  return {
    previewUrl: String(format.url),
    previewMime: format.ext
      ? formatContentType(format.ext)
      : "application/octet-stream",
  };
}

export async function getVideoInfo(
  url: string
): Promise<VideoInfo> {
  const normalizedUrl = normalizeUrl(url);

  if (!normalizedUrl) {
    throw new Error("Invalid URL provided.");
  }

  const platform = getPlatform(normalizedUrl);

  try {
    const raw = await runYtDlp(
      getYtdlpArgs(normalizedUrl)
    );

    const data = JSON.parse(raw) as Record<
      string,
      unknown
    >;

    const formats: YtdlpFormat[] = Array.isArray(data.formats)
      ? (data.formats as YtdlpFormat[])
      : [];

    const previewFormat =
      choosePreviewFormat(formats);

    const preview =
      getPreviewData(previewFormat);

    const videoFormats = formats.filter(
      (format) =>
        format.vcodec &&
        format.vcodec !== "none" &&
        typeof format.height === "number" &&
        format.height > 0
    );

    const audioFormats = formats.filter(
      (format) =>
        format.vcodec === "none" &&
        format.acodec &&
        format.acodec !== "none"
    );

    const bestAudio = audioFormats
      .slice()
      .sort(
        (a, b) => Number(b.abr ?? 0) - Number(a.abr ?? 0)
      )[0];

    const qualityMap: Record<number, YtdlpFormat> = {};

    for (const format of videoFormats) {
      const height = Number(format.height ?? 0);

      if (!height || !format.format_id) {
        continue;
      }

      const currentScore =
        Number(format.filesize ?? 0) +
        Number(format.tbr ?? 0) * 1000;

      const existing = qualityMap[height];

      const existingScore = existing
        ? Number(existing.filesize ?? 0) +
          Number(existing.tbr ?? 0) * 1000
        : -1;

      if (!existing || currentScore > existingScore) {
        qualityMap[height] = format;
      }
    }

    const qualities: QualityOption[] = Object.keys(
      qualityMap
    )
      .map(Number)
      .sort((a, b) => b - a)
      .map((height) => {
        const format = qualityMap[height];

        const hasAudio =
          format.acodec &&
          format.acodec !== "none";

        const needsMerge =
          !hasAudio && Boolean(bestAudio);

        const formatId =
          needsMerge && bestAudio?.format_id
            ? `${format.format_id}+${bestAudio.format_id}`
            : String(format.format_id);

        return {
          quality: `${height}p`,
          height,
          formatId,
          ext: String(format.ext ?? "mp4"),
          filesize: format.filesize ?? null,
          fps: format.fps ?? null,
          needsMerge,
        };
      });

    const audioOnly: AudioOption[] = audioFormats
      .slice()
      .sort(
        (a, b) => Number(b.abr ?? 0) - Number(a.abr ?? 0)
      )
      .slice(0, 4)
      .map((format) => ({
        quality: format.abr
          ? `${Math.round(format.abr)}kbps`
          : "audio",

        formatId: String(format.format_id ?? ""),
        ext: String(format.ext ?? "m4a"),
        abr: format.abr ?? null,
      }))
      .filter((item) => item.formatId);

    return {
      platform,
      title: String(
        data.title ?? data.fulltitle ?? "Unknown"
      ),

      thumbnail: String(data.thumbnail ?? ""),

      duration:
        typeof data.duration === "number"
          ? data.duration
          : null,

      uploader: String(
        data.uploader ?? data.channel ?? ""
      ),

      webpage_url: String(
        data.webpage_url ?? normalizedUrl
      ),

      previewUrl: preview?.previewUrl,
      previewMime: preview?.previewMime,

      qualities,
      audioOnly,

      isPrivate: Boolean(
        data.is_private || data.private
      ),

      cookiesRequired:
        platform === "instagram" &&
        /\/stories\//i.test(normalizedUrl) &&
        !hasInstagramCookies(),
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    throw new Error(
      `Unable to analyze this URL: ${message}`
    );
  }
}

export function spawnDownload(
  url: string,
  formatId: string,
  type: "video" | "audio"
): ReturnType<typeof spawn> {
  const normalizedUrl = normalizeUrl(url);

  if (!normalizedUrl) {
    throw new Error("Invalid download URL");
  }

  const commonArgs = [
    "--no-playlist",
    "--socket-timeout",
    "30",
    "--ignore-config",
    "--no-call-home",

    ...getCommonHeaders(normalizedUrl),
  ];

  if (hasInstagramCookies() && getInstagramCookiesPath()) {
    commonArgs.push("--cookies", String(getInstagramCookiesPath()));
  }

  const args =
    type === "audio"
      ? [
          "-f",
          formatId || "bestaudio",

          "-x",

          "--audio-format",
          "mp3",

          "--audio-quality",
          "0",

          "--ffmpeg-location",
          ffmpegPath || "",

          "-o",
          "-",

          ...commonArgs,

          normalizedUrl,
        ]
      : [
          "-f",
          formatId || "bestvideo+bestaudio/best",

          "--merge-output-format",
          "mp4",

          "--ffmpeg-location",
          ffmpegPath || "",

          "-o",
          "-",

          ...commonArgs,

          normalizedUrl,
        ];

  return spawn(getYtdlpBinary(), args, {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
}