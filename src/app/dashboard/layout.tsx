import Link from "next/link";
import { redirect } from "next/navigation";
import { Menu, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { provisionSignupIfNeeded } from "@/lib/auth/provisionSignup";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  DashboardHeaderContext,
  DashboardMobilePageLabel,
} from "@/components/dashboard/dashboard-header-context";
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
  let orgLogoUrl: string | null = null;
  if (profile?.org_id) {
    const { data: org } = await supabase
      .from("organisations")
      .select("name, logo_url")
      .eq("id", profile.org_id)
      .single();
    orgName = org?.name ?? orgName;
    orgLogoUrl = org?.logo_url ?? null;
  }

  const orgInitials = orgName
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "—";

  const headerDateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

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
              <div className="mt-1.5 flex items-center gap-2.5">
                {orgLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Supabase public URL
                  <img
                    src={orgLogoUrl}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-lg border border-sidebar-border object-cover"
                  />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-sidebar-border bg-sidebar text-[10px] font-semibold text-sidebar-foreground/80">
                    {orgInitials}
                  </div>
                )}
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-sidebar-foreground/90">
                  {orgName}
                </p>
              </div>
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
            <form action={logout}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  Sign out
                </TooltipContent>
              </Tooltip>
            </form>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-xl md:hidden">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="flex w-[min(100%,300px)] flex-col border-sidebar-border bg-sidebar p-0"
              >
                <SheetHeader className="shrink-0 border-b border-sidebar-border px-5 pb-4 pt-5">
                  <SheetTitle className="flex items-center gap-2.5 text-left text-sidebar-foreground">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-sidebar-border bg-sidebar-accent text-xs font-bold text-sidebar-foreground shadow-sm">
                      R
                    </div>
                    Recaller
                  </SheetTitle>
                </SheetHeader>
                <div className="shrink-0 px-4 pt-4">
                  <div className="rounded-xl border border-sidebar-border bg-sidebar-accent px-3 py-2.5">
                    <p className="text-[10px] font-medium uppercase tracking-widest text-sidebar-foreground/70">
                      Workspace
                    </p>
                    <div className="mt-1.5 flex items-center gap-2.5">
                      {orgLogoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- Supabase public URL
                        <img
                          src={orgLogoUrl}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-lg border border-sidebar-border object-cover"
                        />
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-sidebar-border bg-sidebar text-[10px] font-semibold text-sidebar-foreground/80">
                          {orgInitials}
                        </div>
                      )}
                      <p className="min-w-0 flex-1 truncate text-sm font-medium text-sidebar-foreground/90">
                        {orgName}
                      </p>
                    </div>
                  </div>
                </div>
                <Separator className="my-3 shrink-0 bg-sidebar-accent" />
                <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
                  <DashboardSidebarNav isAdmin={isAdmin} />
                </div>
              </SheetContent>
            </Sheet>
            <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sidebar-border bg-sidebar-accent text-[10px] font-bold text-sidebar-foreground">
                R
              </div>
              <DashboardMobilePageLabel />
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="max-w-[80px] truncate text-xs font-medium text-muted-foreground">
              {fullName.split(" ")[0]}
            </span>
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-secondary text-[9px] font-bold text-foreground">
                {getInitials(fullName)}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        <DashboardHeaderContext
          orgName={orgName}
          isAdmin={isAdmin}
          headerDateLabel={headerDateLabel}
        />

        {/* Page content */}
        <main className="relative z-10 flex-1 p-5 sm:p-6 md:p-8">
          <div className="relative mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
    </TooltipProvider>
  );
}
