import { Check, MessageSquare } from "lucide-react";

import { EmployeeSlackConnectPanel } from "@/components/employee/slack-connect-panel";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  slackResult: string | null;
  slackReason: string | null;
  /** Org has connected Slack workspace (admin install). */
  workspaceSlackConnected: boolean;
  /** Employee completed Link Slack flow. */
  employeeSlackLinked: boolean;
};

/**
 * Slack block for /employee/integrations — all states (no workspace / link / linked).
 */
export function EmployeeSlackIntegrationCard({
  slackResult,
  slackReason,
  workspaceSlackConnected,
  employeeSlackLinked,
}: Props) {
  if (!workspaceSlackConnected) {
    return (
      <Card className="border-border shadow-[var(--shadow-card)]">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-foreground">Slack</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your organization has not connected Slack yet. Ask an admin to open{" "}
                <span className="font-medium text-foreground">Dashboard → Integrations</span> (or
                Settings) and connect the workspace. After that, you can link your own Slack account
                here.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (employeeSlackLinked) {
    return (
      <Card className="border-green-200/80 bg-green-50/50 shadow-[var(--shadow-card)] dark:border-green-900/40 dark:bg-green-950/20">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-green-200 bg-green-100 dark:border-green-900 dark:bg-green-900/40">
              <Check className="h-5 w-5 text-green-700 dark:text-green-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-foreground">Slack connected</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your Slack account is linked. Assigned plans appear as direct messages from Recaller.
                Use <span className="font-medium text-foreground">Mark step complete</span> in Slack
                or finish steps on the web — both stay in sync.
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                To change Slack accounts, ask your admin to disconnect the workspace and reconnect,
                or contact support — self-serve relink is coming later.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <EmployeeSlackConnectPanel slackResult={slackResult} slackReason={slackReason} />
  );
}
