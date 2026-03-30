import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!existingUser) {
    const orgName = String(user.user_metadata?.org_name ?? "New Organization");
    const fullName =
      String(user.user_metadata?.full_name ?? "").trim() || user.email?.split("@")[0] || "Admin";

    const { data: org, error: orgError } = await supabase
      .from("organisations")
      .insert({ name: orgName })
      .select("id")
      .single();

    if (orgError || !org) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const { error: userError } = await supabase.from("users").insert({
      id: user.id,
      org_id: org.id,
      email: user.email ?? "",
      full_name: fullName,
      role: "admin",
    });

    if (userError) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}
