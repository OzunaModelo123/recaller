import Link from "next/link";
import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  FileVideo,
  ClipboardList,
  Users,
  BarChart3,
  Settings,
  Menu,
  LogOut,
  Building2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/dashboard/content", label: "Content", icon: <FileVideo className="h-4 w-4" /> },
  { href: "/dashboard/assignments", label: "Assignments", icon: <ClipboardList className="h-4 w-4" /> },
  { href: "/dashboard/team", label: "Team", icon: <Users className="h-4 w-4" />, adminOnly: true },
  { href: "/dashboard/insights", label: "Insights", icon: <BarChart3 className="h-4 w-4" />, adminOnly: true },
  { href: "/dashboard/settings", label: "Settings", icon: <Settings className="h-4 w-4" />, adminOnly: true },
];

function Navigation({
  isAdmin,
  className,
}: {
  isAdmin: boolean;
  className?: string;
}) {
  return (
    <nav className={className}>
      {navItems
        .filter((item) => !item.adminOnly || isAdmin)
        .map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
    </nav>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, role, org_id")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? "employee";
  const isAdmin = role === "admin" || role === "super_admin";
  const fullName = profile?.full_name || user.email?.split("@")[0] || "User";

  let orgName = "Organization";
  if (profile?.org_id) {
    const { data: org } = await supabase
      .from("organisations")
      .select("name")
      .eq("id", profile.org_id)
      .single();
    orgName = org?.name ?? orgName;
  }

  async function logout() {
    "use server";
    const scoped = await createClient();
    await scoped.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Top header */}
      <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Mobile menu */}
            <Sheet>
              <SheetTrigger asChild>
                <Button className="md:hidden" size="icon" variant="ghost">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2 text-left">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-xs font-bold text-white">
                      R
                    </div>
                    Recaller
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-2 px-1">
                  <div className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2">
                    <Building2 className="h-4 w-4 text-zinc-400" />
                    <span className="text-sm font-medium text-zinc-700">{orgName}</span>
                  </div>
                </div>
                <Navigation className="mt-3 flex flex-col gap-0.5 px-1" isAdmin={isAdmin} />
              </SheetContent>
            </Sheet>

            {/* Logo */}
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-xs font-bold text-white">
                R
              </div>
              <span className="hidden text-sm font-semibold sm:inline">Recaller</span>
            </Link>

            <Separator orientation="vertical" className="mx-1 hidden h-5 md:block" />
            <span className="hidden text-sm text-zinc-500 md:inline">{orgName}</span>
          </div>

          {/* User area */}
          <div className="flex items-center gap-3">
            <div className="hidden flex-col items-end sm:flex">
              <span className="text-sm font-medium text-zinc-800">{fullName}</span>
              <Badge variant="secondary" className="text-[10px] uppercase">
                {role === "super_admin" ? "Super Admin" : role}
              </Badge>
            </div>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-zinc-200 text-xs font-semibold text-zinc-700">
                {getInitials(fullName)}
              </AvatarFallback>
            </Avatar>
            <form action={logout}>
              <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-zinc-800">
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[240px_1fr]">
        {/* Desktop sidebar */}
        <aside className="hidden md:block">
          <div className="sticky top-20 space-y-4">
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-zinc-400" />
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Organization
                </span>
              </div>
              <p className="text-sm font-semibold text-zinc-800">{orgName}</p>
            </div>
            <div className="rounded-xl border bg-white p-3 shadow-sm">
              <Navigation className="flex flex-col gap-0.5" isAdmin={isAdmin} />
            </div>
          </div>
        </aside>

        {/* Page content */}
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
