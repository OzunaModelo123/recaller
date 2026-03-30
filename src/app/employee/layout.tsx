import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, LogOut, Menu } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export default async function EmployeeLayout({
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
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/post-login");
  }

  if (profile.role === "admin" || profile.role === "super_admin") {
    redirect("/dashboard");
  }

  const fullName = profile.full_name || user.email?.split("@")[0] || "User";
  const initials = fullName
    .split(" ")
    .map((w: string) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function logout() {
    "use server";
    const scoped = await createClient();
    await scoped.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-stone-150 bg-stone-50/50 md:flex md:flex-col">
        <div className="flex h-full flex-col px-4 py-5">
          <Link href="/employee/my-plans" className="flex items-center gap-2.5 px-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-stone-800 to-stone-900 text-xs font-bold text-white shadow-sm">
              R
            </div>
            <span className="text-sm font-semibold tracking-tight text-stone-900">
              Recaller
            </span>
          </Link>

          <nav className="mt-6 flex flex-1 flex-col gap-0.5">
            <Link
              href="/employee/my-plans"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-stone-500 transition-all hover:bg-stone-100 hover:text-stone-900"
            >
              <BookOpen className="h-[18px] w-[18px] text-stone-400" />
              My Plans
            </Link>
          </nav>

          <div className="mt-auto flex items-center gap-3 rounded-xl px-2 py-1.5">
            <Avatar className="h-8 w-8 ring-2 ring-stone-100">
              <AvatarFallback className="bg-gradient-to-br from-stone-200 to-stone-300 text-[10px] font-bold text-stone-600">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-stone-800">{fullName}</p>
              <p className="text-[11px] text-stone-400">Employee</p>
            </div>
            <form action={logout}>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-400 hover:text-stone-700">
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main area */}
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
              <SheetContent side="left" className="w-64 border-stone-150 bg-stone-50 p-0">
                <SheetHeader className="px-5 pt-5">
                  <SheetTitle className="flex items-center gap-2.5 text-left">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-stone-800 to-stone-900 text-xs font-bold text-white shadow-sm">
                      R
                    </div>
                    Recaller
                  </SheetTitle>
                </SheetHeader>
                <nav className="mt-4 px-4">
                  <Link
                    href="/employee/my-plans"
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-stone-500 transition-all hover:bg-stone-100 hover:text-stone-900"
                  >
                    <BookOpen className="h-[18px] w-[18px] text-stone-400" />
                    My Plans
                  </Link>
                </nav>
              </SheetContent>
            </Sheet>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-stone-800 to-stone-900 text-xs font-bold text-white">
              R
            </div>
          </div>
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-gradient-to-br from-stone-200 to-stone-300 text-[9px] font-bold text-stone-600">
              {initials}
            </AvatarFallback>
          </Avatar>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto max-w-4xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
