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
    !profile?.org_id ||
    !["admin", "super_admin"].includes(profile.role)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sb = createAdminClient();

  await sb
    .from("teams_installations")
    .delete()
    .eq("org_id", profile.org_id);

  await sb
    .from("organisations")
    .update({ teams_tenant_id: null })
    .eq("id", profile.org_id);

  await sb
    .from("users")
    .update({ teams_user_id: null })
    .eq("org_id", profile.org_id);

  return NextResponse.json({ ok: true });
}
