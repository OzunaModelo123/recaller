"use client";

import Link from "next/link";
import { track } from "@vercel/analytics";
import { BookOpen, Plug, UserCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

const actions = [
  {
    href: "/employee/my-plans",
    label: "All my plans",
    event: "employee_strip_plans",
    icon: BookOpen,
  },
  {
    href: "/employee/profile",
    label: "Profile & stats",
    event: "employee_strip_profile",
    icon: UserCircle,
  },
  {
    href: "/employee/integrations",
    label: "Slack & Teams",
    event: "employee_strip_integrations",
    icon: Plug,
  },
] as const;

export function EmployeeWorkflowStrip() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Shortcuts
      </p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Switch areas without using the sidebar on desktop.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <Button key={a.href} variant="outline" size="sm" className="rounded-lg" asChild>
              <Link href={a.href} onClick={() => track(a.event, { href: a.href })}>
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
