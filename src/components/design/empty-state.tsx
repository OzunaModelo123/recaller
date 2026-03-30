import * as React from "react";

import { Button } from "@/components/ui/button";

export function EmptyState({
  icon,
  title,
  description,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  cta?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-background">
        <div className="text-primary">{icon}</div>
      </div>
      <h3 className="mt-5 text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {cta ? (
        <Button asChild variant="secondary" className="mt-8 rounded-lg">
          <a href={cta.href}>{cta.label}</a>
        </Button>
      ) : null}
    </div>
  );
}

