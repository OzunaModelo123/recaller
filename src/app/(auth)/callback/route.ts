import { type NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";
import { provisionSignupIfNeeded } from "@/lib/auth/provisionSignup";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/post-login";
  const accessToken = requestUrl.searchParams.get("access_token");
  const refreshToken = requestUrl.searchParams.get("refresh_token");

  const successUrl = new URL(next, request.url);
  const response = NextResponse.redirect(successUrl);
  const supabase = createRouteHandlerClient(request, response);

  // Supabase invite acceptance can redirect with either:
  // - OAuth-style `code` (handled by exchangeCodeForSession), or
  // - `access_token` + `refresh_token` (handled by setSession).
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) return NextResponse.redirect(new URL("/login", request.url));
  } else if (accessToken && refreshToken) {
    const { error: setErr } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (setErr) return NextResponse.redirect(new URL("/login", request.url));
  } else {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const provisioned = await provisionSignupIfNeeded(supabase, user);
  if (!provisioned.ok) {
    const signout = new URL("/auth/signout", request.url);
    signout.searchParams.set("error", provisioned.error);
    return NextResponse.redirect(signout);
  }

  return response;
}
