import type { User } from "@supabase/supabase-js";

/** Invited employee who has not completed `/employee/setup-password` yet. */
export function employeeInviteNeedsPassword(user: User | null): boolean {
  if (!user) return false;
  const meta = user.user_metadata ?? {};
  const invited =
    typeof meta.invited_org_id === "string" && meta.invited_org_id.length > 0;
  const set =
    typeof meta.password_set_at === "string" && meta.password_set_at.length > 0;
  return invited && !set;
}
