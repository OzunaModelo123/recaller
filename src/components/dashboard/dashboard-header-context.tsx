"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { DashboardHeaderQuickLinks } from "@/components/dashboard/dashboard-header-quick-links";
import { getDashboardRouteTitle } from "@/lib/dashboard/route-titles";

export function DashboardHeaderContext({
  orgName,
  isAdmin,
  headerDateLabel,
}: {
  orgName: string;
  isAdmin: boolean;
  /** Server-rendered once per request to avoid hydration mismatch from `new Date()` in the client. */
  headerDateLabel: string;
}) {
  const pathname = usePathname() ?? "/dashboard";
  const { parentLabel, pageLabel } = getDashboardRouteTitle(pathname);

  return (
    <header className="hidden border-b border-border bg-card/60 backdrop-blur-sm md:flex md:flex-wrap md:items-center md:justify-between md:gap-3 md:px-8 md:py-4">
      <div className="flex min-w-0 flex-1 items-center gap-2 text-base text-muted-foreground">
        <Link
          href="/dashboard"
          className="truncate transition-colors hover:text-foreground/90"
          title={orgName}
        >
          {orgName}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        <span className="truncate text-muted-foreground/90">{parentLabel}</span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        <span className="truncate font-semibold text-foreground">{pageLabel}</span>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {isAdmin ? <DashboardHeaderQuickLinks /> : null}
        <span className="text-sm text-muted-foreground tabular-nums">{headerDateLabel}</span>
      </div>
    </header>
  );
}

export function DashboardMobilePageLabel() {
  const pathname = usePathname() ?? "/dashboard";
  const { pageLabel } = getDashboardRouteTitle(pathname);

  return (
    <span className="max-w-[140px] truncate text-xs font-semibold text-foreground" title={pageLabel}>
      {pageLabel}
    </span>
  );
}
