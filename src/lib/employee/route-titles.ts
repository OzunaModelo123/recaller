import { normalizePathname } from "@/lib/dashboard/nav-active";

export function getEmployeeRouteTitle(pathname: string): {
  sectionLabel: string;
  pageLabel: string;
} {
  const p = normalizePathname(pathname);

  if (p === "/employee" || p === "/employee/home") {
    return { sectionLabel: "Employee", pageLabel: "Home" };
  }

  if (p.startsWith("/employee/my-plans/") && p !== "/employee/my-plans") {
    return { sectionLabel: "Training", pageLabel: "Assignment" };
  }

  if (p.startsWith("/employee/my-plans")) {
    return { sectionLabel: "Training", pageLabel: "My plans" };
  }

  if (p.startsWith("/employee/profile")) {
    return { sectionLabel: "Account", pageLabel: "Profile" };
  }

  if (p.startsWith("/employee/integrations")) {
    return { sectionLabel: "Connections", pageLabel: "Integrations" };
  }

  if (p.startsWith("/employee/daily-recall")) {
    return { sectionLabel: "Learning", pageLabel: "Daily recall" };
  }

  if (p.startsWith("/employee/notes")) {
    return { sectionLabel: "Workspace", pageLabel: "My notes" };
  }

  if (p.startsWith("/employee/setup-password")) {
    return { sectionLabel: "Account", pageLabel: "Set password" };
  }

  return { sectionLabel: "Employee", pageLabel: "Home" };
}
