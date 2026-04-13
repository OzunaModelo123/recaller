"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Password + metadata must run server-side: the browser Supabase client often has no
 * refresh token after invite redirects ("Auth session missing!" on updateUser).
 */
export async function completeEmployeePasswordSetupAction(
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: "Session expired. Open your invite link again or sign in.",
    };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password,
    user_metadata: {
      ...(user.user_metadata ?? {}),
      password_set_at: new Date().toISOString(),
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
