import { Skeleton } from "@/components/ui/skeleton";

export default function AssignmentLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-full max-w-md" />
        <Skeleton className="h-2 w-full" />
      </div>
      <div className="space-y-3 rounded-xl border border-border p-5">
        <Skeleton className="h-5 w-[75%] max-w-md" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}
