import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { provisionSignupIfNeeded } from "@/lib/auth/provisionSignup";

export default async function PostLoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const admin = createAdminClient();

  let { data: profile } = await admin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    const provisioned = await provisionSignupIfNeeded(supabase, user);
    if (!provisioned.ok) {
      redirect(`/login?error=${encodeURIComponent(provisioned.error)}`);
    }
    const { data: refetched } = await admin
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    profile = refetched;
  }

  if (!profile) {
    redirect("/login?error=Account%20could%20not%20be%20loaded.");
  }

  if (profile.role === "employee") {
    const meta = user.user_metadata ?? {};
    const invitedOrg =
      typeof meta.invited_org_id === "string" && meta.invited_org_id.length > 0;
    const passwordSet =
      typeof meta.password_set_at === "string" && meta.password_set_at.length > 0;
    if (invitedOrg && !passwordSet) {
      redirect("/employee/setup-password");
    }
    redirect("/employee");
  }

  redirect("/dashboard");
}
