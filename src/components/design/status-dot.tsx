"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "danger" | "neutral";

export function StatusDot({
  tone,
  className,
  title,
}: {
  tone: StatusTone;
  className?: string;
  title?: string;
}) {
  const bg =
    tone === "success"
      ? "bg-emerald-500/90"
      : tone === "warning"
        ? "bg-amber-500/90"
        : tone === "danger"
          ? "bg-red-500/90"
          : "bg-muted";

  return (
    <span
      aria-label={title ?? tone}
      title={title}
      className={cn("inline-block h-2 w-2 rounded-full", bg, className)}
    />
  );
}

