"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
} from "recharts";
import {
  Clock,
  TrendingDown,
  Users,
  Zap,
} from "lucide-react";

type VelocityData = {
  medianTimeToStartHours: number;
  medianTimeToFinishHours: number;
  fastestCompletionHours: number;
  slowestCompletionHours: number;
  totalCompleted: number;
};

type DropOffData = {
  stepCounts: { step: number; count: number }[];
  biggestDropStep: number;
  biggestDropPercentage: number;
  hardStepNotes: string[];
};

type HeatmapData = { hour: number; completionCount: number }[];

type PerformerData = {
  topPerformers: { name: string; rate: number }[];
  bottomPerformers: { name: string; rate: number }[];
  orgAverage: number;
};

type ContentData = {
  planTitle: string;
  contentType: string;
  completionRate: number;
  totalAssigned: number;
}[];

type Props = {
  velocity: VelocityData;
  dropOff: DropOffData;
  heatmap: HeatmapData;
  performers: PerformerData;
  effectiveness: ContentData;
  periodLabel: string;
};

export function InsightsCharts({
  velocity,
  dropOff,
  heatmap,
  performers,
  effectiveness,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="Median Time to Start"
          value={`${velocity.medianTimeToStartHours}h`}
        />
        <StatCard
          icon={<Zap className="h-5 w-5" />}
          label="Fastest Completion"
          value={`${velocity.fastestCompletionHours}h`}
        />
        <StatCard
          icon={<TrendingDown className="h-5 w-5" />}
          label="Biggest Step Drop"
          value={
            dropOff.biggestDropStep > 0
              ? `Step ${dropOff.biggestDropStep} (${dropOff.biggestDropPercentage}%)`
              : "None"
          }
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Org Avg Completion"
          value={`${performers.orgAverage}%`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {dropOff.stepCounts.length > 0 && (
          <ChartCard title="Step Drop-Off Funnel">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dropOff.stepCounts}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="step"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `Step ${v}`}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {dropOff.stepCounts.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={
                        entry.step === dropOff.biggestDropStep
                          ? "#ef4444"
                          : "#3b82f6"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        <ChartCard title="Completion Time of Day (UTC)">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={heatmap}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => `${v}:00`}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                }}
              />
              <Line
                type="monotone"
                dataKey="completionCount"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {performers.topPerformers.length > 0 && (
          <ChartCard title="Top Performers">
            <div className="space-y-3">
              {performers.topPerformers.map((p, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{p.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-green-500"
                        style={{ width: `${p.rate}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-sm font-medium text-foreground">
                      {p.rate}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        )}

        {effectiveness.length > 0 && (
          <ChartCard title="Content Effectiveness">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={effectiveness.slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="planTitle"
                  tick={{ fontSize: 11 }}
                  width={120}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                  }}
                />
                <Bar
                  dataKey="completionRate"
                  fill="#10b981"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-2 text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}
