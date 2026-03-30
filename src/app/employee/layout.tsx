import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-4 py-6 md:grid-cols-[200px_1fr]">
        <aside className="rounded-lg border bg-white p-3">
          <nav className="flex flex-col gap-1">
            <Link className="rounded-md px-3 py-2 text-sm hover:bg-zinc-100" href="/my-plans">
              My Plans
            </Link>
            <Link className="rounded-md px-3 py-2 text-sm hover:bg-zinc-100" href="/profile">
              Profile
            </Link>
          </nav>
        </aside>
        <main>{children}</main>
      </div>
    </div>
  );
}
