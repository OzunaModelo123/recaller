/**
 * Redirects admin to Microsoft identity platform consent flow.
 * After consent, Microsoft redirects back to /api/teams/oauth.
 */
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const appId = process.env.TEAMS_APP_ID;
  const tenantId = process.env.TEAMS_TENANT_ID;
  const origin = process.env.NEXT_PUBLIC_APP_URL;

  if (!appId || !tenantId || !origin) {
    return NextResponse.json(
      { error: "Teams environment variables not configured" },
      { status: 500 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
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
    return NextResponse.redirect(`${origin}/dashboard/integrations?teams=error&reason=forbidden`);
  }

  const state = Buffer.from(
    JSON.stringify({ orgId: profile.org_id }),
  ).toString("base64url");

  const redirectUri = `${origin}/api/teams/oauth`;

  const authUrl = new URL(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
  );
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", "https://graph.microsoft.com/.default");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("response_mode", "query");

  return NextResponse.redirect(authUrl.toString());
}
