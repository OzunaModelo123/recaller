import "server-only";

export function extractLoomId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (!u.hostname.includes("loom.com")) return null;
    const m = u.pathname.match(/\/share\/([a-zA-Z0-9-]+)/);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

function stripVttToText(s: string): string {
  if (!s.includes("WEBVTT")) {
    return s.trim();
  }
  return s
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
}

export async function extractLoomTranscript(url: string): Promise<string | null> {
  const id = extractLoomId(url);
  if (!id) {
    throw new Error("Invalid Loom URL. Expected a loom.com/share/… link.");
  }

  const tryJson = async (endpoint: string): Promise<string | null> => {
    try {
      const res = await fetch(endpoint, {
        headers: { accept: "application/json" },
      });
      if (!res.ok) return null;
      const data: unknown = await res.json();
      if (typeof data === "string") {
        const t = stripVttToText(data);
        return t || null;
      }
      if (data && typeof data === "object") {
        const o = data as Record<string, unknown>;
        if (typeof o.text === "string" && o.text.trim()) return o.text.trim();
        if (Array.isArray(o.captions)) {
          const parts = o.captions
            .map((c) =>
              c && typeof c === "object" && "text" in c && typeof (c as { text: unknown }).text === "string"
                ? (c as { text: string }).text
                : "",
            )
            .filter(Boolean);
          const joined = parts.join(" ").trim();
          if (joined) return joined;
        }
      }
    } catch {
      return null;
    }
    return null;
  };

  for (const endpoint of [
    `https://www.loom.com/api/captions/${id}`,
    `https://www.loom.com/api/sessions/${id}/transcript`,
  ]) {
    const t = await tryJson(endpoint);
    if (t) return t;
  }

  try {
    const vttRes = await fetch(`https://cdn.loom.com/assets/json/transcriptions/${id}.json`);
    if (vttRes.ok) {
      const j: unknown = await vttRes.json();
      if (typeof j === "string") {
        const t = stripVttToText(j);
        if (t) return t;
      }
      if (j && typeof j === "object" && "body" in j && typeof (j as { body: unknown }).body === "string") {
        const t = stripVttToText((j as { body: string }).body);
        if (t) return t;
      }
    }
  } catch {
    /* ignore */
  }

  return null;
}
