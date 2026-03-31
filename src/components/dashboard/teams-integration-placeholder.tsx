import { MessageSquareMore } from "lucide-react";

type Props = {
  /** Admin sees workspace-level copy; employee sees personal copy. */
  variant: "admin" | "employee";
};

export function TeamsIntegrationPlaceholder({ variant }: Props) {
  const isAdmin = variant === "admin";
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary">
          <MessageSquareMore className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-foreground">Microsoft Teams</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin
              ? "When available, you will connect your Microsoft 365 tenant here so employees can complete training in Teams, the same way as Slack."
              : "When your org enables it, you will link Teams here to get plans and step actions inside Microsoft Teams."}
          </p>
          <div className="mt-4 inline-flex rounded-lg border border-border bg-secondary px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
            Coming soon
          </div>
        </div>
      </div>
    </div>
  );
}
