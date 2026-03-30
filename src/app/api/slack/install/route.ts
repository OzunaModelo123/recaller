import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { signSlackOAuthState } from "@/lib/slack/oauth-state";

export const runtime = "nodejs";

const SCOPES = [
  "chat:write",
  "commands",
  "im:history",
  "im:read",
  "im:write",
  "users:read",
  "users:read.email",
  "channels:read",
].join(",");

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const dest = new URL("/login", process.env.NEXT_PUBLIC_APP_URL!);
    dest.searchParams.set("next", "/dashboard/settings");
    return NextResponse.redirect(dest.toString());
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
    const dest = new URL("/dashboard/settings", process.env.NEXT_PUBLIC_APP_URL!);
    dest.searchParams.set("slack", "error");
    dest.searchParams.set("reason", "forbidden");
    return NextResponse.redirect(dest.toString());
  }

  const clientId = process.env.SLACK_CLIENT_ID!;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/slack/oauth`;

  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set(
    "state",
    signSlackOAuthState(profile.org_id, user.id, "admin_workspace"),
  );

  return NextResponse.redirect(url.toString());
}
