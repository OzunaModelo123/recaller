/**
 * Ensures a Stripe **test mode** webhook endpoint exists for the production app URL.
 * Prints the signing secret (only on create). Run: node scripts/ensure-stripe-dashboard-webhook.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env.local");

function getEnv(raw, key) {
  const m = raw.match(new RegExp(`^${key}=(.*)$`, "m"));
  return m ? m[1].trim() : "";
}

const EVENTS = [
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
];

async function main() {
  const raw = fs.readFileSync(envPath, "utf8");
  const sk = getEnv(raw, "STRIPE_SECRET_KEY");
  if (!sk.startsWith("sk_test")) {
    console.warn(
      "Expected test secret key; for live mode create the webhook in Stripe Dashboard with live keys.",
    );
  }

  const appUrl =
    process.env.STRIPE_WEBHOOK_PUBLIC_URL?.trim() ||
    "https://recaller-seven.vercel.app";
  const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/stripe/webhooks`;

  const stripe = new Stripe(sk, { apiVersion: "2026-03-25.dahlia" });
  const { data: endpoints } = await stripe.webhookEndpoints.list({ limit: 100 });

  const match = endpoints.find((e) => e.url === webhookUrl);
  if (match) {
    console.log(
      `Webhook already exists for ${webhookUrl} (id=${match.id}). Signing secret is not shown again — copy it from Stripe Dashboard → Developers → Webhooks → endpoint, or delete the endpoint and re-run this script.`,
    );
    process.exit(0);
  }

  const created = await stripe.webhookEndpoints.create({
    url: webhookUrl,
    enabled_events: EVENTS,
    description: "Recaller (Vercel) — created by scripts/ensure-stripe-dashboard-webhook.mjs",
  });

  console.log("Created webhook endpoint:", created.id);
  console.log("STRIPE_WEBHOOK_SECRET for this endpoint (add to Vercel Production):");
  console.log(created.secret);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
