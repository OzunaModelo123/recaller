"use client";

import { MessageSquareMore, Check } from "lucide-react";

type Props = {
  workspaceTeamsConnected: boolean;
  employeeTeamsLinked: boolean;
};

export function EmployeeTeamsIntegrationCard({
  workspaceTeamsConnected,
  employeeTeamsLinked,
}: Props) {
  if (!workspaceTeamsConnected) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary">
            <MessageSquareMore className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-foreground">Microsoft Teams</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Your organization hasn't connected Microsoft Teams yet. Ask your admin to set it up
              in Dashboard → Integrations.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary">
          <MessageSquareMore className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-foreground">Microsoft Teams</h3>
          {employeeTeamsLinked ? (
            <div className="mt-2 flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400">
              <Check className="h-4 w-4" />
              Your Teams account is linked. You'll receive training plans as Adaptive Cards in Teams.
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Your admin connected Teams for the workspace. Your account will be automatically linked
              if your Recaller email matches your Microsoft 365 email. If you're not receiving messages,
              ask your admin to re-run the Teams connection.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
