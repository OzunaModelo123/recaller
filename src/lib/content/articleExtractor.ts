import "server-only";

function htmlToArticleText(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const article = withoutScripts.match(/<article[\s\S]*?<\/article>/i);
  const main = withoutScripts.match(/<main[\s\S]*?<\/main>/i);
  const chunk = article?.[0] ?? main?.[0] ?? withoutScripts;
  return chunk
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

export async function extractArticleText(url: string): Promise<string> {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    throw new Error("Invalid URL.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Only http(s) URLs are supported.");
  }

  const res = await fetch(u.toString(), {
    headers: {
      "user-agent": "RecallerBot/1.0",
      accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`Could not fetch page (${res.status}).`);
  }
  const html = await res.text();
  if (html.length > 5_000_000) {
    throw new Error("Page is too large to process.");
  }
  const text = htmlToArticleText(html);
  if (!text || text.length < 80) {
    throw new Error("Could not extract readable article text from this page.");
  }
  return text;
}
