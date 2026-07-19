import { NextRequest, NextResponse } from "next/server";
import { buildProxyHeaders } from "@/lib/proxy";
import { isTrustedProxyUrl, normalizeUrl } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")?.trim() ?? "";

  if (!url) {
    return NextResponse.json(
      { success: false, error: "Missing url parameter." },
      { status: 400 }
    );
  }

  const normalizedUrl = normalizeUrl(url);

  if (!normalizedUrl || !isTrustedProxyUrl(normalizedUrl)) {
    return NextResponse.json(
      { success: false, error: "URL is not allowed for proxying." },
      { status: 400 }
    );
  }

  try {
    const upstream = await fetch(normalizedUrl, {
      method: "GET",
      headers: {
        ...buildProxyHeaders(normalizedUrl),
        Range: req.headers.get("range") || "",
      },
      cache: "no-store",
    });

    if (!upstream.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Unable to fetch remote resource: ${upstream.status}`,
        },
        { status: 502 }
      );
    }

    const headers = new Headers();

    const contentType =
      upstream.headers.get("content-type") ||
      "application/octet-stream";

    headers.set("Content-Type", contentType);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Cross-Origin-Resource-Policy", "cross-origin");
    headers.set("Cross-Origin-Embedder-Policy", "unsafe-none");

    const contentLength = upstream.headers.get("content-length");
    const acceptRanges = upstream.headers.get("accept-ranges");
    const contentRange = upstream.headers.get("content-range");

    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }

    if (acceptRanges) {
      headers.set("Accept-Ranges", acceptRanges);
    }

    if (contentRange) {
      headers.set("Content-Range", contentRange);
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        success: false,
        error: `Proxy request failed: ${message}`,
      },
      { status: 500 }
    );
  }
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Range",
    },
  });
}