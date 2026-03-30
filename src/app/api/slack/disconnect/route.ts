import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST() {
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
    !profile ||
    !["admin", "super_admin"].includes(profile.role)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sb = createAdminClient();

  await sb
    .from("slack_installations")
    .delete()
    .eq("org_id", profile.org_id);

  await sb
    .from("organisations")
    .update({ slack_team_id: null, slack_admin_channel_id: null })
    .eq("id", profile.org_id);

  await sb
    .from("users")
    .update({ slack_user_id: null })
    .eq("org_id", profile.org_id)
    .not("slack_user_id", "is", null);

  return NextResponse.json({ ok: true });
}
