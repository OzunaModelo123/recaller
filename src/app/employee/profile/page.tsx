import { redirect } from "next/navigation";
import {
  UserCircle,
  Award,
  BarChart3,
  Clock,
  Flame,
} from "lucide-react";

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
      const yesterday = new Date(Date.now() - 86_400_000)
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          Profile
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          Manage your profile, view your stats, and connected platforms.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={<Award className="h-5 w-5 text-green-500" />}
          label="Plans Completed"
          value={String(completedAssignments)}
        />
        <StatCard
          icon={<BarChart3 className="h-5 w-5 text-blue-500" />}
          label="Completion Rate"
          value={`${completionRate}%`}
        />
        <StatCard
          icon={<Clock className="h-5 w-5 text-purple-500" />}
          label="Steps Completed"
          value={String(totalCompletedSteps)}
        />
        <StatCard
          icon={<Flame className="h-5 w-5 text-orange-500" />}
          label="Current Streak"
          value={`${currentStreak} day${currentStreak !== 1 ? "s" : ""}`}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-3">
          <UserCircle className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">
            Personal Info
          </h2>
        </div>
        <ProfileForm
          userId={profile.id}
          initialName={profile.full_name ?? ""}
          initialTitle={profile.title ?? ""}
          email={profile.email}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">
          Connected Platforms
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
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">{icon}</div>
      <p className="mt-2 text-lg font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
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
        <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
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
