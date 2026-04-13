import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { assignmentId, action, watchTimeSeconds } = body;

    if (!assignmentId || !action) {
      return NextResponse.json(
        { error: "Missing assignmentId or action" },
        { status: 400 },
      );
    }

    // Verify assignment belongs to user
    const { data: assignment, error: assErr } = await supabase
      .from("assignments")
      .select("id, assigned_to, content_consumed, require_content_consumption")
      .eq("id", assignmentId)
      .eq("assigned_to", user.id)
      .single();

    if (assErr || !assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    // Handle Heartbeat
    if (action === "heartbeat") {
      if (!assignment.require_content_consumption) {
        return NextResponse.json(
          { error: "Content consumption is not tracked for this assignment" },
          { status: 400 },
        );
      }

      const wTime = watchTimeSeconds ? Number(watchTimeSeconds) : null;
      if (wTime === null || isNaN(wTime)) {
        return NextResponse.json({ error: "Invalid watch time" }, { status: 400 });
      }

      const { data: existing } = await supabase
        .from("content_consumptions")
        .select("id, watch_time_seconds")
        .eq("assignment_id", assignmentId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        if (wTime > existing.watch_time_seconds) {
          await supabase
            .from("content_consumptions")
            .update({ watch_time_seconds: Math.round(wTime), updated_at: new Date().toISOString() })
            .eq("id", existing.id);
        }
      } else {
        await supabase.from("content_consumptions").insert({
          assignment_id: assignmentId,
          user_id: user.id,
          watch_time_seconds: Math.round(wTime),
          platform: "web",
        });
      }
      return NextResponse.json({ ok: true });
    }

    // Handle Complete
    if (action === "complete") {
      if (!assignment.require_content_consumption) {
        return NextResponse.json(
          { error: "Content consumption is not required for this assignment" },
          { status: 400 },
        );
      }

      const { data: existing } = await supabase
        .from("content_consumptions")
        .select("id")
        .eq("assignment_id", assignmentId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("content_consumptions")
          .update({
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("content_consumptions").insert({
          assignment_id: assignmentId,
          user_id: user.id,
          completed_at: new Date().toISOString(),
          watch_time_seconds: Math.round(watchTimeSeconds || 0),
          platform: "web",
        });
      }

      // Bypass RLS to mark assignment as consumed
      if (!assignment.content_consumed) {
        const adminDb = createAdminClient();
        const { error: completeErr } = await adminDb
          .from("assignments")
          .update({ content_consumed: true })
          .eq("id", assignmentId);

        if (completeErr) {
          console.error("[consumptions] failed to mark content consumed", completeErr);
          return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
        }
      }

      const { inngest } = await import("@/lib/inngest/client");
      await inngest.send({
        name: "content/consumption.completed",
        data: { assignmentId, userId: user.id },
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("[consumptions API path]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
