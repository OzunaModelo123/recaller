import "server-only";
import { PDFParse } from "pdf-parse";
import { CanvasFactory } from "pdf-parse/worker";

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer, CanvasFactory });
  try {
    const result = await parser.getText();
    const text = result.text?.trim() ?? "";
    if (!text) {
      throw new Error("No text could be extracted from this PDF (it may be image-only).");
    }
    return text;
  } finally {
    await parser.destroy();
  }
}
