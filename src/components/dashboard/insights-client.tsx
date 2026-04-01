"use client";

import { useEffect, useState } from "react";

import { InsightsCharts } from "@/components/dashboard/insights-charts";
import { Skeleton } from "@/components/ui/skeleton";
import type { LiveAnalyticsPayload } from "@/lib/dashboard/load-insights";

export function InsightsClient({
  initialAnalytics,
}: {
  initialAnalytics: LiveAnalyticsPayload;
}) {
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone?.trim();
    if (!tz || tz === initialAnalytics.timeZone) return;

    let alive = true;
    setIsRefreshing(true);

    fetch(`/api/insights?tz=${encodeURIComponent(tz)}`, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Insights request failed (${res.status})`);
        return (await res.json()) as LiveAnalyticsPayload;
      })
      .then((next) => {
        if (alive) setAnalytics(next);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setIsRefreshing(false);
      });

    return () => {
      alive = false;
    };
  }, [initialAnalytics.timeZone]);

  return (
    <div className="space-y-3">
      {isRefreshing ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : null}
      <InsightsCharts {...analytics} />
    </div>
  );
}
