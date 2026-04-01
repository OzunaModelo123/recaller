/**
 * Admin-only endpoint to re-run Teams user mapping without full reconnection.
 * Fetches all users from Microsoft Graph and matches them by email to Recaller users.
 */
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGraphAccessToken } from "@/lib/teams/graphClient";
import { mapTeamsUsersToRecaller } from "@/lib/teams/mapTeamsUsersToRecaller";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST() {
  // Authenticate the calling admin.
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
    !["admin", "super_admin"].includes(profile.role ?? "")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sb = createAdminClient();
  const { data: org } = await sb
    .from("organisations")
    .select("teams_tenant_id")
    .eq("id", profile.org_id)
    .single();

  if (!org?.teams_tenant_id) {
    return NextResponse.json(
      { error: "Teams is not connected for your organisation." },
      { status: 400 },
    );
  }

  try {
    const graphToken = await getGraphAccessToken();
    const { mapped } = await mapTeamsUsersToRecaller(graphToken, profile.org_id);
    return NextResponse.json({ ok: true, mapped });
  } catch (err) {
    console.error("[Teams resync]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Unknown error during resync.",
      },
      { status: 500 },
    );
  }
}
