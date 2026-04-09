"use server";

import { revalidatePath } from "next/cache";

import type { OrgContext } from "@/lib/ai/orgContext";
import { createClient } from "@/lib/supabase/server";
import {
  logPostgrestError,
  sanitizedPostgrestError,
} from "@/lib/supabase/sanitized-error";

export type SaveContextResult = { ok: true } | { ok: false; error: string };

export async function saveCompanyContext(
  orgContext: OrgContext,
  options: { completeOnboarding: boolean },
): Promise<SaveContextResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: profile, error: pErr } = await supabase
    .from("users")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (pErr || !profile) return { ok: false, error: "Profile not found" };
  if (profile.role !== "admin" && profile.role !== "super_admin") {
    return { ok: false, error: "Only admins can update company context" };
  }

  const update: Record<string, unknown> = {
    org_context: orgContext,
    industry: orgContext.industry || null,
    size: orgContext.employee_count || null,
  };
  if (options.completeOnboarding) {
    update.onboarding_completed = true;
  }

  const { error } = await supabase
    .from("organisations")
    .update(update)
    .eq("id", profile.org_id);

  if (error) {
    logPostgrestError("onboarding/saveCompanyContext", error);
    return { ok: false, error: sanitizedPostgrestError(error) };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/onboarding/context");
  return { ok: true };
}
