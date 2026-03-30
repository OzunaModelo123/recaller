import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SetupPasswordForm } from "./setup-password-form";

function inviteNeedsPassword(user: {
  user_metadata?: Record<string, unknown> | null;
}): boolean {
  const meta = user.user_metadata ?? {};
  const invited =
    typeof meta.invited_org_id === "string" && meta.invited_org_id.length > 0;
  const set =
    typeof meta.password_set_at === "string" && meta.password_set_at.length > 0;
  return invited && !set;
}

export default async function EmployeeSetupPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!inviteNeedsPassword(user)) {
    redirect("/post-login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/post-login");
  }

  if (profile.role === "admin" || profile.role === "super_admin") {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-stone-900">
          Set your password
        </h1>
        <p className="text-sm text-stone-500">
          Choose a password for your account before you can open training plans.
        </p>
      </div>
      <SetupPasswordForm />
      <p className="text-center text-xs text-stone-400">
        Wrong person?{" "}
        <Link href="/auth/signout" className="underline underline-offset-2">
          Sign out
        </Link>
      </p>
    </div>
  );
}
