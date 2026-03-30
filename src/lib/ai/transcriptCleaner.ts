/**
 * Normalizes raw transcript text before LLM analysis / embedding.
 */
export function cleanTranscript(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
