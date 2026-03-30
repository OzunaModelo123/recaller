import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type HeroPanelCtaProps = Omit<ComponentProps<typeof Link>, "className"> & {
  className?: string;
};

/** Primary action on dark hero panels (admin + employee dashboards). */
export function HeroPanelCta({ className, children, ...props }: HeroPanelCtaProps) {
  return (
    <Link
      className={cn(
        "inline-flex items-center gap-2 rounded-lg bg-sidebar-primary px-5 py-2.5 text-base font-medium text-sidebar-primary-foreground shadow-[var(--shadow-button)] transition-all duration-150 hover:shadow-[var(--shadow-button-hover)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[var(--shadow-xs)]",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
