"use client";

import { useState } from "react";
import { MessageSquare, Check, X, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  slackResult: string | null;
  slackReason: string | null;
};

const REASON_MESSAGES: Record<string, string> = {
  slack_email_not_found:
    "Your Recaller email was not found in the Slack workspace. Make sure you use the same email in both Slack and Recaller, or ask your admin to check.",
  workspace_not_installed:
    "Your admin hasn't connected Slack yet. Ask them to set it up in Settings first.",
  no_bot_token:
    "The Slack workspace connection is incomplete. Ask your admin to reconnect Slack in Settings.",
  employee_flow_only: "This link is for employees only.",
};

export function EmployeeSlackConnectPanel({ slackResult, slackReason }: Props) {
  const [loading, setLoading] = useState(false);

  function handleClick() {
    setLoading(true);
  }

  const friendlyError =
    slackReason && REASON_MESSAGES[slackReason]
      ? REASON_MESSAGES[slackReason]
      : slackReason
        ? `Could not connect: ${slackReason}`
        : null;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Slack</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Link your Slack account to receive assigned plans as DMs and complete steps directly
            in Slack. We match you by your email address in the workspace — no extra sign-in needed.
          </p>
        </div>
        <Button size="sm" asChild onClick={handleClick} disabled={loading}>
          <a href="/api/slack/employee/install">
            {loading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
            )}
            {loading ? "Linking…" : "Link Slack"}
          </a>
        </Button>
      </div>

      {slackResult === "success" && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-900/20 dark:text-green-400">
          <Check className="mr-1.5 inline h-4 w-4" />
          Slack linked! You'll receive training plans as DMs.
        </div>
      )}

      {slackResult === "error" && friendlyError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
          <X className="mr-1.5 inline h-4 w-4" />
          {friendlyError}
        </div>
      )}
    </div>
  );
}
