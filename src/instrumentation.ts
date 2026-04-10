import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }

  // ── Inngest auto-sync ─────────────────────────────────────────────────────
  // On Vercel, VERCEL_URL is automatically set to the deployment URL on every
  // deploy (e.g. "recaller.vercel.app"). We use it to tell Inngest Cloud where
  // this app lives so it can execute background functions automatically.
  //
  // Without this, events sent via inngest.send() queue up in Inngest Cloud
  // forever because Inngest doesn't know which URL to call to run the functions.
  //
  // This replaces the need for the Inngest Vercel Integration or any manual
  // "sync app" step in the Inngest dashboard. It runs on every cold start /
  // new deployment automatically.
  // ─────────────────────────────────────────────────────────────────────────
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.VERCEL_URL) {
    // Use the custom production URL if set, otherwise fall back to the
    // Vercel-generated deployment URL. VERCEL_URL is always set by Vercel.
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL &&
      !process.env.NEXT_PUBLIC_APP_URL.includes("localhost")
        ? process.env.NEXT_PUBLIC_APP_URL
        : `https://${process.env.VERCEL_URL}`;

    // Fire-and-forget: don't block instrumentation on the sync result.
    // The PUT to /api/inngest tells the Inngest SDK to register this deployment
    // with Inngest Cloud using the signing key already in env vars.
    void fetch(`${appUrl}/api/inngest`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => {
        console.log(`[inngest] auto-sync status: ${res.status} (${appUrl})`);
      })
      .catch((err: unknown) => {
        // Non-fatal. Inngest will still work if manually synced once from dashboard.
        console.warn("[inngest] auto-sync failed:", err instanceof Error ? err.message : err);
      });
  }
}

export const onRequestError = Sentry.captureRequestError;

