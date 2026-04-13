"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { buildInviteRedirectTo } from "@/lib/auth/invite-redirect";
import {
  logPostgrestError,
  sanitizedPostgrestError,
} from "@/lib/supabase/sanitized-error";

export type InviteResult = { ok: true } | { ok: false; error: string };

export async function inviteTeamMember(
  _prev: InviteResult | null,
  formData: FormData,
): Promise<InviteResult> {
  const raw = String(formData.get("email") ?? "").trim();
  const email = raw.toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  const { data: profile, error: profileErr } = await supabase
    .from("users")
    .select("id, org_id, role")
    .eq("id", user.id)
    .single();

  if (profileErr || !profile?.org_id) {
    return { ok: false, error: "No organization found for your account." };
  }
  if (profile.role !== "admin" && profile.role !== "super_admin") {
    return { ok: false, error: "Only organization admins can invite team members." };
  }

  const admin = createAdminClient();
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

  const { data: existingMember } = await admin
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingMember) {
    return {
      ok: false,
      error:
        "This email already belongs to a Recaller account. They can sign in with their existing credentials.",
    };
  }

  const { data: pending } = await supabase
    .from("invitations")
    .select("id")
    .eq("org_id", profile.org_id)
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();

  // Supabase invite OTPs expire quickly; however, we intentionally only allow one
  // row to be `pending` at a time. If there's already a pending invite, we mark it
  // as expired so admins can resend.
  if (pending) {
    const { error: expireErr } = await admin
      .from("invitations")
      .update({ status: "expired" })
      .eq("id", pending.id);

    if (expireErr) {
      logPostgrestError("team/invite expire pending", expireErr);
      return {
        ok: false,
        error: sanitizedPostgrestError(expireErr),
      };
    }
  }

  const { error: invErr } = await supabase.from("invitations").insert({
    org_id: profile.org_id,
    email,
    role: "employee",
    invited_by: profile.id,
  });

  if (invErr) {
    logPostgrestError("team/invite insert invitation", invErr);
    return { ok: false, error: sanitizedPostgrestError(invErr) };
  }

  const inviteRedirect = buildInviteRedirectTo(baseUrl, "/employee/setup-password");
  const { error: invAuthErr } = await admin.auth.admin.inviteUserByEmail(email, {
    // Supabase's invite redirect option name can differ between helpers/SDK versions.
    // We include both to ensure the user lands on our app to complete the invite flow.
    redirectTo: inviteRedirect,
    emailRedirectTo: inviteRedirect,
    data: {
      invited_org_id: profile.org_id,
    },
  } as unknown as Record<string, unknown>);

  if (invAuthErr) {
    await admin.from("invitations").delete().eq("org_id", profile.org_id).eq("email", email);
    const msg = invAuthErr.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered")) {
      return {
        ok: false,
        error:
          "This email is already registered in Supabase Auth. Remove the user from the Auth dashboard or use a different email.",
      };
    }
    console.error("[team/invite] inviteUserByEmail", invAuthErr);
    return {
      ok: false,
      error: "Could not send the invite email. Check Auth settings and try again.",
    };
  }

  revalidatePath("/dashboard/team");
  return { ok: true };
}
