import * as React from "react";

import { Card, CardContent } from "@/components/ui/card";
import { StatusDot, type StatusTone } from "./status-dot";

export function StatCard({
  icon,
  value,
  label,
  trend,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  trend?: { tone: StatusTone; text: string };
}) {
  return (
    <Card className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)] transition-shadow duration-200 hover:shadow-[var(--shadow-card-hover)]">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            {trend ? <StatusDot tone={trend.tone} title={trend.text} /> : null}
            <p className="text-3xl font-semibold tracking-tight">{value}</p>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{label}</p>
          {trend ? (
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              {trend.text}
            </p>
          ) : null}
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary">
          <div className="text-primary">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

