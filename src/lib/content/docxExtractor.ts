import "server-only";
import mammoth from "mammoth";

export async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value?.trim() ?? "";
  if (!text) {
    throw new Error("No text could be extracted from this document.");
  }
  return text;
}
