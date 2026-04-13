import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

/**
 * Employee invite password step — Route Handler (not a Server Action) so responses are
 * always normal JSON and cookie/session edge cases don’t break the RSC action protocol.
 */
export async function POST(request: NextRequest) {
  try {
    let body: { password?: string };
    try {
      body = (await request.json()) as { password?: string };
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
    }

    const password = String(body.password ?? "").trim();
    if (password.length < 8) {
      return NextResponse.json(
        { ok: false, error: "Password must be at least 8 characters." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json(
        {
          ok: false,
          error: "Session expired. Open your invite link again or sign in.",
        },
        { status: 401 },
      );
    }

    const user = session.user;

    let admin: ReturnType<typeof createAdminClient>;
    try {
      admin = createAdminClient();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Server is missing Supabase service configuration." },
        { status: 500 },
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
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/employee/setup-password]", e);
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Server error. Try again.",
      },
      { status: 500 },
    );
  }
}
