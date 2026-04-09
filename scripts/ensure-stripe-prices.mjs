/**
 * Creates Recaller Starter (monthly $25/seat) and Growth (annual $240/seat) prices in Stripe
 * if STRIPE_*_PRICE_ID are missing from .env.local. Run: node scripts/ensure-stripe-prices.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env.local");

function getEnvValue(raw, key) {
  const m = raw.match(new RegExp(`^${key}=(.*)$`, "m"));
  return m ? m[1].trim() : "";
}

function setOrAppendEnv(raw, key, value) {
  if (raw.includes(`${key}=`)) {
    return raw.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${value}`);
  }
  return raw.trimEnd() + `\n${key}=${value}\n`;
}

async function main() {
  let raw = fs.readFileSync(envPath, "utf8");
  const sk = getEnvValue(raw, "STRIPE_SECRET_KEY");
  if (!sk) {
    console.error("STRIPE_SECRET_KEY missing in .env.local");
    process.exit(1);
  }

  let starterId = getEnvValue(raw, "STRIPE_STARTER_PRICE_ID");
  let growthId = getEnvValue(raw, "STRIPE_GROWTH_PRICE_ID");

  if (starterId && growthId) {
    console.log("STRIPE_STARTER_PRICE_ID and STRIPE_GROWTH_PRICE_ID already set; nothing to do.");
    console.log({ starterId, growthId });
    return;
  }

  const stripe = new Stripe(sk, { apiVersion: "2026-03-25.dahlia" });

  if (!starterId) {
    const product = await stripe.products.create({
      name: "Recaller Starter",
      description: "Per-seat monthly (dashboard checkout)",
    });
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: 2500,
      currency: "usd",
      recurring: { interval: "month" },
      nickname: "Recaller Starter monthly per seat",
    });
    starterId = price.id;
    console.log("Created Starter price:", starterId);
  }

  if (!growthId) {
    const product = await stripe.products.create({
      name: "Recaller Growth",
      description: "Per-seat annual (dashboard checkout)",
    });
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: 24000,
      currency: "usd",
      recurring: { interval: "year" },
      nickname: "Recaller Growth annual per seat",
    });
    growthId = price.id;
    console.log("Created Growth price:", growthId);
  }

  raw = setOrAppendEnv(raw, "STRIPE_STARTER_PRICE_ID", starterId);
  raw = setOrAppendEnv(raw, "STRIPE_GROWTH_PRICE_ID", growthId);
  fs.writeFileSync(envPath, raw, "utf8");
  console.log("Updated .env.local with price IDs.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
