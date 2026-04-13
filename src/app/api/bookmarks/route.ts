import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/** Resolve plan-linked content for an assignment the user actually owns. */
async function contentItemIdForUserAssignment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  assignmentId: string,
): Promise<string | null> {
  const { data: row, error } = await supabase
    .from("assignments")
    .select(
      `
      assigned_to,
      plans ( content_item_id )
    `,
    )
    .eq("id", assignmentId)
    .maybeSingle();

  if (error || !row || row.assigned_to !== userId) {
    return null;
  }

  const plans = row.plans;
  if (!plans || typeof plans !== "object") return null;
  const plan = Array.isArray(plans) ? plans[0] : plans;
  if (!plan || typeof plan !== "object") return null;
  const cid = (plan as { content_item_id?: string | null }).content_item_id;
  return cid ?? null;
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const assignmentId = searchParams.get("assignmentId");

    let contentFilter: string | null = null;
    if (assignmentId) {
      contentFilter = await contentItemIdForUserAssignment(
        supabase,
        user.id,
        assignmentId,
      );
      if (!contentFilter) {
        return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
      }
    }

    let query = supabase
      .from("employee_bookmarks")
      .select(
        `
        id,
        timestamp_seconds,
        highlight_text,
        note_text,
        created_at,
        content_item_id,
        content_items (
          title,
          source_url
        )
      `,
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (contentFilter) {
      query = query.eq("content_item_id", contentFilter);
    }

    const { data: bookmarks, error } = await query;

    if (error) {
      console.error("fetch bookmarks err", error);
      return NextResponse.json({ error: "DB Error" }, { status: 500 });
    }

    return NextResponse.json({ bookmarks });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

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
    const {
      assignmentId,
      timestampSeconds,
      highlightText,
      noteText,
      contentItemId: rawContentItemId,
    } = body as {
      assignmentId?: string;
      timestampSeconds?: number | null;
      highlightText?: string | null;
      noteText?: string | null;
      contentItemId?: string | null;
    };

    let content_item_id: string | null = null;

    if (assignmentId?.trim()) {
      content_item_id = await contentItemIdForUserAssignment(
        supabase,
        user.id,
        assignmentId.trim(),
      );
    }

    if (rawContentItemId?.trim()) {
      const override = rawContentItemId.trim();
      const { data: visible } = await supabase
        .from("content_items")
        .select("id")
        .eq("id", override)
        .maybeSingle();
      if (!visible) {
        return NextResponse.json(
          { error: "Content not found or not accessible" },
          { status: 403 },
        );
      }
      content_item_id = override;
    }

    if (!content_item_id) {
      return NextResponse.json(
        { error: "Could not determine content_item_id" },
        { status: 400 },
      );
    }

    const { data: bookmark, error } = await supabase
      .from("employee_bookmarks")
      .insert([
        {
          user_id: user.id,
          content_item_id,
          timestamp_seconds: timestampSeconds ?? null,
          highlight_text: highlightText ?? null,
          note_text: noteText ?? null,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error inserting bookmark", error);
      return NextResponse.json({ error: "Insertion failed" }, { status: 500 });
    }

    return NextResponse.json({ bookmark });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
