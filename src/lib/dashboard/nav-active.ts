/** Normalize pathname for route matching (trailing slash). */
export function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  return pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
}

/**
 * True when this nav href is the current route.
 * `/dashboard` (Overview) matches only exactly `/dashboard`, not child routes.
 */
export function isDashboardNavActive(pathname: string, href: string): boolean {
  const p = normalizePathname(pathname);
  const h = normalizePathname(href);
  if (h === "/dashboard") {
    return p === "/dashboard";
  }
  return p === h || p.startsWith(`${h}/`);
}
