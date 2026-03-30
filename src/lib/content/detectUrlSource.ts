export type UrlSourceType = "youtube" | "vimeo" | "loom" | "web_article";

export function detectUrlSource(url: string): UrlSourceType | null {
  try {
    const u = new URL(url.trim());
    const h = u.hostname.toLowerCase();
    if (h === "youtu.be" || h.includes("youtube.com")) return "youtube";
    if (h.includes("vimeo.com")) return "vimeo";
    if (h.includes("loom.com")) return "loom";
    return "web_article";
  } catch {
    return null;
  }
}
