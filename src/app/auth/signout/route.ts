import { type NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

/**
 * Clears the Supabase session (cookie writes only happen here, in a Route Handler).
 * Optional `error` query param is forwarded to `/login` for signup provisioning failures.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const error = requestUrl.searchParams.get("error");

  const loginUrl = new URL("/login", request.url);
  if (error) {
    loginUrl.searchParams.set("error", error);
  }

  const redirectResponse = NextResponse.redirect(loginUrl);
  const supabase = createRouteHandlerClient(request, redirectResponse);
  await supabase.auth.signOut();

  return redirectResponse;
}
