import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: notes, error } = await supabase
      .from("employee_notes")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("fetch notes error", error);
      return NextResponse.json({ error: "DB Error" }, { status: 500 });
    }

    return NextResponse.json({ notes });
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
      id,
      title,
      content_json,
      content_html,
      tags,
      assignment_id,
      content_item_id,
    } = body as {
      id?: string;
      title?: string;
      content_json?: unknown;
      content_html?: string | null;
      tags?: unknown;
      assignment_id?: string | null;
      content_item_id?: string | null;
    };

    // Get org_id for the user
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("org_id")
      .eq("id", user.id)
      .single();

    if (userError || !userData?.org_id) {
      return NextResponse.json({ error: "User org not found" }, { status: 400 });
    }

    const tagArray = Array.isArray(tags)
      ? tags.map((t) => String(t))
      : [];

    if (assignment_id) {
      const { data: a } = await supabase
        .from("assignments")
        .select("id")
        .eq("id", assignment_id)
        .eq("assigned_to", user.id)
        .maybeSingle();
      if (!a) {
        return NextResponse.json(
          { error: "Invalid assignment for this user" },
          { status: 400 },
        );
      }
    }

    if (content_item_id) {
      const { data: c } = await supabase
        .from("content_items")
        .select("id")
        .eq("id", content_item_id)
        .maybeSingle();
      if (!c) {
        return NextResponse.json(
          { error: "Content not found or not accessible" },
          { status: 400 },
        );
      }
    }

    const now = new Date().toISOString();

    if (id) {
      // Update existing note
      const { data, error } = await supabase
        .from("employee_notes")
        .update({
          title,
          content_json,
          content_html,
          tags: tagArray,
          updated_at: now,
        })
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) {
        console.error("update note err", error);
        return NextResponse.json({ error: "Update failed" }, { status: 500 });
      }
      return NextResponse.json({ note: data });
    } else {
      // Insert new note
      const { data, error } = await supabase
        .from("employee_notes")
        .insert([
          {
            user_id: user.id,
            org_id: userData.org_id,
            assignment_id: assignment_id ?? null,
            content_item_id: content_item_id ?? null,
            title: title || "Untitled Document",
            content_json,
            content_html,
            tags: tagArray,
            created_at: now,
            updated_at: now,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("insert note err", error);
        return NextResponse.json({ error: "Insert failed" }, { status: 500 });
      }
      return NextResponse.json({ note: data });
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
