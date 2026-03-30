import "server-only";
import { YoutubeTranscript } from "youtube-transcript";

export function extractYoutubeVideoId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      return id?.replace(/[^a-zA-Z0-9_-]/g, "") || null;
    }
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const m = u.pathname.match(/\/(?:embed|shorts|live)\/([a-zA-Z0-9_-]+)/);
      return m?.[1] ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function extractYouTubeTranscript(
  url: string,
): Promise<{ transcript: string; metadata: Record<string, unknown> }> {
  const videoId = extractYoutubeVideoId(url);
  if (!videoId) {
    throw new Error("Invalid YouTube URL. Use a standard watch, youtu.be, Shorts, or embed link.");
  }

  let raw: { text: string; offset: number; duration: number }[];
  try {
    raw = await YoutubeTranscript.fetchTranscript(videoId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/transcript|caption|disabled|unavailable|not exist/i.test(msg)) {
      throw new Error(
        "This video has no captions available. Please upload the video file directly for AI transcription.",
      );
    }
    throw new Error(`Could not fetch YouTube transcript: ${msg}`);
  }

  if (!raw?.length) {
    throw new Error(
      "This video has no captions available. Please upload the video file directly for AI transcription.",
    );
  }

  const lines = raw.map((seg) => {
    const start = (seg.offset / 1000).toFixed(1);
    return `[${start}s] ${seg.text}`;
  });
  const transcript = lines.join("\n");
  const last = raw[raw.length - 1];
  const durationSeconds = Math.round((last.offset + last.duration) / 1000);

  let title: string | undefined;
  try {
    const o = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url.trim())}&format=json`,
    );
    if (o.ok) {
      const j = (await o.json()) as { title?: string };
      title = j.title;
    }
  } catch {
    /* optional metadata */
  }

  return {
    transcript,
    metadata: { title, durationSeconds, videoId },
  };
}
