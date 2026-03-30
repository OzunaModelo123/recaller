import { BarChart3, Sparkles } from "lucide-react";

export default function InsightsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          Insights
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          AI-powered analytics and reports on team training performance.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card py-20 text-center">
        <div className="relative">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-none">
            <BarChart3 className="h-6 w-6 text-primary" />
          </div>
          <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 ring-2 ring-border">
            <Sparkles className="h-3 w-3 text-primary" />
          </div>
        </div>
        <h3 className="mt-5 text-sm font-semibold text-foreground">
          AI insights coming soon
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
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
            <div
              key={item.label}
              className="rounded-xl border border-border bg-card p-4 shadow-none"
            >
              <p className="text-xs font-semibold text-foreground">
                {item.label}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
