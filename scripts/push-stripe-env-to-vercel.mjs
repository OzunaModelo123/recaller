/**
 * Pushes Stripe-related env vars from .env.local to Vercel Production.
 * Run from repo root: node scripts/push-stripe-env-to-vercel.mjs
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env.local");

function getEnv(raw, key) {
  const m = raw.match(new RegExp(`^${key}=(.*)$`, "m"));
  return m ? m[1].trim() : "";
}

function vercelEnvAdd(name, environment, value) {
  const r = spawnSync(
    "npx",
    ["vercel@latest", "env", "add", name, environment, "--value", value, "--yes", "--force"],
    { cwd: root, stdio: "inherit" },
  );
  if (r.status !== 0) {
    throw new Error(`vercel env add ${name} ${environment} failed`);
  }
}

async function main() {
  const raw = fs.readFileSync(envPath, "utf8");

  const productionWebhookSecret = process.env.STRIPE_VERCEL_WEBHOOK_SECRET?.trim();
  if (!productionWebhookSecret) {
    console.error(
      "Set STRIPE_VERCEL_WEBHOOK_SECRET to the whsec from scripts/ensure-stripe-dashboard-webhook.mjs (Dashboard webhook for recaller-seven.vercel.app).",
    );
    process.exit(1);
  }

  const pairs = [
    ["STRIPE_SECRET_KEY", getEnv(raw, "STRIPE_SECRET_KEY")],
    ["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", getEnv(raw, "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY")],
    ["STRIPE_STARTER_PRICE_ID", getEnv(raw, "STRIPE_STARTER_PRICE_ID")],
    ["STRIPE_GROWTH_PRICE_ID", getEnv(raw, "STRIPE_GROWTH_PRICE_ID")],
    ["STRIPE_WEBHOOK_SECRET", productionWebhookSecret],
    ["NEXT_PUBLIC_APP_URL", "https://recaller-seven.vercel.app"],
  ];

  for (const [k, v] of pairs) {
    if (!v) {
      console.error(`Missing ${k} in .env.local or args`);
      process.exit(1);
    }
    console.log(`Adding ${k} → production…`);
    vercelEnvAdd(k, "production", v);
  }

  console.log("Done. Redeploy on Vercel for env to apply.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
