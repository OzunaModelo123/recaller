import { Skeleton } from "@/components/ui/skeleton";

export default function MyPlansLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2 border-b border-border pb-6">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-xl sm:h-36" />
        ))}
      </div>
    </div>
  );
}
