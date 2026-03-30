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
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { provisionSignupIfNeeded } from "@/lib/auth/provisionSignup";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: <LayoutDashboard className="h-[18px] w-[18px]" /> },
  { href: "/dashboard/content", label: "Content", icon: <FileVideo className="h-[18px] w-[18px]" /> },
  { href: "/dashboard/assignments", label: "Assignments", icon: <ClipboardList className="h-[18px] w-[18px]" /> },
  { href: "/dashboard/team", label: "Team", icon: <Users className="h-[18px] w-[18px]" />, adminOnly: true },
  { href: "/dashboard/insights", label: "Insights", icon: <BarChart3 className="h-[18px] w-[18px]" />, adminOnly: true },
  { href: "/dashboard/settings", label: "Settings", icon: <Settings className="h-[18px] w-[18px]" />, adminOnly: true },
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
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-stone-500 transition-all hover:bg-stone-100 hover:text-stone-900"
          >
            <span className="text-stone-400 transition-colors group-hover:text-stone-600">
              {item.icon}
            </span>
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

  const adminDb = createAdminClient();

  let { data: profile } = await adminDb
    .from("users")
    .select("full_name, role, org_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    const provisioned = await provisionSignupIfNeeded(supabase, user);
    if (!provisioned.ok) {
      redirect(
        `/auth/signout?error=${encodeURIComponent(provisioned.error)}`,
      );
    }
    const { data: refetched } = await adminDb
      .from("users")
      .select("full_name, role, org_id")
      .eq("id", user.id)
      .maybeSingle();
    profile = refetched;
  }

  const role = profile?.role ?? "employee";
  const isAdmin = role === "admin" || role === "super_admin";
  const fullName = profile?.full_name || user.email?.split("@")[0] || "User";

  if (role === "employee") {
    redirect("/employee/my-plans");
  }

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
    <TooltipProvider delayDuration={0}>
      <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-stone-150 bg-stone-50/50 md:flex md:flex-col">
        <div className="flex h-full flex-col px-4 py-5">
          {/* Logo + org */}
          <div className="space-y-4">
            <Link href="/dashboard" className="flex items-center gap-2.5 px-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-stone-800 to-stone-900 text-xs font-bold text-white shadow-sm">
                R
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-tight text-stone-900">
                  Recaller
                </p>
              </div>
            </Link>

            <div className="rounded-xl bg-stone-100/80 px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">
                Workspace
              </p>
              <p className="mt-0.5 truncate text-sm font-medium text-stone-700">
                {orgName}
              </p>
            </div>
          </div>

          {/* Navigation */}
          <Separator className="my-4 bg-stone-150" />
          <Navigation className="flex flex-1 flex-col gap-0.5" isAdmin={isAdmin} />

          {/* User footer */}
          <Separator className="mb-3 bg-stone-150" />
          <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
            <Avatar className="h-8 w-8 ring-2 ring-stone-100">
              <AvatarFallback className="bg-gradient-to-br from-stone-200 to-stone-300 text-[10px] font-bold text-stone-600">
                {getInitials(fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-stone-800">
                {fullName}
              </p>
              <p className="truncate text-[11px] text-stone-400">
                {role === "super_admin" ? "Super Admin" : role.charAt(0).toUpperCase() + role.slice(1)}
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <form action={logout}>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-400 hover:text-stone-700">
                    <LogOut className="h-4 w-4" />
                  </Button>
                </form>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                Sign out
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-stone-150 bg-white/80 px-4 py-3 backdrop-blur-xl md:hidden">
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button size="icon" variant="ghost" className="h-9 w-9">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 border-stone-150 bg-stone-50 p-0">
                <SheetHeader className="px-5 pt-5">
                  <SheetTitle className="flex items-center gap-2.5 text-left">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-stone-800 to-stone-900 text-xs font-bold text-white shadow-sm">
                      R
                    </div>
                    Recaller
                  </SheetTitle>
                </SheetHeader>
                <div className="px-4 pt-4">
                  <div className="rounded-xl bg-stone-100/80 px-3 py-2.5">
                    <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">
                      Workspace
                    </p>
                    <p className="mt-0.5 truncate text-sm font-medium text-stone-700">
                      {orgName}
                    </p>
                  </div>
                </div>
                <Separator className="my-3 mx-4 bg-stone-150" />
                <Navigation className="flex flex-col gap-0.5 px-4" isAdmin={isAdmin} />
              </SheetContent>
            </Sheet>
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-stone-800 to-stone-900 text-xs font-bold text-white">
                R
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-stone-500">{fullName.split(" ")[0]}</span>
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-gradient-to-br from-stone-200 to-stone-300 text-[9px] font-bold text-stone-600">
                {getInitials(fullName)}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Desktop top bar — breadcrumb area */}
        <header className="hidden border-b border-stone-100 bg-white/60 backdrop-blur-sm md:flex md:items-center md:justify-between md:px-8 md:py-4">
          <div className="flex items-center gap-2 text-sm text-stone-400">
            <Link href="/dashboard" className="transition-colors hover:text-stone-600">
              {orgName}
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="font-medium text-stone-700">Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-400">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
    </TooltipProvider>
  );
}
