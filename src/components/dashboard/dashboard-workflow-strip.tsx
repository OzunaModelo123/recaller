"use client";

import Link from "next/link";
import { track } from "@vercel/analytics";
import {
  BarChart3,
  ClipboardList,
  FileVideo,
  ListChecks,
  Settings,
  Upload,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const actions = [
  {
    href: "/dashboard/content/upload",
    label: "Upload content",
    event: "dashboard_quick_upload",
    icon: Upload,
  },
  {
    href: "/dashboard/content",
    label: "Content library",
    event: "dashboard_quick_content",
    icon: FileVideo,
  },
  {
    href: "/dashboard/plans",
    label: "Plans",
    event: "dashboard_quick_plans",
    icon: ListChecks,
  },
  {
    href: "/dashboard/assignments",
    label: "Assignments",
    event: "dashboard_quick_assignments",
    icon: ClipboardList,
  },
  {
    href: "/dashboard/team",
    label: "Team",
    event: "dashboard_quick_team",
    icon: Users,
  },
  {
    href: "/dashboard/insights",
    label: "Insights",
    event: "dashboard_quick_insights",
    icon: BarChart3,
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    event: "dashboard_quick_settings",
    icon: Settings,
  },
] as const;

export function DashboardWorkflowStrip() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Quick actions
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Jump to the tasks you use most — no need to open the sidebar.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <Button key={a.href} variant="outline" size="sm" className="rounded-lg" asChild>
              <Link
                href={a.href}
                onClick={() => track(a.event, { href: a.href })}
              >
                <Icon className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                {a.label}
              </Link>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
