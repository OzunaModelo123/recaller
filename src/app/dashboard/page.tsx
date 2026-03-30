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
import { HeroPanelCta } from "@/components/design/hero-panel-cta";
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
    accent: "from-primary/18 via-secondary/10 to-transparent",
    iconColor: "text-primary",
    number: "01",
  },
  {
    title: "Generate AI plans",
    description: "AI creates actionable, multi-step learning plans from your content.",
    icon: Sparkles,
    href: "/dashboard/content",
    accent: "from-primary/18 via-secondary/10 to-transparent",
    iconColor: "text-primary",
    number: "02",
  },
  {
    title: "Assign to your team",
    description: "Distribute plans via Slack, Teams, or email and track completion.",
    icon: Send,
    href: "/dashboard/assignments",
    accent: "from-primary/18 via-secondary/10 to-transparent",
    iconColor: "text-primary",
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
  let orgId: string | null = null;
  let contentCountLabel = "0";
  let teamCountLabel = "0";

  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("full_name, role, org_id")
      .eq("id", user.id)
      .single();

    fullName = profile?.full_name || user.email?.split("@")[0] || "there";
    role = profile?.role ?? "employee";
    orgId = profile?.org_id ?? null;

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

  if (isAdmin && orgId) {
    const [{ count: contentCount }, { count: teamCount }] = await Promise.all([
      supabase
        .from("content_items")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId),
      supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId),
    ]);
    contentCountLabel = String(contentCount ?? 0);
    teamCountLabel = String(teamCount ?? 0);
  }
  const greeting = getGreeting();
  const firstName = getFirstName(fullName);

  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl bg-sidebar px-8 py-10 shadow-lg">
        <div className="grain absolute inset-0 rounded-xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(232,115,74,0.15),transparent_50%)]" />
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-sidebar-primary/10 blur-3xl" />

        <div className="relative z-10">
          <p className="text-xs font-medium uppercase tracking-widest text-sidebar-foreground/60">
            {orgName}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-sidebar-foreground">
            {greeting}, {firstName}
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-sidebar-foreground/70">
            {isAdmin
              ? "Manage training content, generate AI-powered plans, and track how your team learns."
              : "Complete your assigned training plans and build real skills, one step at a time."}
          </p>
          {isAdmin && (
            <HeroPanelCta
              href="/dashboard/content/upload"
              className="mt-6"
            >
              Upload content
              <ArrowUpRight className="h-4 w-4 shrink-0 opacity-90" />
            </HeroPanelCta>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            label: "Content Items",
            value: contentCountLabel,
            icon: BookOpen,
          },
          {
            label: "Team Members",
            value: teamCountLabel,
            icon: Users,
          },
          {
            label: "Completion Rate",
            value: "0%",
            icon: TrendingUp,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="group rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-all duration-200 hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-0.5"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                <p className="mt-1.5 text-3xl font-semibold tracking-tight text-foreground">
                  {stat.value}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/15">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Getting started */}
      {isAdmin && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Get started
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Three steps to transform your training workflow.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {steps.map((step) => (
              <Link
                key={step.title}
                href={step.href}
                className="group relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)] transition-all duration-200 hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-0.5 hover:border-primary/20"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                      <step.icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-mono text-muted-foreground/70">
                      {step.number}
                    </span>
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                  <div className="mt-4 flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary">
                    Get started
                    <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Activity + Insights */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            No activity yet. Once your team starts completing plans, their progress
            will appear here.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">AI Insights</h3>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            After 30 days of data, Recaller generates AI-powered insights about your
            team&apos;s learning patterns and performance.
          </p>
        </div>
      </div>
    </div>
  );
}
