"use client";

import Link from "next/link";
import { MessageSquareMore, Check, X, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  workspaceTeamsConnected: boolean;
  employeeTeamsLinked: boolean;
  teamsResult: string | null;
  teamsReason: string | null;
  /** For error hints (Entra redirect URI). */
  publicAppOrigin: string;
};

function reasonMessage(reason: string | null): string {
  switch (reason) {
    case "missing_app_url":
      return "App URL is not configured. Ask your admin to set NEXT_PUBLIC_APP_URL.";
    case "missing_teams_env":
      return "Teams is not fully configured on the server.";
    case "no_org":
      return "Your account is not assigned to an organization.";
    case "workspace_teams_not_connected":
      return "Your org has not connected Teams yet.";
    case "session_mismatch":
      return "Session changed during sign-in. Close other tabs and try again.";
    case "state_expired":
      return "Link timed out. Click Link again.";
    case "token_exchange_failed":
      return "Microsoft sign-in failed. Ask your admin to add the redirect URI below to Entra ID.";
    case "wrong_tenant":
      return "Sign in with the same Microsoft 365 work account your company uses for Teams.";
    case "graph_me_failed":
      return "Could not read your Microsoft profile. Your admin must add delegated permission User.Read and grant consent.";
    case "no_aad_id":
      return "Microsoft did not return a user id. Try again or contact support.";
    case "update_failed":
      return "Could not save the link. Try again.";
    default:
      return reason ? `Something went wrong (${reason}).` : "Something went wrong.";
  }
}

/**
 * Teams block on /employee/integrations — link flow when email sync did not match.
 */
export function EmployeeTeamsIntegrationCard({
  workspaceTeamsConnected,
  employeeTeamsLinked,
  teamsResult,
  teamsReason,
  publicAppOrigin,
}: Props) {
  if (!workspaceTeamsConnected) {
    return (
      <Card className="border-border shadow-[var(--shadow-card)]">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary">
              <MessageSquareMore className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-foreground">Microsoft Teams</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your organization has not connected Microsoft Teams yet. Ask an admin to connect it in{" "}
                <span className="font-medium text-foreground">Dashboard → Integrations</span>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (employeeTeamsLinked) {
    return (
      <Card className="border-green-200/80 bg-green-50/50 shadow-[var(--shadow-card)] dark:border-green-900/40 dark:bg-green-950/20">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-green-200 bg-green-100 dark:border-green-900 dark:bg-green-900/40">
              <Check className="h-5 w-5 text-green-700 dark:text-green-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-foreground">Teams linked</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your Microsoft account is linked. Training assignments can be sent to you in Teams as
                Adaptive Cards — use <span className="font-medium text-foreground">Complete step</span>{" "}
                on each step.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border shadow-[var(--shadow-card)]">
      <CardContent className="space-y-4 p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary">
            <MessageSquareMore className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-foreground">Microsoft Teams</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your org uses Teams for assignments. If your Recaller email is different from your
              Microsoft 365 sign-in, automatic matching may miss you — use{" "}
              <span className="font-medium text-foreground">Link my Teams account</span> below to
              connect the same account you use in Teams.
            </p>
            <div className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50/90 p-3 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-100">
              <p className="font-medium text-foreground">Use your work or school Microsoft account</p>
              <p className="mt-1.5 text-muted-foreground dark:text-amber-200/90">
                Personal Microsoft accounts (for example @outlook.com or @live.com) cannot sign in
                here unless your IT team has{" "}
                <span className="font-medium text-foreground">invited you as a guest</span> to the
                company directory. Choose the same account you use to open Teams for work. If you see
                “does not exist in tenant” or error AADSTS50020, you picked a personal account — try
                “Use another account” or ask your admin to invite your email to Microsoft 365.
              </p>
            </div>
          </div>
        </div>

        {teamsResult === "success" && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-900/20 dark:text-green-400">
            <Check className="mr-1.5 inline h-4 w-4" />
            Teams account linked successfully.
          </div>
        )}

        {teamsResult === "error" && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
            <X className="mr-1.5 inline h-4 w-4" />
            {reasonMessage(teamsReason)}
            {teamsReason === "token_exchange_failed" && publicAppOrigin ? (
              <code className="mt-2 block break-all rounded bg-background/60 px-1 py-1 text-[11px] text-foreground">
                {publicAppOrigin}/api/teams/employee/oauth
              </code>
            ) : null}
          </div>
        )}

        <Button asChild size="sm">
          <Link href="/api/teams/employee/install">
            <ExternalLink className="mr-2 h-4 w-4" />
            Link my Teams account
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
