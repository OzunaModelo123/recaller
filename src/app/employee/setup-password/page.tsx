import Link from "next/link";
import { redirect } from "next/navigation";

import { SetupPasswordForm } from "./setup-password-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

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
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-sidebar/20 via-card to-primary/10 px-5 py-6 shadow-sm">
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/20 blur-2xl"
          aria-hidden
        />
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-sm font-bold text-foreground shadow-sm">
            R
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Welcome
            </p>
            <p className="text-sm font-medium text-foreground">
              Set up your Recaller account
            </p>
          </div>
        </div>
      </div>

      <Card className="shadow-none">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-xl font-semibold tracking-tight text-foreground">
            Create your password
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed text-muted-foreground">
            Choose a secure password to finish joining your team. After this, you&apos;ll land on
            your home dashboard with assigned training plans.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SetupPasswordForm />
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Wrong person?{" "}
        <Link href="/auth/signout" className="font-medium underline underline-offset-2">
          Sign out
        </Link>
      </p>
    </div>
  );
}
