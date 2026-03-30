"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

  if (pending) {
    return { ok: false, error: "An invitation is already pending for this email." };
  }

  const { error: invErr } = await supabase.from("invitations").insert({
    org_id: profile.org_id,
    email,
    role: "employee",
    invited_by: profile.id,
  });

  if (invErr) {
    return { ok: false, error: invErr.message };
  }

  const { error: invAuthErr } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${baseUrl}/callback`,
    data: {
      invited_org_id: profile.org_id,
    },
  });

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
    return { ok: false, error: invAuthErr.message };
  }

  revalidatePath("/dashboard/team");
  return { ok: true };
}
