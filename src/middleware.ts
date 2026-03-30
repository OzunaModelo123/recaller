import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

function isProtectedPath(pathname: string) {
  return pathname.startsWith("/dashboard") || pathname.startsWith("/employee");
}

function employeeInviteNeedsPassword(user: User | null): boolean {
  if (!user) return false;
  const meta = user.user_metadata ?? {};
  const invited =
    typeof meta.invited_org_id === "string" && meta.invited_org_id.length > 0;
  const set =
    typeof meta.password_set_at === "string" && meta.password_set_at.length > 0;
  return invited && !set;
}

function isAuthPath(pathname: string) {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/callback")
  );
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (
    user &&
    pathname.startsWith("/employee") &&
    !pathname.startsWith("/employee/setup-password") &&
    employeeInviteNeedsPassword(user)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/employee/setup-password";
    return NextResponse.redirect(url);
  }

  if (
    user &&
    pathname.startsWith("/dashboard") &&
    !pathname.startsWith("/dashboard/onboarding")
  ) {
    const { data: urow } = await supabase
      .from("users")
      .select("org_id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (
      urow &&
      (urow.role === "admin" || urow.role === "super_admin") &&
      urow.org_id
    ) {
      const { data: org } = await supabase
        .from("organisations")
        .select("onboarding_completed")
        .eq("id", urow.org_id)
        .maybeSingle();

      if (org && !org.onboarding_completed) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard/onboarding/context";
        return NextResponse.redirect(url);
      }
    }
  }

  if (user && isAuthPath(pathname)) {
    // Logged-in users are usually sent to the dashboard, but if signup provisioning
    // failed we redirect to /login?error=... — without this bypass, that becomes an
    // infinite redirect loop with the dashboard layout.
    if (pathname.startsWith("/login") && request.nextUrl.searchParams.has("error")) {
      return response;
    }
    const url = request.nextUrl.clone();
    url.pathname = "/post-login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
