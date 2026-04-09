import { normalizePathname } from "@/lib/dashboard/nav-active";

/** Last segment label for desktop header / mobile context (no color changes). */
export function getDashboardRouteTitle(pathname: string): {
  parentLabel: string;
  pageLabel: string;
} {
  const p = normalizePathname(pathname);

  if (p === "/dashboard") {
    return { parentLabel: "Workspace", pageLabel: "Overview" };
  }

  if (p.startsWith("/dashboard/onboarding/context")) {
    return { parentLabel: "Onboarding", pageLabel: "Company context" };
  }

  if (p.startsWith("/dashboard/content/upload")) {
    return { parentLabel: "Content", pageLabel: "Upload" };
  }

  if (p.startsWith("/dashboard/content/") && p !== "/dashboard/content") {
    return { parentLabel: "Content", pageLabel: "Item" };
  }

  const segments: Record<string, string> = {
    "/dashboard/content": "Library",
    "/dashboard/plans": "Plans",
    "/dashboard/assignments": "Assignments",
    "/dashboard/team": "Team",
    "/dashboard/insights": "Insights",
    "/dashboard/integrations": "Integrations",
    "/dashboard/settings": "Settings",
  };

  for (const [prefix, label] of Object.entries(segments)) {
    if (p === prefix) {
      return { parentLabel: "Workspace", pageLabel: label };
    }
    if (p.startsWith(`${prefix}/`)) {
      if (prefix === "/dashboard/plans") {
        return { parentLabel: "Plans", pageLabel: "Editor" };
      }
      if (prefix === "/dashboard/team") {
        return { parentLabel: "Team", pageLabel: "Member" };
      }
      return { parentLabel: label, pageLabel: "Details" };
    }
  }

  return { parentLabel: "Workspace", pageLabel: "Dashboard" };
}
