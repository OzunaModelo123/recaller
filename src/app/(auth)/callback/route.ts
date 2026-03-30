import { type NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";
import { provisionSignupIfNeeded } from "@/lib/auth/provisionSignup";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/post-login";

  if (!code) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const successUrl = new URL(next, request.url);
  const response = NextResponse.redirect(successUrl);
  const supabase = createRouteHandlerClient(request, response);

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

  const provisioned = await provisionSignupIfNeeded(supabase, user);
  if (!provisioned.ok) {
    const signout = new URL("/auth/signout", request.url);
    signout.searchParams.set("error", provisioned.error);
    return NextResponse.redirect(signout);
  }

  return response;
}
