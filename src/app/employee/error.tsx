"use client";

export default function EmployeeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
        <span className="text-2xl">⚠️</span>
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">
          Something went wrong
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          An unexpected error occurred while loading this page.
          {error.digest ? (
            <span className="mt-1 block text-xs text-muted-foreground/70">
              Error ID: {error.digest}
            </span>
          ) : null}
        </p>
      </div>
      <button
        onClick={reset}
        className="mt-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Try again
      </button>
    </div>
  );
}
