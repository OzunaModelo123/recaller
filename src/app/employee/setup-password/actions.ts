"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out — try again.`)), ms);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(t);
        reject(e);
      });
  });
}

/**
 * Password + metadata must run server-side: the browser Supabase client often has no
 * refresh token after invite redirects ("Auth session missing!" on updateUser).
 *
 * Uses getSession() (cookie JWT) instead of getUser() to avoid long GoTrue round-trips
 * / refresh deadlocks during Server Actions.
 */
export async function completeEmployeePasswordSetupAction(
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (password.length < 8) {
      return { ok: false, error: "Password must be at least 8 characters." };
    }

    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const user = session?.user ?? null;
    if (!user) {
      return {
        ok: false,
        error: "Session expired. Open your invite link again or sign in.",
      };
    }

    let admin: ReturnType<typeof createAdminClient>;
    try {
      admin = createAdminClient();
    } catch {
      return {
        ok: false,
        error: "Server configuration error (missing Supabase service key).",
      };
    }

    const meta = user.user_metadata;
    const merged =
      meta && typeof meta === "object" && !Array.isArray(meta)
        ? { ...(meta as Record<string, unknown>) }
        : {};

    const { error } = await withTimeout(
      admin.auth.admin.updateUserById(user.id, {
        password,
        user_metadata: {
          ...merged,
          password_set_at: new Date().toISOString(),
        },
      }),
      25_000,
      "Password update",
    );

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (e) {
    console.error("[completeEmployeePasswordSetupAction]", e);
    return {
      ok: false,
      error:
        e instanceof Error ? e.message : "Something went wrong. Please try again.",
    };
  }
}
