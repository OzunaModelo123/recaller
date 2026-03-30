"use client";

import Link from "next/link";

import { CsvExportButton } from "@/components/dashboard/csv-export-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  completionPercent,
  trafficDotClass,
  trafficRowClass,
  trafficTier,
} from "@/lib/dashboard/evidence-summary";

export type TeamPerfRow = {
  userId: string;
  name: string;
  title: string | null;
  activeAssignments: number;
  completedSteps: number;
  expectedSteps: number;
  lastActivityIso: string | null;
};

type Tier = ReturnType<typeof trafficTier>;

function tierFromRow(row: TeamPerfRow): Tier {
  return trafficTier(
    row.expectedSteps > 0 ? row.completedSteps / row.expectedSteps : 0,
  );
}

function fmtActivity(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

export function TeamPerformanceClient({
  rows,
  from,
  to,
}: {
  rows: TeamPerfRow[];
  from?: string;
  to?: string;
}) {
  const csvRows = rows.map((r) => ({
    name: r.name,
    title: r.title || "",
    active: r.activeAssignments,
    completion: `${completionPercent(r.completedSteps, r.expectedSteps)}%`,
    lastActivity: fmtActivity(r.lastActivityIso),
  }));

  return (
    <div className="space-y-4">
      <form
        method="get"
        className="flex flex-col gap-3 rounded-xl border border-border bg-background/40 p-4 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="space-y-1.5">
          <Label htmlFor="from" className="text-xs">
            Last activity from
          </Label>
          <Input
            id="from"
            name="from"
            type="date"
            defaultValue={from ?? ""}
            className="w-full sm:w-auto"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to" className="text-xs">
            To
          </Label>
          <Input
            id="to"
            name="to"
            type="date"
            defaultValue={to ?? ""}
            className="w-full sm:w-auto"
          />
        </div>
        <Button type="submit" size="sm" variant="secondary">
          Apply filter
        </Button>
        {(from || to) && (
          <Button type="button" size="sm" variant="ghost" asChild>
            <Link href="/dashboard/team">Clear</Link>
          </Button>
        )}
      </form>

      <div className="flex justify-end">
        <CsvExportButton
          filename="team-performance"
          columns={[
            { key: "name", header: "Name" },
            { key: "title", header: "Title" },
            { key: "active", header: "Active assignments" },
            { key: "completion", header: "Completion rate" },
            { key: "lastActivity", header: "Last activity" },
          ]}
          rows={csvRows}
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-none">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Active</th>
              <th className="px-4 py-3 font-medium">Completion</th>
              <th className="px-4 py-3 font-medium">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  No team members match this filter.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const tier = tierFromRow(r);
                const pct = completionPercent(r.completedSteps, r.expectedSteps);
                return (
                  <tr
                    key={r.userId}
                    className={`border-b border-border last:border-0 ${trafficRowClass(tier)}`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/team/${r.userId}`}
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.title?.trim() || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.activeAssignments}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex h-2 w-2 shrink-0 rounded-full ${trafficDotClass(tier)}`}
                          aria-hidden
                        />
                        <span className="font-medium text-foreground">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {fmtActivity(r.lastActivityIso)}
                    </td>
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
