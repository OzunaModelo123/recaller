import {
  Upload,
  Sparkles,
  Send,
  ArrowRight,
  BookOpen,
  Users,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getFirstName(fullName: string): string {
  return fullName.split(" ")[0] || fullName;
}

const gettingStartedSteps = [
  {
    title: "Upload training content",
    description: "Add a YouTube video, PDF, or document to your content library.",
    icon: <Upload className="h-5 w-5" />,
    href: "/dashboard/content",
    phase: "Phase 2",
  },
  {
    title: "Generate a plan",
    description: "AI will create a 4-step actionable plan from your content.",
    icon: <Sparkles className="h-5 w-5" />,
    href: "/dashboard/content",
    phase: "Phase 3",
  },
  {
    title: "Assign to your team",
    description: "Send plans to employees via Slack, Teams, or email.",
    icon: <Send className="h-5 w-5" />,
    href: "/dashboard/assignments",
    phase: "Phase 5",
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
    <div className="space-y-6">
      {/* Hero greeting */}
      <div className="rounded-xl border bg-gradient-to-br from-zinc-900 to-zinc-800 px-6 py-8 text-white shadow-sm">
        <p className="text-sm font-medium text-zinc-400">{orgName}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          {greeting}, {firstName}
        </h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-zinc-300">
          {isAdmin
            ? "Manage your training content, track team progress, and build actionable learning plans with AI."
            : "Complete your assigned training plans and build real skills, one step at a time."}
        </p>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900">0</p>
              <p className="text-xs text-zinc-500">Content Items</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900">1</p>
              <p className="text-xs text-zinc-500">Team Members</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900">0%</p>
              <p className="text-xs text-zinc-500">Completion Rate</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Getting started */}
      {isAdmin && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Getting Started</CardTitle>
              <Badge variant="secondary" className="text-xs">
                0 / 3 complete
              </Badge>
            </div>
            <Progress value={0} className="mt-2 h-1.5" />
          </CardHeader>
          <CardContent className="space-y-1 pt-0">
            {gettingStartedSteps.map((step) => (
              <div
                key={step.title}
                className="group flex items-center gap-4 rounded-lg p-3 transition-colors hover:bg-zinc-50"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-white text-zinc-400 transition-colors group-hover:border-zinc-300 group-hover:text-zinc-600">
                  {step.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-zinc-800">{step.title}</p>
                    <Badge variant="outline" className="hidden text-[10px] sm:inline-flex">
                      {step.phase}
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-500">{step.description}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-zinc-300 transition-colors group-hover:text-zinc-500" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Quick info */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-500">
              No activity yet. Once your team starts completing plans, their progress will appear
              here.
            </p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-amber-500" />
              AI Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-500">
              After 30 days of data, Recaller will generate AI-powered insights about your team&apos;s
              learning patterns.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
