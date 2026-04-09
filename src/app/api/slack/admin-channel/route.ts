import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  logPostgrestError,
  sanitizedPostgrestError,
} from "@/lib/supabase/sanitized-error";

export const runtime = "nodejs";

/** Saves the read-only admin notification channel (Slack channel ID C…). */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (
    !profile?.org_id ||
    !["admin", "super_admin"].includes(profile.role)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { channelId?: string | null };
  try {
    body = (await request.json()) as { channelId?: string | null };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = body.channelId?.trim() ?? "";
  const channelId = raw === "" ? null : raw;

  const sb = createAdminClient();
  const { error } = await sb
    .from("organisations")
    .update({ slack_admin_channel_id: channelId })
    .eq("id", profile.org_id);

  if (error) {
    logPostgrestError("api/slack/admin-channel", error);
    return NextResponse.json(
      { error: sanitizedPostgrestError(error) },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
