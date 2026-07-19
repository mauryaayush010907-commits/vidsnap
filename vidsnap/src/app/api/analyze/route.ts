import { NextRequest, NextResponse } from "next/server";
import { getVideoInfo } from "@/lib/ytdlp";
import { normalizeUrl } from "@/lib/validators";

export const dynamic = "force-dynamic";

const cache = new Map<string, { data: Awaited<ReturnType<typeof getVideoInfo>>; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = normalizeUrl(String(body.url ?? "").trim());

    if (!url) {
      return NextResponse.json({ success: false, error: "A valid URL is required." }, { status: 400 });
    }

    const cached = cache.get(url);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json({ success: true, data: cached.data }, { status: 200 });
    }

    const info = await getVideoInfo(url);

    cache.set(url, { data: info, ts: Date.now() });
    if (cache.size > 50) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
      if (oldest) cache.delete(oldest[0]);
    }

    return NextResponse.json({ success: true, data: info }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to analyze the URL.";
    console.error("[analyze]", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: message.includes("Invalid") ? 400 : 500 }
    );
  }
}
