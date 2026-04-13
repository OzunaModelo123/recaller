import {
  createClient as createSupabaseJsClient,
  type User,
} from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function bearerToken(request: NextRequest): string | null {
  const raw = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!raw?.toLowerCase().startsWith("bearer ")) return null;
  const t = raw.slice(7).trim();
  return t.length > 0 ? t : null;
}

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

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url?.trim() || !anon?.trim()) {
      return NextResponse.json(
        { ok: false, error: "Server misconfiguration (Supabase URL/key)." },
        { status: 500 },
      );
    }

    const token = bearerToken(request);
    let user: User | null = null;

    if (token) {
      const supa = createSupabaseJsClient(url, anon);
      const { data, error } = await supa.auth.getUser(token);
      if (!error && data.user) {
        user = data.user;
      }
    }

    if (!user) {
      const supabase = await createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      user = session?.user ?? null;
    }

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Session expired. Open your invite link again in this same browser, then set your password.",
        },
        { status: 401 },
      );
    }

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
