"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  FileVideo,
  LayoutDashboard,
  ListChecks,
  Plug,
  Settings,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { isDashboardNavActive } from "@/lib/dashboard/nav-active";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, adminOnly: false },
  { href: "/dashboard/content", label: "Content", icon: FileVideo, adminOnly: false },
  { href: "/dashboard/plans", label: "Plans", icon: ListChecks, adminOnly: false },
  {
    href: "/dashboard/assignments",
    label: "Assignments",
    icon: ClipboardList,
    adminOnly: false,
  },
  { href: "/dashboard/team", label: "Team", icon: Users, adminOnly: true },
  { href: "/dashboard/insights", label: "Insights", icon: BarChart3, adminOnly: true },
  { href: "/dashboard/integrations", label: "Integrations", icon: Plug, adminOnly: true },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, adminOnly: true },
] as const;

export function DashboardSidebarNav({
  isAdmin,
  className,
}: {
  isAdmin: boolean;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex flex-col gap-0.5", className)}>
      {navItems
        .filter((item) => !item.adminOnly || isAdmin)
        .map((item) => {
          const active = isDashboardNavActive(pathname, item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium leading-snug transition-colors duration-150",
                active
                  ? "border border-sidebar-primary/25 bg-sidebar-primary/18 text-sidebar-primary shadow-sm"
                  : "border border-transparent text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              <Icon
                className={cn(
                  "h-[19px] w-[19px] shrink-0 transition-colors",
                  active
                    ? "text-sidebar-primary"
                    : "text-sidebar-foreground/65 group-hover:text-sidebar-foreground",
                )}
                aria-hidden
              />
              {item.label}
            </Link>
          );
        })}
    </nav>
  );
}

