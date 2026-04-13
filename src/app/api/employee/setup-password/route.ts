import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyEmployeeSetupToken } from "@/lib/auth/employee-setup-token";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler-client";

export const runtime = "nodejs";

/** GoTrue accepts string/boolean metadata; strip unknown shapes to avoid admin API failures. */
function safeUserMetadataPatch(meta: unknown): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return out;
  const m = meta as Record<string, unknown>;
  for (const k of ["invited_org_id", "full_name", "signup_as", "org_name"] as const) {
    const v = m[k];
    if (typeof v === "string" && v.length > 0) out[k] = v;
  }
  if (typeof m.email_verified === "boolean") {
    out.email_verified = m.email_verified;
  }
  return out;
}

function isInviteAwaitingPassword(user: {
  user_metadata?: Record<string, unknown> | null;
}): boolean {
  const meta = user.user_metadata ?? {};
  const invited =
    typeof meta.invited_org_id === "string" && meta.invited_org_id.length > 0;
  const set =
    typeof meta.password_set_at === "string" && meta.password_set_at.length > 0;
  return invited && !set;
}

/**
 * Employee invite password — identifies the user via a short-lived HMAC token minted on
 * the setup-password RSC (no cookie/Bearer dependency in this handler).
 */
export async function POST(request: NextRequest) {
  const { supabase: routeSupabase, applyCookies } = createSupabaseRouteHandlerClient(request);

  function json(body: unknown, status: number) {
    const res = NextResponse.json(body, { status });
    applyCookies(res);
    return res;
  }

  try {
    let body: { password?: string; setupToken?: string };
    try {
      body = (await request.json()) as { password?: string; setupToken?: string };
    } catch {
      return json({ ok: false, error: "Invalid request body." }, 400);
    }

    const password = String(body.password ?? "").trim();
    if (password.length < 8) {
      return json({ ok: false, error: "Password must be at least 8 characters." }, 400);
    }

    const setupToken = typeof body.setupToken === "string" ? body.setupToken.trim() : "";
    let userId = verifyEmployeeSetupToken(setupToken);

    if (!userId) {
      const {
        data: { user: sessionUser },
      } = await routeSupabase.auth.getUser();
      if (sessionUser && isInviteAwaitingPassword(sessionUser)) {
        userId = sessionUser.id;
      }
    }

    if (!userId) {
      return json(
        {
          ok: false,
          error:
            "We could not confirm your invite session. Refresh this page, or open your invite link again in the same browser, then set your password.",
        },
        401,
      );
    }

    let admin: ReturnType<typeof createAdminClient>;
    try {
      admin = createAdminClient();
    } catch {
      return json(
        { ok: false, error: "Server is missing Supabase service configuration." },
        500,
      );
    }

    const { data: authData, error: getErr } = await admin.auth.admin.getUserById(userId);
    if (getErr || !authData.user) {
      return json(
        { ok: false, error: "Account not found. Ask your admin to send a new invite." },
        401,
      );
    }

    const user = authData.user;
    if (!isInviteAwaitingPassword(user)) {
      return json(
        {
          ok: false,
          error: "Password is already set. Sign in with your email and password.",
        },
        403,
      );
    }

    const patch = safeUserMetadataPatch(user.user_metadata);

    const { error } = await admin.auth.admin.updateUserById(user.id, {
      password,
      user_metadata: {
        ...patch,
        password_set_at: new Date().toISOString(),
      },
    });

    if (error) {
      return json({ ok: false, error: error.message }, 400);
    }

    return json({ ok: true }, 200);
  } catch (e) {
    console.error("[api/employee/setup-password]", e);
    return json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Server error. Try again.",
      },
      500,
    );
  }
}
