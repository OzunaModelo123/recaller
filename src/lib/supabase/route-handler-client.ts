import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

/**
 * Supabase browser session on Route Handlers: read cookies from the incoming Request
 * (same source as middleware) instead of only `cookies()` from `next/headers`, which can
 * disagree with the POST body in some invite / setup-password flows.
 */
export function createSupabaseRouteHandlerClient(request: NextRequest) {
  const pending: { name: string; value: string; options?: Parameters<NextResponse["cookies"]["set"]>[2] }[] =
    [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            pending.push({ name, value, options });
          });
        },
      },
    },
  );

  function applyCookies(response: NextResponse) {
    pending.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });
  }

  return { supabase, applyCookies };
}
