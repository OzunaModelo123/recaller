/**
 * `inviteUserByEmail` redirect: land on `/login` so the hash fragment (`#access_token=…`)
 * is handled in the browser (fragments are never sent to the server).
 * Add `https://YOUR_DOMAIN/login*` to Supabase Auth → Redirect URLs (wildcard covers `?next=`).
 */
export function buildInviteRedirectTo(baseUrl: string, next: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/login?next=${encodeURIComponent(next)}`;
}
