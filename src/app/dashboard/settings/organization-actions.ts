"use server";

import { revalidatePath } from "next/cache";

import {
  ORG_LOGOS_BUCKET,
  validateLogoFile,
  validateOrgName,
  candidateLogoObjectPaths,
  orgLogoObjectPathFromPublicUrl,
} from "@/lib/dashboard/organization-org";
import { createClient } from "@/lib/supabase/server";
import {
  logPostgrestError,
  sanitizedPostgrestError,
} from "@/lib/supabase/sanitized-error";

export type OrgActionResult = { ok: true } | { ok: false; error: string };

async function requireAdminOrg(supabase: Awaited<ReturnType<typeof createClient>>): Promise<
  | { ok: true; orgId: string }
  | { ok: false; error: string }
> {
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
    return { ok: false, error: "Only admins can update organization settings." };
  }
  return { ok: true, orgId: profile.org_id };
}

function revalidateOrgSurfaces() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
}

export async function updateOrganizationName(name: string): Promise<OrgActionResult> {
  const supabase = await createClient();
  const auth = await requireAdminOrg(supabase);
  if (!auth.ok) return auth;

  const validated = validateOrgName(name);
  if (!validated.ok) return validated;

  const { error } = await supabase
    .from("organisations")
    .update({ name: validated.name })
    .eq("id", auth.orgId);

  if (error) {
    logPostgrestError("settings/updateOrganizationName", error);
    return { ok: false, error: sanitizedPostgrestError(error) };
  }

  revalidateOrgSurfaces();
  return { ok: true };
}

export async function uploadOrganizationLogo(formData: FormData): Promise<OrgActionResult> {
  const supabase = await createClient();
  const auth = await requireAdminOrg(supabase);
  if (!auth.ok) return auth;

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return { ok: false, error: "No file uploaded." };
  }

  const validated = validateLogoFile(file);
  if (!validated.ok) return validated;

  await supabase.storage
    .from(ORG_LOGOS_BUCKET)
    .remove(candidateLogoObjectPaths(auth.orgId));

  const objectPath = `${auth.orgId}/logo.${validated.extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(ORG_LOGOS_BUCKET)
    .upload(objectPath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error("[settings/uploadOrganizationLogo]", uploadError.message);
    return { ok: false, error: "Could not upload logo. Please try again." };
  }

  const { data: pub } = supabase.storage.from(ORG_LOGOS_BUCKET).getPublicUrl(objectPath);
  const publicUrl = pub.publicUrl;

  const { error: dbError } = await supabase
    .from("organisations")
    .update({ logo_url: publicUrl })
    .eq("id", auth.orgId);

  if (dbError) {
    logPostgrestError("settings/uploadOrganizationLogo/db", dbError);
    await supabase.storage.from(ORG_LOGOS_BUCKET).remove([objectPath]);
    return { ok: false, error: sanitizedPostgrestError(dbError) };
  }

  revalidateOrgSurfaces();
  return { ok: true };
}

export async function removeOrganizationLogo(): Promise<OrgActionResult> {
  const supabase = await createClient();
  const auth = await requireAdminOrg(supabase);
  if (!auth.ok) return auth;

  const { data: orgRow } = await supabase
    .from("organisations")
    .select("logo_url")
    .eq("id", auth.orgId)
    .single();

  const path = orgLogoObjectPathFromPublicUrl(orgRow?.logo_url ?? null);
  if (path) {
    await supabase.storage.from(ORG_LOGOS_BUCKET).remove([path]);
  } else {
    await supabase.storage.from(ORG_LOGOS_BUCKET).remove(candidateLogoObjectPaths(auth.orgId));
  }

  const { error } = await supabase
    .from("organisations")
    .update({ logo_url: null })
    .eq("id", auth.orgId);

  if (error) {
    logPostgrestError("settings/removeOrganizationLogo", error);
    return { ok: false, error: sanitizedPostgrestError(error) };
  }

  revalidateOrgSurfaces();
  return { ok: true };
}
