import Link from "next/link";
import { redirect } from "next/navigation";
import { Menu, LogOut, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { provisionSignupIfNeeded } from "@/lib/auth/provisionSignup";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { DashboardHeaderQuickLinks } from "@/components/dashboard/dashboard-header-quick-links";
import { DashboardSidebarNav } from "@/components/dashboard/dashboard-sidebar-nav";
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
    redirect("/employee");
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
      <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
        <div className="flex h-full flex-col px-4 py-5">
          {/* Logo + org */}
          <div className="space-y-4">
            <Link href="/dashboard" className="flex items-center gap-2.5 px-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-sidebar-border bg-sidebar-accent text-xs font-bold text-sidebar-foreground shadow-sm">
                R
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">
                  Recaller
                </p>
              </div>
            </Link>

            <div className="rounded-xl border border-sidebar-border bg-sidebar-accent px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-widest text-sidebar-foreground/70">
                Workspace
              </p>
              <p className="mt-0.5 truncate text-sm font-medium text-sidebar-foreground/90">
                {orgName}
              </p>
            </div>
          </div>

          {/* Navigation */}
          <Separator className="my-4 bg-sidebar-accent" />
          <DashboardSidebarNav
            isAdmin={isAdmin}
            className="flex-1"
          />

          {/* User footer */}
          <Separator className="mb-3 bg-sidebar-accent" />
          <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
            <Avatar className="h-8 w-8 ring-2 ring-sidebar-accent">
              <AvatarFallback className="bg-sidebar-accent text-[10px] font-bold text-sidebar-foreground">
                {getInitials(fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sidebar-foreground/90">
                {fullName}
              </p>
              <p className="truncate text-[11px] text-sidebar-foreground/70">
                {role === "super_admin" ? "Super Admin" : role.charAt(0).toUpperCase() + role.slice(1)}
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <form action={logout}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground"
                  >
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
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur-xl md:hidden">
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button size="icon" variant="ghost" className="h-9 w-9">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[min(100%,280px)] border-sidebar-border bg-sidebar p-0">
                <SheetHeader className="px-5 pt-5">
                  <SheetTitle className="flex items-center gap-2.5 text-left">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-sidebar-border bg-sidebar-accent text-xs font-bold text-sidebar-foreground shadow-sm">
                      R
                    </div>
                    Recaller
                  </SheetTitle>
                </SheetHeader>
                <div className="px-4 pt-4">
                  <div className="rounded-xl border border-sidebar-border bg-sidebar-accent px-3 py-2.5">
                    <p className="text-[10px] font-medium uppercase tracking-widest text-sidebar-foreground/70">
                      Workspace
                    </p>
                    <p className="mt-0.5 truncate text-sm font-medium text-sidebar-foreground/90">
                      {orgName}
                    </p>
                  </div>
                </div>
                <Separator className="my-3 mx-4 bg-sidebar-accent" />
                <DashboardSidebarNav isAdmin={isAdmin} className="px-4" />
              </SheetContent>
            </Sheet>
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-sidebar-border bg-sidebar-accent text-xs font-bold text-sidebar-foreground">
                R
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-sidebar-foreground/70">
              {fullName.split(" ")[0]}
            </span>
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-sidebar-accent text-[9px] font-bold text-sidebar-foreground">
                {getInitials(fullName)}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Desktop top bar — breadcrumb area */}
        <header className="hidden border-b border-border bg-card/60 backdrop-blur-sm md:flex md:flex-wrap md:items-center md:justify-between md:gap-3 md:px-8 md:py-4">
          <div className="flex items-center gap-2 text-base text-muted-foreground">
            <Link href="/dashboard" className="transition-colors hover:text-foreground/90">
              {orgName}
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="font-semibold text-foreground">Dashboard</span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {isAdmin ? <DashboardHeaderQuickLinks /> : null}
            <span className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="relative z-10 flex-1 p-6 md:p-8">
          <div className="relative max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
    </TooltipProvider>
  );
}
