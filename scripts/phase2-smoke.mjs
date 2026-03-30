/**
 * Phase 2 smoke checks (no Next.js, no Supabase).
 * youtube-transcript: use ESM build (package "main" points at broken CJS under "type":"module").
 * Run: node scripts/phase2-smoke.mjs
 */
import { YoutubeTranscript } from "youtube-transcript/dist/youtube-transcript.esm.js";
import { PDFParse } from "pdf-parse";

const ytId = "dQw4w9WgXcQ";

console.log("\n=== YouTube transcript (youtube-transcript ESM) ===");
const segments = await YoutubeTranscript.fetchTranscript(ytId);
console.log("Segments:", segments.length);
console.log("First line:", (segments[0]?.text ?? "").slice(0, 100));

const minimalPdf = Buffer.from(
  [
    "%PDF-1.1\n1 0 obj<<>>endobj\n2 0 obj<</Length 44>>stream\nBT /F1 12 Tf 100 700 Td (Hello Phase2) Tj ET\nendstream\nendobj\n",
    "3 0 obj<</Type/Page/Parent 4 0 R/MediaBox[0 0 612 792]/Contents 2 0 R>>endobj\n",
    "4 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n",
    "5 0 obj<</Type/Catalog/Pages 4 0 R>>endobj\n",
    "xref\n0 6\n0000000000 65535 f \ntrailer<</Size 6/Root 5 0 R>>\nstartxref\n200\n%%EOF\n",
  ].join(""),
);

console.log("\n=== PDF text (pdf-parse / PDFParse) ===");
const parser = new PDFParse({ data: minimalPdf });
try {
  const { text } = await parser.getText();
  console.log("Extracted:", JSON.stringify(text.trim()));
} finally {
  await parser.destroy();
}

console.log("\n=== Phase 2 library smoke: OK ===\n");
