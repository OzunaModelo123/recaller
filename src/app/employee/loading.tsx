import { Skeleton } from "@/components/ui/skeleton";

export default function EmployeeLoading() {
  return (
    <div className="space-y-8 pb-8">
      <div className="space-y-4 rounded-2xl border border-border bg-card p-6 sm:p-8">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-full max-w-lg" />
        <Skeleton className="h-4 w-full max-w-md" />
        <div className="flex gap-3 pt-2">
          <Skeleton className="h-11 w-32 rounded-xl" />
          <Skeleton className="h-11 w-36 rounded-xl" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}
