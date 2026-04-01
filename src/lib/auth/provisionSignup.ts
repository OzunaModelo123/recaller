import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export type ProvisionResult = { ok: true } | { ok: false; error: string };

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s,
  );
}

/**
 * Ensures `public.users` row exists for the auth user.
 *
 * - **Employer** (self-serve signup): `signup_as === "employer"` or legacy `org_name` → new org + admin.
 * - **Employee** (invite): `invited_org_id` in metadata + pending invitation row → join org as employee.
 * - **Legacy / unknown**: no flags at all → treat as employer so existing users aren't locked out.
 *
 * Uses the **service role** client for all DB reads/writes so RLS never blocks provisioning.
 */
export async function provisionSignupIfNeeded(
  _supabase: SupabaseClient,
  user: User,
): Promise<ProvisionResult> {
  try {
    const admin = createAdminClient();

    const { data: existing, error: existingErr } = await admin
      .from("users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (existingErr) {
      return { ok: false, error: existingErr.message };
    }
    if (existing) {
      return { ok: true };
    }

    const email = user.email?.trim().toLowerCase() ?? "";
    const invitedOrgRaw = user.user_metadata?.invited_org_id;
    const invitedOrgId =
      typeof invitedOrgRaw === "string" && isUuid(invitedOrgRaw)
        ? invitedOrgRaw
        : null;

    const fullName =
      String(user.user_metadata?.full_name ?? "").trim() ||
      user.email?.split("@")[0] ||
      "User";

    // ── Employee path (arrived via invitation email) ──
    if (invitedOrgId) {
      const { data: invitation, error: invErr } = await admin
        .from("invitations")
        .select("id")
        .eq("org_id", invitedOrgId)
        .ilike("email", email)
        .eq("status", "pending")
        .maybeSingle();

      if (invErr || !invitation) {
        return {
          ok: false,
          error:
            "No pending invitation found for this email. Ask your employer to invite you from Team settings.",
        };
      }

      const { error: userError } = await admin.from("users").insert({
        id: user.id,
        org_id: invitedOrgId,
        email,
        full_name: fullName,
        role: "employee",
      });

      if (userError) {
        return { ok: false, error: userError.message };
      }

      await admin
        .from("invitations")
        .update({ status: "accepted" })
        .eq("id", invitation.id);

      return { ok: true };
    }

    // ── Employer path (self-serve signup OR legacy user with no invite) ──
    // Any auth user without an invitation is treated as an employer creating a new org.
    // This keeps existing users (who signed up before the invite system) working.
    const orgName =
      String(user.user_metadata?.org_name ?? "").trim() || "New Organization";

    const { data: org, error: orgError } = await admin
      .from("organisations")
      .insert({ name: orgName })
      .select("id")
      .single();

    if (orgError || !org) {
      return {
        ok: false,
        error: orgError?.message ?? "Could not create organisation",
      };
    }

    const { error: userError } = await admin.from("users").insert({
      id: user.id,
      org_id: org.id,
      email,
      full_name: fullName,
      role: "admin",
    });

    if (userError) {
      await admin.from("organisations").delete().eq("id", org.id);
      return { ok: false, error: userError.message };
    }

    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const { error: subscriptionError } = await admin.from("subscriptions").upsert(
      {
        org_id: org.id,
        status: "trialing",
        plan_tier: "starter",
        seat_count: 1,
        seat_limit: 1,
        trial_ends_at: trialEndsAt,
      },
      { onConflict: "org_id" },
    );

    if (subscriptionError) {
      await admin.from("users").delete().eq("id", user.id);
      await admin.from("organisations").delete().eq("id", org.id);
      return { ok: false, error: subscriptionError.message };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }

  return { ok: true };
}
