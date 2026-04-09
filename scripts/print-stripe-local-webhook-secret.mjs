/**
 * Prints the Stripe CLI signing secret for local forwarding (matches STRIPE_WEBHOOK_SECRET in .env.local after refresh).
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const raw = fs.readFileSync(path.join(root, ".env.local"), "utf8");
const m = raw.match(/^STRIPE_SECRET_KEY=(.+)$/m);
const sk = m ? m[1].trim() : "";
if (!sk) {
  console.error("STRIPE_SECRET_KEY missing");
  process.exit(1);
}
const stripeBin = path.join(root, ".local/bin/stripe");
const r = spawnSync(stripeBin, ["listen", "--print-secret", "--api-key", sk], {
  encoding: "utf8",
});
if (r.status !== 0) {
  console.error(r.stderr || r.stdout);
  process.exit(r.status ?? 1);
}
process.stdout.write(r.stdout.trim());
