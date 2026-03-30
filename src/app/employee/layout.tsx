import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, Menu } from "lucide-react";

import { EmployeeSidebarNav } from "@/components/employee/employee-sidebar-nav";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getEmployeeSessionProfile } from "@/lib/employee/session-profile";
import { createClient } from "@/lib/supabase/server";

export default async function EmployeeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) {
    redirect("/login");
  }

  const profile = await getEmployeeSessionProfile(user.id, user.email);

  if (!profile) {
    redirect("/post-login");
  }

  if (profile.role === "admin" || profile.role === "super_admin") {
    redirect("/dashboard");
  }

  async function logout() {
    "use server";
    const scoped = await createClient();
    await scoped.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
        <div className="flex h-full flex-col px-4 py-5">
          <Link
            href="/employee"
            className="flex items-start gap-2.5 rounded-xl px-1 py-0.5 transition-colors hover:bg-sidebar-accent"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sidebar-border bg-sidebar-accent text-xs font-bold text-sidebar-foreground shadow-sm">
              R
            </div>
            <div className="min-w-0 pt-0.5">
              <span className="block text-sm font-semibold tracking-tight text-sidebar-foreground">
                Recaller
              </span>
              <span className="mt-0.5 block truncate text-[11px] font-medium leading-tight text-sidebar-foreground/70">
                {profile.orgName}
              </span>
            </div>
          </Link>

          <EmployeeSidebarNav className="mt-6 flex-1" />

          <div className="mt-auto flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent px-2 py-2">
            <Avatar className="h-8 w-8 ring-2 ring-sidebar-accent">
              <AvatarFallback className="bg-sidebar-accent text-[10px] font-bold text-sidebar-foreground">
                {profile.initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sidebar-foreground/90">
                {profile.fullName}
              </p>
              <p className="text-[11px] text-sidebar-foreground/70">Employee</p>
            </div>
            <form action={logout}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-sidebar-foreground/70 hover:text-sidebar-foreground"
                aria-label="Log out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-xl md:hidden">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-[min(100%,280px)] flex-col border-sidebar-border bg-sidebar p-0">
                <SheetHeader className="border-b border-sidebar-border px-5 pb-4 pt-5 text-left">
                  <SheetTitle className="flex items-start gap-2.5 text-left font-semibold text-sidebar-foreground">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sidebar-border bg-sidebar-accent text-xs font-bold text-sidebar-foreground shadow-sm">
                      R
                    </div>
                    <span className="min-w-0 pt-0.5">
                      <span className="block">Recaller</span>
                      <span className="mt-0.5 block truncate text-xs font-medium text-sidebar-foreground/70">
                        {profile.orgName}
                      </span>
                    </span>
                  </SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto px-4 py-4">
                  <EmployeeSidebarNav />
                </div>
                <div className="border-t border-sidebar-border p-4">
                  <div className="flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent px-2 py-2">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-sidebar-accent text-[10px] font-bold text-sidebar-foreground">
                        {profile.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-sidebar-foreground/90">
                        {profile.fullName}
                      </p>
                      <p className="truncate text-xs text-sidebar-foreground/70">{profile.email}</p>
                    </div>
                  </div>
                  <form action={logout} className="mt-3">
                    <Button
                      type="submit"
                      variant="outline"
                      className="h-10 w-full rounded-xl"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Log out
                    </Button>
                  </form>
                </div>
              </SheetContent>
            </Sheet>
            <Link
              href="/employee"
              className="flex min-w-0 items-center gap-2.5 rounded-lg py-1 pr-1"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sidebar-border bg-sidebar-accent text-[10px] font-bold text-sidebar-foreground">
                R
              </div>
              <div className="min-w-0 text-left">
                <p className="truncate text-sm font-semibold text-sidebar-foreground">Recaller</p>
                <p className="truncate text-[10px] font-medium text-sidebar-foreground/70">
                  {profile.orgName}
                </p>
              </div>
            </Link>
          </div>
        </header>

        <main className="relative z-10 flex-1 p-6 md:p-8">
          <div className="relative max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
