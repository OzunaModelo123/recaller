import { ClipboardList, ArrowRight } from "lucide-react";

export default function AssignmentsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          Assignments
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          Manage training plan assignments and track team progress.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-none">
          <ClipboardList className="h-6 w-6 text-primary" />
        </div>
        <h3 className="mt-5 text-sm font-semibold text-foreground">
          No assignments yet
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Once you generate training plans from your content, you can assign them
          to team members and track completion in real-time. This feature is
          coming in Phase 5.
        </p>
        <div className="mt-6 inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground">
          Coming soon
          <ArrowRight className="h-3 w-3" />
        </div>
      </div>
    </div>
  );
}
