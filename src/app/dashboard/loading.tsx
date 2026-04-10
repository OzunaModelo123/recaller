export default function DashboardLoading() {
  return (
    <div className="space-y-10 animate-pulse">
      {/* Hero skeleton */}
      <div className="rounded-xl bg-sidebar/60 px-8 py-10">
        <div className="space-y-3">
          <div className="h-3 w-32 rounded bg-sidebar-foreground/10" />
          <div className="h-8 w-64 rounded bg-sidebar-foreground/10" />
          <div className="h-4 w-96 rounded bg-sidebar-foreground/10" />
        </div>
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="h-3 w-24 rounded bg-muted" />
                <div className="h-7 w-16 rounded bg-muted" />
                <div className="h-2 w-36 rounded bg-muted/60" />
              </div>
              <div className="h-10 w-10 rounded-lg bg-muted" />
            </div>
          </div>
        ))}
      </div>

      {/* Activity / Cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-6"
          >
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="mt-4 space-y-3">
              <div className="h-3 w-full rounded bg-muted/60" />
              <div className="h-3 w-3/4 rounded bg-muted/60" />
              <div className="h-3 w-1/2 rounded bg-muted/60" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
