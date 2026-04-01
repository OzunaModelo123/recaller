import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const sourceDir = path.join(projectRoot, "node_modules", "@ffmpeg", "core", "dist", "esm");
const targetDir = path.join(projectRoot, "public", "ffmpeg");

async function main() {
  await mkdir(targetDir, { recursive: true });
  await cp(sourceDir, targetDir, { recursive: true, force: true });
  console.log("[copy-ffmpeg-assets] copied ffmpeg core assets to public/ffmpeg");
}

main().catch((error) => {
  console.error("[copy-ffmpeg-assets] failed", error);
  process.exit(1);
});
