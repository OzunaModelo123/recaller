import { BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function InsightsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">Insights</h1>
        <p className="text-sm text-zinc-500">
          AI-powered analytics and reports on team training performance.
        </p>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
            <BarChart3 className="h-6 w-6 text-zinc-400" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-zinc-800">Insights coming soon</h3>
          <p className="mt-1 max-w-sm text-sm text-zinc-500">
            After 30+ days of completion data, AI will generate narrative reports on learning trends
            and team performance.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
