import "server-only";

export function extractVimeoId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (!u.hostname.includes("vimeo.com")) return null;
    const m = u.pathname.match(/\/(\d+)/);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

function vttToPlain(vtt: string): string | null {
  const text = vtt
    .split("\n")
    .filter(
      (line) =>
        line &&
        !line.startsWith("WEBVTT") &&
        !/^\d+$/.test(line.trim()) &&
        !line.includes("-->"),
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

export async function extractVimeoTranscript(url: string): Promise<string | null> {
  const id = extractVimeoId(url);
  if (!id) {
    throw new Error("Invalid Vimeo URL.");
  }

  const token = process.env.VIMEO_ACCESS_TOKEN;
  if (!token) {
    return null;
  }

  const tracks = await fetch(`https://api.vimeo.com/videos/${id}/texttracks`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!tracks.ok) return null;

  const body = (await tracks.json()) as {
    data?: { link?: string; active?: boolean }[];
  };
  const list = body.data ?? [];
  const track = list.find((t) => t.active) ?? list[0];
  if (!track?.link) return null;

  const vttRes = await fetch(track.link);
  if (!vttRes.ok) return null;
  const raw = await vttRes.text();
  return vttToPlain(raw);
}
