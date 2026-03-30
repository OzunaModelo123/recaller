import Link from "next/link";
import {
  Upload,
  Sparkles,
  Send,
  ArrowUpRight,
  BookOpen,
  Users,
  TrendingUp,
  Activity,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getFirstName(fullName: string): string {
  return fullName.split(" ")[0] || fullName;
}

const steps = [
  {
    title: "Upload training content",
    description: "Add a YouTube video, PDF, or document to your content library.",
    icon: Upload,
    href: "/dashboard/content/upload",
    accent: "from-amber-500/10 to-orange-500/10",
    iconColor: "text-amber-600",
    number: "01",
  },
  {
    title: "Generate AI plans",
    description: "AI creates actionable, multi-step learning plans from your content.",
    icon: Sparkles,
    href: "/dashboard/content",
    accent: "from-violet-500/10 to-indigo-500/10",
    iconColor: "text-violet-600",
    number: "02",
  },
  {
    title: "Assign to your team",
    description: "Distribute plans via Slack, Teams, or email and track completion.",
    icon: Send,
    href: "/dashboard/assignments",
    accent: "from-emerald-500/10 to-teal-500/10",
    iconColor: "text-emerald-600",
    number: "03",
  },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let fullName = "there";
  let orgName = "your organization";
  let role = "employee";

  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("full_name, role, org_id")
      .eq("id", user.id)
      .single();

    fullName = profile?.full_name || user.email?.split("@")[0] || "there";
    role = profile?.role ?? "employee";

    if (profile?.org_id) {
      const { data: org } = await supabase
        .from("organisations")
        .select("name")
        .eq("id", profile.org_id)
        .single();
      orgName = org?.name ?? orgName;
    }
  }

  const isAdmin = role === "admin" || role === "super_admin";
  const greeting = getGreeting();
  const firstName = getFirstName(fullName);

  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-stone-900 via-stone-800 to-amber-900/70 px-8 py-10 shadow-xl shadow-stone-900/5">
        <div className="grain absolute inset-0 rounded-2xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(217,170,100,0.12),transparent_60%)]" />
        <div className="absolute right-0 top-0 h-72 w-72 bg-[radial-gradient(circle,rgba(255,255,255,0.03),transparent_70%)]" />

        <div className="relative z-10">
          <p className="text-xs font-medium uppercase tracking-widest text-stone-400">
            {orgName}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            {greeting}, {firstName}
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-stone-300">
            {isAdmin
              ? "Manage training content, generate AI-powered plans, and track how your team learns."
              : "Complete your assigned training plans and build real skills, one step at a time."}
          </p>
          {isAdmin && (
            <Link
              href="/dashboard/content/upload"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition-all hover:bg-white/20"
            >
              Upload content
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Content Items", value: "0", icon: BookOpen, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Team Members", value: "1", icon: Users, color: "text-violet-600", bg: "bg-violet-50" },
          { label: "Completion Rate", value: "0%", icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="group rounded-2xl border border-stone-150 bg-white p-5 shadow-sm transition-all hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-stone-400">{stat.label}</p>
                <p className="mt-1 text-3xl font-semibold tracking-tight text-stone-900">
                  {stat.value}
                </p>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Getting started */}
      {isAdmin && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-stone-900">
              Get started
            </h2>
            <p className="mt-1 text-sm text-stone-400">
              Three steps to transform your training workflow.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {steps.map((step) => (
              <Link
                key={step.title}
                href={step.href}
                className="group relative overflow-hidden rounded-2xl border border-stone-150 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${step.accent} opacity-0 transition-opacity group-hover:opacity-100`} />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-stone-50 ${step.iconColor} transition-colors group-hover:bg-white`}>
                      <step.icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-mono text-stone-300">
                      {step.number}
                    </span>
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-stone-800">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-stone-400">
                    {step.description}
                  </p>
                  <div className="mt-4 flex items-center gap-1 text-xs font-medium text-stone-400 transition-colors group-hover:text-stone-700">
                    Get started
                    <ArrowUpRight className="h-3 w-3" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Activity + Insights */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-stone-150 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
              <Activity className="h-4 w-4 text-emerald-600" />
            </div>
            <h3 className="text-sm font-semibold text-stone-800">Recent Activity</h3>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-stone-400">
            No activity yet. Once your team starts completing plans, their progress
            will appear here.
          </p>
        </div>

        <div className="rounded-2xl border border-stone-150 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
              <Zap className="h-4 w-4 text-amber-600" />
            </div>
            <h3 className="text-sm font-semibold text-stone-800">AI Insights</h3>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-stone-400">
            After 30 days of data, Recaller generates AI-powered insights about your
            team&apos;s learning patterns and performance.
          </p>
        </div>
      </div>
    </div>
  );
}
