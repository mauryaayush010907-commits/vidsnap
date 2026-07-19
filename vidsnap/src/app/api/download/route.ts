import { NextRequest, NextResponse } from "next/server";
import { spawnDownload, isValidUrl } from "@/lib/ytdlp";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url") ?? "";
  const formatId = searchParams.get("formatId") ?? "";
  const type = (searchParams.get("type") ?? "video") as "video" | "audio";
  const filename = searchParams.get("filename") ?? "download";

  if (!url) {
    return NextResponse.json({ error: "Missing URL parameter" }, { status: 400 });
  }

  if (!isValidUrl(url)) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const safeFilename = filename
    .replace(/[^a-z0-9\-_ ]/gi, "_")
    .slice(0, 80)
    .trim() || "download";

  const contentType = type === "audio" ? "audio/mpeg" : "video/mp4";
  const ext = type === "audio" ? "mp3" : "mp4";
  const disposition = `attachment; filename="${safeFilename}.${ext}"`;

  try {
    // Spawn yt-dlp process
    const proc = spawnDownload(url, formatId, type);

    const stdout = proc.stdout;
    const stderr = proc.stderr;

    if (!stdout) {
      return NextResponse.json(
        { error: "Failed to start download process" },
        { status: 500 }
      );
    }

    // Build a readable stream from the child process stdout
    const stream = new ReadableStream({
      start(controller) {
        stdout.on("data", (chunk: Buffer) => {
          controller.enqueue(chunk);
        });

        stdout.on("end", () => {
          try { controller.close(); } catch { /* already closed */ }
        });

        stdout.on("error", (err: Error) => {
          console.error("[download stdout error]", err.message);
          try { controller.error(err); } catch { /* already errored */ }
        });

        if (stderr) {
          stderr.on("data", (d: Buffer) => {
            const msg = d.toString();
            if (msg.includes("ERROR")) {
              console.error("[yt-dlp stderr]", msg);
            }
          });
        }

        proc.on("close", (code: number | null) => {
          if (code !== 0 && code !== null) {
            console.error(`[download] yt-dlp exited with code ${code}`);
          }
          try { controller.close(); } catch { /* already closed */ }
        });

        proc.on("error", (err: Error) => {
          console.error("[download spawn error]", err.message);
          // If ENOENT error, provide helpful message
          if (err.message.includes("ENOENT")) {
            console.error("yt-dlp not found. Make sure youtube-dl-exec is installed.");
          }
          try { controller.error(err); } catch { /* already errored */ }
        });
      },
      cancel() {
        proc.kill("SIGTERM");
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": disposition,
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[download route error]", errorMsg);
    
    return NextResponse.json(
      { error: `Download failed: ${errorMsg}` },
      { status: 500 }
    );
  }
}
