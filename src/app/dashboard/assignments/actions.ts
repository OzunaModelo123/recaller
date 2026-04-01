"use server";

import { revalidatePath } from "next/cache";

import { notifySlackAssignmentOnCreate } from "@/lib/notifications/notify-employee-slack-assignment";
import {
  notifyTeamsAssignmentOnCreate,
  type TeamsAssignmentPushResult,
} from "@/lib/notifications/notify-employee-teams-assignment";
import { createClient } from "@/lib/supabase/server";

async function requireOrgAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, error: "Unauthorized" as const, orgId: null, userId: null };
  const { data: me } = await supabase
    .from("users")
    .select("org_id, role")
    .eq("id", user.id)
    .single();
  if (!me?.org_id || (me.role !== "admin" && me.role !== "super_admin")) {
    return { supabase, error: "Forbidden" as const, orgId: null, userId: null };
  }
  return { supabase, error: null, orgId: me.org_id, userId: user.id };
}

export async function cancelAssignmentsAction(assignmentIds: string[]) {
  const ctx = await requireOrgAdmin();
  if (ctx.error || !ctx.orgId) return { ok: false as const, error: ctx.error ?? "Forbidden" };
  const ids = assignmentIds.filter(Boolean);
  if (ids.length === 0) return { ok: false as const, error: "No assignments selected" };

  const { error } = await ctx.supabase
    .from("assignments")
    .update({ status: "cancelled" })
    .in("id", ids)
    .eq("org_id", ctx.orgId);

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/dashboard/assignments");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/team");
  return { ok: true as const };
}

export async function createAssignmentsAction(input: {
  planId: string;
  mode: "individual" | "group" | "all";
  userId?: string;
  groupId?: string;
  dueDate?: string | null;
  scheduledFor?: string | null;
}) {
  const ctx = await requireOrgAdmin();
  if (ctx.error || !ctx.orgId || !ctx.userId) {
    return { ok: false as const, error: ctx.error ?? "Forbidden" };
  }

  const planId = input.planId?.trim();
  if (!planId) return { ok: false as const, error: "Plan is required" };

  const { data: plan } = await ctx.supabase
    .from("plans")
    .select("id")
    .eq("id", planId)
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  if (!plan) return { ok: false as const, error: "Plan not found" };

  const due =
    input.dueDate && input.dueDate.trim()
      ? new Date(input.dueDate).toISOString()
      : null;
  const scheduled =
    input.scheduledFor && input.scheduledFor.trim()
      ? new Date(input.scheduledFor).toISOString()
      : null;

  let targetUserIds: string[] = [];

  if (input.mode === "individual") {
    const uid = input.userId?.trim();
    if (!uid) return { ok: false as const, error: "Select an employee" };
    const { data: u } = await ctx.supabase
      .from("users")
      .select("id")
      .eq("id", uid)
      .eq("org_id", ctx.orgId)
      .eq("role", "employee")
      .maybeSingle();
    if (!u) return { ok: false as const, error: "Employee not found" };
    targetUserIds = [uid];
  } else if (input.mode === "group") {
    const gid = input.groupId?.trim();
    if (!gid) return { ok: false as const, error: "Select a group" };
    const { data: g } = await ctx.supabase
      .from("groups")
      .select("id")
      .eq("id", gid)
      .eq("org_id", ctx.orgId)
      .maybeSingle();
    if (!g) return { ok: false as const, error: "Group not found" };
    const { data: members } = await ctx.supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", gid);
    targetUserIds = (members ?? []).map((m) => m.user_id);
    if (targetUserIds.length === 0) {
      return { ok: false as const, error: "Group has no members" };
    }
  } else {
    const { data: emps } = await ctx.supabase
      .from("users")
      .select("id")
      .eq("org_id", ctx.orgId)
      .eq("role", "employee");
    targetUserIds = (emps ?? []).map((e) => e.id);
    if (targetUserIds.length === 0) {
      return { ok: false as const, error: "No employees in the organization" };
    }
  }

  const groupId =
    input.mode === "group" && input.groupId?.trim() ? input.groupId.trim() : null;

  const rows = targetUserIds.map((assigned_to) => ({
    org_id: ctx.orgId,
    plan_id: planId,
    assigned_to,
    assigned_by: ctx.userId,
    group_id: groupId,
    due_date: due,
    scheduled_for: scheduled,
    status: "active" as const,
  }));

  const { data: createdRows, error } = await ctx.supabase
    .from("assignments")
    .insert(rows)
    .select("id, assigned_to");
  if (error) return { ok: false as const, error: error.message };

  if (createdRows?.length) {
    await Promise.allSettled(
      createdRows.flatMap((row) => [
        notifySlackAssignmentOnCreate({
          orgId: ctx.orgId!,
          assignmentId: row.id,
          assigneeUserId: row.assigned_to,
        }),
        notifyTeamsAssignmentOnCreate({
          orgId: ctx.orgId!,
          assignmentId: row.id,
          assigneeUserId: row.assigned_to,
        }),
      ]),
    );
  }

  revalidatePath("/dashboard/assignments");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/team");
  return { ok: true as const, created: rows.length };
}

/** Single assignment from plan page — optional note shown to the employee. */
export async function assignPlanToEmployeeAction(input: {
  planId: string;
  employeeUserId: string;
  assignerNote?: string | null;
}) {
  const ctx = await requireOrgAdmin();
  if (ctx.error || !ctx.orgId || !ctx.userId) {
    return { ok: false as const, error: ctx.error ?? "Forbidden" };
  }

  const planId = input.planId?.trim();
  const employeeUserId = input.employeeUserId?.trim();
  if (!planId || !employeeUserId) {
    return { ok: false as const, error: "Plan and employee are required" };
  }

  const { data: plan } = await ctx.supabase
    .from("plans")
    .select("id")
    .eq("id", planId)
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  if (!plan) return { ok: false as const, error: "Plan not found" };

  const { data: emp } = await ctx.supabase
    .from("users")
    .select("id")
    .eq("id", employeeUserId)
    .eq("org_id", ctx.orgId)
    .eq("role", "employee")
    .maybeSingle();
  if (!emp) {
    return { ok: false as const, error: "Employee not found in your organization" };
  }

  const { data: existing } = await ctx.supabase
    .from("assignments")
    .select("id")
    .eq("plan_id", planId)
    .eq("assigned_to", employeeUserId)
    .eq("status", "active")
    .maybeSingle();
  if (existing) {
    return {
      ok: false as const,
      error:
        "This employee already has an active assignment for this plan. Cancel it first or pick another person.",
    };
  }

  const note = input.assignerNote?.trim() || null;

  const { data: created, error } = await ctx.supabase
    .from("assignments")
    .insert({
      org_id: ctx.orgId,
      plan_id: planId,
      assigned_to: employeeUserId,
      assigned_by: ctx.userId,
      assigner_note: note,
      status: "active",
    })
    .select("id, assigned_to")
    .single();

  if (error) return { ok: false as const, error: error.message };

  if (created) {
    await Promise.allSettled([
      notifySlackAssignmentOnCreate({
        orgId: ctx.orgId,
        assignmentId: created.id,
        assigneeUserId: created.assigned_to,
      }),
      notifyTeamsAssignmentOnCreate({
        orgId: ctx.orgId,
        assignmentId: created.id,
        assigneeUserId: created.assigned_to,
      }),
    ]);
  }

  revalidatePath(`/dashboard/plans/${planId}`);
  revalidatePath("/dashboard/assignments");
  revalidatePath("/dashboard");
  revalidatePath("/employee");
  revalidatePath("/employee/my-plans");
  return { ok: true as const };
}

function teamsPushMessage(result: TeamsAssignmentPushResult): string {
  if (result.ok) return "Sent Adaptive Card to Teams.";
  if (result.reason === "no_installation") {
    return "Teams is not connected (complete Integrations → Microsoft Teams).";
  }
  if (result.reason === "no_teams_user") {
    return "This employee has no Teams link — open Integrations → Sync Users, or ask them to message the bot once.";
  }
  return result.detail ?? "Teams send failed.";
}

/** Re-push assignment Adaptive Card(s) to Teams for testing or reminders. */
export async function pushAssignmentsToTeamsAction(assignmentIds: string[]) {
  const ctx = await requireOrgAdmin();
  if (ctx.error || !ctx.orgId) {
    return { ok: false as const, error: ctx.error ?? "Forbidden" };
  }

  const ids = [...new Set(assignmentIds.filter(Boolean))].slice(0, 40);
  if (ids.length === 0) {
    return { ok: false as const, error: "Select at least one assignment" };
  }

  const results: { assignmentId: string; success: boolean; message: string }[] =
    [];

  for (const assignmentId of ids) {
    const { data: row } = await ctx.supabase
      .from("assignments")
      .select("id, org_id, status, assigned_to")
      .eq("id", assignmentId)
      .maybeSingle();

    if (!row || row.org_id !== ctx.orgId) {
      results.push({
        assignmentId,
        success: false,
        message: "Assignment not found",
      });
      continue;
    }
    if (row.status === "cancelled") {
      results.push({
        assignmentId,
        success: false,
        message: "Cancelled assignments cannot be pushed",
      });
      continue;
    }

    const push = await notifyTeamsAssignmentOnCreate({
      orgId: ctx.orgId,
      assignmentId: row.id,
      assigneeUserId: row.assigned_to,
    });

    results.push({
      assignmentId,
      success: push.ok,
      message: teamsPushMessage(push),
    });
  }

  const sent = results.filter((r) => r.success).length;
  const failed = results.length - sent;

  revalidatePath("/dashboard/assignments");
  return {
    ok: true as const,
    sent,
    failed,
    results,
  };
}

export async function createGroupAction(name: string) {
  const ctx = await requireOrgAdmin();
  if (ctx.error || !ctx.orgId || !ctx.userId) {
    return { ok: false as const, error: ctx.error ?? "Forbidden" };
  }
  const n = name.trim();
  if (!n) return { ok: false as const, error: "Group name is required" };

  const { error } = await ctx.supabase.from("groups").insert({
    org_id: ctx.orgId,
    name: n,
    created_by: ctx.userId,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/dashboard/assignments");
  return { ok: true as const };
}

export async function addGroupMemberAction(groupId: string, userId: string) {
  const ctx = await requireOrgAdmin();
  if (ctx.error || !ctx.orgId) return { ok: false as const, error: ctx.error ?? "Forbidden" };

  const { data: g } = await ctx.supabase
    .from("groups")
    .select("id")
    .eq("id", groupId)
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  if (!g) return { ok: false as const, error: "Group not found" };

  const { data: u } = await ctx.supabase
    .from("users")
    .select("id")
    .eq("id", userId)
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  if (!u) return { ok: false as const, error: "User not found" };

  const { error } = await ctx.supabase.from("group_members").insert({
    group_id: groupId,
    user_id: userId,
  });
  if (error) {
    if (error.code === "23505") return { ok: true as const };
    return { ok: false as const, error: error.message };
  }
  revalidatePath("/dashboard/assignments");
  return { ok: true as const };
}

export async function removeGroupMemberAction(groupId: string, userId: string) {
  const ctx = await requireOrgAdmin();
  if (ctx.error || !ctx.orgId) return { ok: false as const, error: ctx.error ?? "Forbidden" };

  const { error } = await ctx.supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/dashboard/assignments");
  return { ok: true as const };
}
