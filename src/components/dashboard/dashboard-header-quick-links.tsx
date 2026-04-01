"use client";

import Link from "next/link";
import { track } from "@vercel/analytics";
import {
  BarChart3,
  ClipboardList,
  Upload,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const links = [
  { href: "/dashboard/content/upload", label: "Upload", event: "header_upload", icon: Upload },
  {
    href: "/dashboard/assignments",
    label: "Assign",
    event: "header_assignments",
    icon: ClipboardList,
  },
  { href: "/dashboard/team", label: "Team", event: "header_team", icon: Users },
  { href: "/dashboard/insights", label: "Analytics", event: "header_insights", icon: BarChart3 },
] as const;

export function DashboardHeaderQuickLinks() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {links.map((l) => {
        const Icon = l.icon;
        return (
          <Button key={l.href} variant="outline" size="sm" className="h-8 rounded-lg px-2.5 text-xs" asChild>
            <Link href={l.href} onClick={() => track(l.event, { href: l.href })}>
              <Icon className="mr-1 h-3.5 w-3.5" aria-hidden />
              {l.label}
            </Link>
          </Button>
        );
      })}
    </div>
  );
}
