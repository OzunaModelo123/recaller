/**
 * Maps Supabase Auth errors to clearer copy for the UI.
 */
export function formatAuthError(err: { message: string; code?: string; status?: number }): string {
  const msg = err.message.toLowerCase();
  const code = err.code?.toLowerCase() ?? "";

  if (
    msg.includes("rate limit") ||
    code === "over_email_send_rate_limit" ||
    msg.includes("email rate limit")
  ) {
    return [
      "Supabase has temporarily limited confirmation emails for this project (too many sends in a short time).",
      "",
      "What you can do:",
      "• Wait about an hour and try again, or use another email address.",
      "• For local development: Dashboard → Authentication → Providers → Email → turn off “Confirm email” so sign-up returns a session immediately without sending mail.",
    ].join("\n");
  }

  return err.message;
}
