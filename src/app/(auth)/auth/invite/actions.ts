"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { provisionSignupIfNeeded } from "@/lib/auth/provisionSignup";

/**
 * Runs after browser `setSession` / `exchangeCodeForSession` so cookies are visible
 * server-side and `public.users` is provisioned before any hard navigation.
 */
export async function completeAuthProvisioningAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: "Session missing. Open your invite link again or sign in.",
    };
  }

  const provisioned = await provisionSignupIfNeeded(supabase, user);
  if (!provisioned.ok) {
    return provisioned;
  }

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[completeAuthProvisioningAction] users select", error);
    return {
      ok: false,
      error: "Account could not be loaded. Please try again or clear session.",
    };
  }

  if (!row) {
    return {
      ok: false,
      error: "Account could not be loaded. Please try again or clear session.",
    };
  }

  return { ok: true };
}
