"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquareMore } from "lucide-react";

import { CsvExportButton } from "@/components/dashboard/csv-export-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import { cancelAssignmentsAction, pushAssignmentsToTeamsAction } from "./actions";

export type AssignmentRow = {
  id: string;
  planTitle: string;
  assigneeLabel: string;
  assignerLabel: string;
  status: string;
  dueLabel: string;
  createdLabel: string;
};

export function AssignmentsTable({ rows }: { rows: AssignmentRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const cancellableIds = rows
    .filter((r) => r.status !== "cancelled")
    .map((r) => r.id);
  const selectedCancellable = [...selected].filter((id) =>
    cancellableIds.includes(id),
  );

  const pushableIds = rows
    .filter((r) => r.status !== "cancelled")
    .map((r) => r.id);
  const selectedPushable = [...selected].filter((id) =>
    pushableIds.includes(id),
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === cancellableIds.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(cancellableIds));
    }
  }

  function cancelSelected() {
    setMessage(null);
    startTransition(async () => {
      const res = await cancelAssignmentsAction(selectedCancellable);
      if (!res.ok) {
        setMessage(res.error);
        return;
      }
      setSelected(new Set());
      router.refresh();
    });
  }

  function pushTeamsSelected() {
    setMessage(null);
    startTransition(async () => {
      const res = await pushAssignmentsToTeamsAction(selectedPushable);
      if (!res.ok) {
        setMessage(res.error);
        return;
      }
      const lines = res.results.map(
        (r) =>
          `${r.success ? "✓" : "✗"} ${rows.find((x) => x.id === r.assignmentId)?.planTitle ?? r.assignmentId.slice(0, 8)}: ${r.message}`,
      );
      setMessage(
        `Teams: ${res.sent} sent, ${res.failed} skipped/failed.\n${lines.join("\n")}`,
      );
      router.refresh();
    });
  }

  const csvRows = rows.map((r) => ({
    planTitle: r.planTitle,
    assignee: r.assigneeLabel,
    assignedBy: r.assignerLabel,
    status: r.status,
    due: r.dueLabel,
    created: r.createdLabel,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={cancellableIds.length === 0}
            onClick={toggleAll}
          >
            {selected.size === cancellableIds.length && cancellableIds.length > 0
              ? "Clear selection"
              : "Select active"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={selectedPushable.length === 0 || pending}
            onClick={pushTeamsSelected}
            title="Sends the assignment Adaptive Card to each assignee’s Teams chat (needs Teams connected + user linked)."
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <MessageSquareMore className="mr-1.5 h-4 w-4" />
                Send to Teams ({selectedPushable.length})
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={selectedCancellable.length === 0 || pending}
            onClick={cancelSelected}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              `Cancel selected (${selectedCancellable.length})`
            )}
          </Button>
        </div>
        <CsvExportButton
          filename="assignments"
          columns={[
            { key: "planTitle", header: "Plan" },
            { key: "assignee", header: "Assigned to" },
            { key: "assignedBy", header: "Assigned by" },
            { key: "status", header: "Status" },
            { key: "due", header: "Due" },
            { key: "created", header: "Created" },
          ]}
          rows={csvRows}
        />
      </div>
      {message ? (
        <pre className="whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-3 font-sans text-xs text-foreground">
          {message}
        </pre>
      ) : null}

      <div className="-mx-1 overflow-x-auto rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] sm:mx-0">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/25 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th className="w-10 px-4 py-3.5" />
              <th className="px-4 py-3.5 font-medium">Plan</th>
              <th className="px-4 py-3.5 font-medium">Assigned to</th>
              <th className="px-4 py-3.5 font-medium">Assigned by</th>
              <th className="px-4 py-3.5 font-medium">Status</th>
              <th className="px-4 py-3.5 font-medium">Due</th>
              <th className="px-4 py-3.5 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  No assignments yet. Create one to get started.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const canSelect = r.status !== "cancelled";
                return (
                  <tr
                    key={r.id}
                    className="border-b border-border transition-colors last:border-0 hover:bg-muted/20"
                  >
                    <td className="px-4 py-3.5">
                      {canSelect ? (
                        <Checkbox
                          checked={selected.has(r.id)}
                          onCheckedChange={() => toggle(r.id)}
                          aria-label={`Select assignment ${r.id}`}
                        />
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-foreground">
                      {r.planTitle}
                    </td>
                    <td className="px-4 py-3.5">{r.assigneeLabel}</td>
                    <td className="px-4 py-3.5">{r.assignerLabel}</td>
                    <td className="px-4 py-3.5 capitalize">{r.status}</td>
                    <td className="px-4 py-3.5">{r.dueLabel}</td>
                    <td className="px-4 py-3.5">{r.createdLabel}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
