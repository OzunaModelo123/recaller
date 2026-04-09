import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { loadLiveAnalytics } from "@/lib/dashboard/load-insights";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id || !["admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const tz = url.searchParams.get("tz")?.trim() || undefined;

  try {
    const analytics = await loadLiveAnalytics(profile.org_id, tz);
    return NextResponse.json(analytics);
  } catch (error) {
    console.error("[api/insights]", error);
    return NextResponse.json(
      { error: "Failed to load insights" },
      { status: 500 },
    );
  }
}
