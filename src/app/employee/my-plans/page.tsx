import { BookOpen, Sparkles } from "lucide-react";

export default function MyPlansPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-stone-900">My Plans</h1>
        <p className="mt-1 text-sm text-stone-400">
          Your assigned training plans and progress.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50/50 py-20 text-center">
        <div className="relative">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
            <BookOpen className="h-6 w-6 text-stone-300" />
          </div>
          <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 ring-2 ring-white">
            <Sparkles className="h-3 w-3 text-amber-600" />
          </div>
        </div>
        <h3 className="mt-5 text-sm font-semibold text-stone-700">
          No plans assigned yet
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-stone-400">
          When your admin assigns training plans to you, they&apos;ll appear here
          with step-by-step instructions. You&apos;ll be able to track your
          progress and mark steps complete.
        </p>
      </div>
    </div>
  );
}
