import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthProfile = {
  userId: string;
  email: string | undefined;
  fullName: string;
  role: string;
  orgId: string | null;
};

/**
 * Standardized auth check for Server Components.
 * Uses getUser() (server-verified) instead of getSession() (cookie-only).
 *
 * @param options.requireAdmin - If true, redirects non-admin/super_admin to /employee
 * @returns The authenticated user profile or redirects to /login
 */
export async function requireAuth(options?: {
  requireAdmin?: boolean;
}): Promise<AuthProfile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, role, org_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/post-login");
  }

  if (
    options?.requireAdmin &&
    profile.role !== "admin" &&
    profile.role !== "super_admin"
  ) {
    redirect("/employee");
  }

  return {
    userId: user.id,
    email: user.email,
    fullName: profile.full_name || user.email?.split("@")[0] || "User",
    role: profile.role,
    orgId: profile.org_id,
  };
}
