import { BarChart3, Sparkles } from "lucide-react";

export default function InsightsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-stone-900">Insights</h1>
        <p className="mt-1 text-sm text-stone-400">
          AI-powered analytics and reports on team training performance.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50/50 py-20 text-center">
        <div className="relative">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
            <BarChart3 className="h-6 w-6 text-stone-300" />
          </div>
          <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 ring-2 ring-white">
            <Sparkles className="h-3 w-3 text-amber-600" />
          </div>
        </div>
        <h3 className="mt-5 text-sm font-semibold text-stone-700">
          AI insights coming soon
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-stone-400">
          After 30+ days of completion data, Recaller will generate AI-powered
          narrative reports on learning trends, engagement patterns, and team
          performance.
        </p>

        <div className="mx-auto mt-8 grid max-w-lg grid-cols-3 gap-4">
          {[
            { label: "Completion trends", desc: "Track progress over time" },
            { label: "Learning patterns", desc: "Identify engagement peaks" },
            { label: "Team reports", desc: "AI-written PDF summaries" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-stone-700">{item.label}</p>
              <p className="mt-1 text-[11px] text-stone-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
