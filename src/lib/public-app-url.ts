/**
 * Browser-visible app origin for OAuth, Slack callbacks, and invite links.
 * Production: set NEXT_PUBLIC_APP_URL to your canonical https URL (e.g. Vercel domain).
 * Previews: Vercel sets VERCEL_URL; we derive https:// from it when the public var is unset.
 */
export function getPublicAppOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//i, "");
    return `https://${host}`;
  }
  return "";
}

export function slackEventsRequestUrl(): string {
  const o = getPublicAppOrigin();
  return o ? `${o}/api/slack/events` : "";
}

export function slackOAuthRedirectUrl(): string {
  const o = getPublicAppOrigin();
  return o ? `${o}/api/slack/oauth` : "";
}
