"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Home, BrainCircuit } from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  {
    href: "/employee",
    label: "Home",
    icon: Home,
    isActive: (p: string) => p === "/employee" || p === "/employee/",
  },
  {
    href: "/employee/daily-recall",
    label: "Daily Recall",
    icon: BrainCircuit,
    isActive: (p: string) => p.startsWith("/employee/daily-recall"),
  },
  {
    href: "/employee/my-plans",
    label: "My Plans",
    icon: BookOpen,
    isActive: (p: string) => p.startsWith("/employee/my-plans"),
  },
] as const;

type Props = {
  className?: string;
  linkClassName?: string;
};

export function EmployeeSidebarNav({ className, linkClassName }: Props) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex flex-col gap-0.5", className)}>
      {items.map(({ href, label, icon: Icon, isActive }) => {
        const active = isActive(pathname);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "group flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium leading-snug transition-colors duration-150",
              active
                ? "border border-sidebar-primary/25 bg-sidebar-primary/18 text-sidebar-primary shadow-sm"
                : "border border-transparent text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              linkClassName,
            )}
          >
            <Icon
              className={cn(
                "h-[19px] w-[19px] shrink-0 transition-colors",
                active
                  ? "text-sidebar-primary"
                  : "text-sidebar-foreground/65 group-hover:text-sidebar-foreground",
              )}
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
