import { redirect } from "next/navigation";
import {
  UserCircle,
  Award,
  BarChart3,
  Clock,
  Flame,
  BrainCircuit,
} from "lucide-react";

import { PageHeader } from "@/components/design/page-header";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("id, email, full_name, title, org_id, slack_user_id, teams_user_id")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/post-login");

  const { data: assignments } = await supabase
    .from("assignments")
    .select("id, status, plan_id")
    .eq("assigned_to", user.id)
    .neq("status", "cancelled");

  const totalAssignments = assignments?.length ?? 0;
  const completedAssignments = (assignments ?? []).filter(
    (a) => a.status === "completed",
  ).length;

  const assignmentIds = (assignments ?? []).map((a) => a.id);
  let totalCompletedSteps = 0;
  let currentStreak = 0;

  if (assignmentIds.length > 0) {
    const { data: completions } = await supabase
      .from("step_completions")
      .select("completed_at")
      .in("assignment_id", assignmentIds)
      .order("completed_at", { ascending: false });

    totalCompletedSteps = completions?.length ?? 0;

    if (completions && completions.length > 0) {
      const days = new Set(
        completions.map((c) =>
          new Date(c.completed_at).toISOString().slice(0, 10),
        ),
      );
      const sortedDays = [...days].sort().reverse();
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(new Date().getTime() - 86_400_000)
        .toISOString()
        .slice(0, 10);

      if (sortedDays[0] === today || sortedDays[0] === yesterday) {
        currentStreak = 1;
        for (let i = 1; i < sortedDays.length; i++) {
          const prev = new Date(sortedDays[i - 1]);
          const curr = new Date(sortedDays[i]);
          const diff = (prev.getTime() - curr.getTime()) / 86_400_000;
          if (diff <= 1) currentStreak++;
          else break;
        }
      }
    }
  }

  const completionRate =
    totalAssignments > 0
      ? Math.round((completedAssignments / totalAssignments) * 100)
      : 0;

  // Fetch Retention Score
  const { data: sessions } = await supabase
    .from("review_sessions")
    .select("retention_score_delta")
    .eq("user_id", user.id);

  const totalRetentionScore = sessions?.reduce((sum, session) => sum + (session.retention_score_delta || 0), 0) || 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Profile"
        subtitle="Your stats, personal details, and connected platforms."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4">
        <StatCard
          icon={<Award className="h-5 w-5 text-primary" />}
          label="Plans completed"
          value={String(completedAssignments)}
        />
        <StatCard
          icon={<BarChart3 className="h-5 w-5 text-primary" />}
          label="Completion rate"
          value={`${completionRate}%`}
        />
        <StatCard
          icon={<Clock className="h-5 w-5 text-primary" />}
          label="Steps completed"
          value={String(totalCompletedSteps)}
        />
        <StatCard
          icon={<Flame className="h-5 w-5 text-primary" />}
          label="Current streak"
          value={`${currentStreak} day${currentStreak !== 1 ? "s" : ""}`}
        />
        <StatCard
          icon={<BrainCircuit className="h-5 w-5 text-primary" />}
          label="Retention Score"
          value={String(totalRetentionScore)}
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="mb-5 flex items-center gap-3 border-b border-border pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted/40">
            <UserCircle className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Personal info
          </h2>
        </div>
        <ProfileForm
          userId={profile.id}
          initialName={profile.full_name ?? ""}
          initialTitle={profile.title ?? ""}
          email={profile.email}
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <h2 className="mb-4 text-base font-semibold tracking-tight text-foreground">
          Connected platforms
        </h2>
        <div className="space-y-3">
          <PlatformRow
            name="Slack"
            connected={!!profile.slack_user_id}
          />
          <PlatformRow
            name="Microsoft Teams"
            connected={!!profile.teams_user_id}
          />
        </div>
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
    <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-shadow duration-200 hover:shadow-[var(--shadow-card-hover)] sm:p-5">
      <div className="flex items-center gap-2">{icon}</div>
      <p className="mt-2 text-lg font-bold tabular-nums text-foreground">{value}</p>
      <p className="text-xs leading-snug text-muted-foreground">{label}</p>
    </div>
  );
}

function PlatformRow({
  name,
  connected,
}: {
  name: string;
  connected: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
      <span className="text-sm font-medium text-foreground">{name}</span>
      {connected ? (
        <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
          Connected
        </span>
      ) : (
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          Not connected
        </span>
      )}
    </div>
  );
}
