import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { createClient } from "@/lib/supabase/server";

export default async function PlansListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: plans } = await supabase
    .from("plans")
    .select("id, title, target_role, created_at, complexity")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          Plans
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          AI-generated learning plans from your content library.
        </p>
      </div>

      {!plans?.length ? (
        <div className="rounded-2xl border border-dashed border-border bg-card py-16 text-center text-sm text-muted-foreground">
          No plans yet. Open a ready content item and choose{" "}
          <span className="font-medium text-muted-foreground">Generate plan</span>.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card shadow-none">
          {plans.map((p) => (
            <li key={p.id}>
              <Link
                href={`/dashboard/plans/${p.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-secondary/80"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{p.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {p.target_role ? `${p.target_role} · ` : ""}
                    {p.complexity ?? "—"} ·{" "}
                    {new Date(p.created_at).toLocaleDateString()}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
