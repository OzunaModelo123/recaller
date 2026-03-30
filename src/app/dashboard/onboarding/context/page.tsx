import { redirect } from "next/navigation";

import { parseOrgContext } from "@/lib/ai/orgContext";
import { createClient } from "@/lib/supabase/server";
import { CompanyContextOnboardingWizard } from "@/components/dashboard/company-context-forms";

export default async function OnboardingContextPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("org_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
    redirect("/dashboard");
  }

  const { data: org } = await supabase
    .from("organisations")
    .select("org_context, onboarding_completed")
    .eq("id", profile.org_id)
    .single();

  if (org?.onboarding_completed) {
    redirect("/dashboard");
  }

  const initial = parseOrgContext(org?.org_context);

  return <CompanyContextOnboardingWizard initial={initial} />;
}
