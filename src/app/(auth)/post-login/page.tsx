import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { provisionSignupIfNeeded } from "@/lib/auth/provisionSignup";
import { sanitizeInternalNext } from "@/lib/auth/safe-next";
import { PostLoginSessionRecover } from "./session-recover";

export default async function PostLoginPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const nextParam = searchParams.next;
  const next =
    typeof nextParam === "string"
      ? sanitizeInternalNext(nextParam)
      : "/post-login";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <PostLoginSessionRecover />;
  }

  const admin = createAdminClient();

  let { data: profile, error: profileErr } = await admin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileErr) {
    console.error("[post-login] initial users select", profileErr);
  }

  if (!profile) {
    const provisioned = await provisionSignupIfNeeded(supabase, user);
    if (!provisioned.ok) {
      redirect(`/login?error=${encodeURIComponent(provisioned.error)}`);
    }
    for (let attempt = 0; attempt < 8; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 75 * attempt));
      }
      const { data: refetched, error: refetchErr } = await admin
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (refetchErr) {
        console.error("[post-login] refetch users", refetchErr);
      }
      if (refetched) {
        profile = refetched;
        break;
      }
    }
  }

  if (!profile) {
    redirect(
      `/login?error=${encodeURIComponent("Account could not be loaded. Clear session and open your invite link again.")}`,
    );
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
    if (next.startsWith("/employee")) {
      redirect(next);
    }
    redirect("/employee");
  }

  if (next.startsWith("/dashboard")) {
    redirect(next);
  }
  redirect("/dashboard");
}
