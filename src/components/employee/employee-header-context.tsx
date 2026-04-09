"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Plug, UserCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getEmployeeRouteTitle } from "@/lib/employee/route-titles";

export function EmployeeTopBar({ orgName }: { orgName: string }) {
  const pathname = usePathname() ?? "/employee";
  const { sectionLabel, pageLabel } = getEmployeeRouteTitle(pathname);

  return (
    <header className="hidden border-b border-border bg-card/60 backdrop-blur-sm md:flex md:flex-wrap md:items-center md:justify-between md:gap-4 md:px-8 md:py-4">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{sectionLabel}</p>
        <p className="mt-0.5 text-base font-semibold tracking-tight text-foreground">
          <span className="text-muted-foreground">{orgName}</span>
          <span className="mx-2 font-normal text-border">·</span>
          <span>{pageLabel}</span>
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" size="sm" className="h-9 rounded-lg px-3 text-xs" asChild>
          <Link href="/employee/my-plans">
            <BookOpen className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            My Plans
          </Link>
        </Button>
        <Button variant="outline" size="sm" className="h-9 rounded-lg px-3 text-xs" asChild>
          <Link href="/employee/profile">
            <UserCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Profile
          </Link>
        </Button>
        <Button variant="outline" size="sm" className="h-9 rounded-lg px-3 text-xs" asChild>
          <Link href="/employee/integrations">
            <Plug className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Integrations
          </Link>
        </Button>
      </div>
    </header>
  );
}

export function EmployeeMobilePageLabel() {
  const pathname = usePathname() ?? "/employee";
  const { pageLabel } = getEmployeeRouteTitle(pathname);

  return (
    <p
      className="max-w-[min(220px,50vw)] truncate text-sm font-semibold leading-tight tracking-tight text-foreground"
      title={pageLabel}
    >
      {pageLabel}
    </p>
  );
}
