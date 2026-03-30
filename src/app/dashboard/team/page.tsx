import { redirect } from "next/navigation";
import { Users, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TeamInviteForm } from "./team-invite-form";

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: me, error: meErr } = await supabase
    .from("users")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (meErr || !me?.org_id) {
    redirect("/dashboard");
  }

  if (me.role !== "admin" && me.role !== "super_admin") {
    redirect("/employee/my-plans");
  }

  const [{ data: members }, { data: pendingInvites }] = await Promise.all([
    supabase
      .from("users")
      .select("id, email, full_name, role, created_at")
      .eq("org_id", me.org_id)
      .order("created_at", { ascending: true }),
    supabase
      .from("invitations")
      .select("email, status, created_at")
      .eq("org_id", me.org_id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  const memberEmails = new Set(
    (members ?? []).map((m) => m.email.toLowerCase()),
  );

  const pendingRows = (pendingInvites ?? []).filter(
    (p) => !memberEmails.has(p.email.toLowerCase()),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-stone-900">Team</h1>
        <p className="mt-1 text-sm text-stone-400">
          Invite employees by email. They join through your invitation only.
        </p>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-stone-100 px-6 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50">
            <UserPlus className="h-[18px] w-[18px] text-violet-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-stone-800">
              Invite an employee
            </h2>
            <p className="text-xs text-stone-400">
              Employees get access to training plans. They cannot create an org or upload content.
            </p>
          </div>
        </div>
        <div className="px-6 py-5">
          <TeamInviteForm />
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-stone-100 px-6 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-50">
            <Users className="h-[18px] w-[18px] text-stone-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-stone-800">Team members</h2>
            <p className="text-xs text-stone-400">
              People in your workspace and invitations still pending.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto px-6 py-4">
          {(members ?? []).length === 0 && pendingRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-stone-500">
              No team members yet. Send an invite above.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-xs font-medium uppercase tracking-wide text-stone-400">
                  <th className="pb-3 pr-4 font-medium">Name</th>
                  <th className="pb-3 pr-4 font-medium">Email</th>
                  <th className="pb-3 pr-4 font-medium">Role</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="text-stone-700">
                {(members ?? []).map((m) => (
                  <tr key={m.id} className="border-b border-stone-50 last:border-0">
                    <td className="py-3 pr-4">
                      {m.full_name?.trim() || "—"}
                    </td>
                    <td className="py-3 pr-4">{m.email}</td>
                    <td className="py-3 pr-4 capitalize">{m.role.replace("_", " ")}</td>
                    <td className="py-3">
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
                {pendingRows.map((p) => (
                  <tr key={`inv-${p.email}`} className="border-b border-stone-50 last:border-0">
                    <td className="py-3 pr-4 text-stone-400">—</td>
                    <td className="py-3 pr-4">{p.email}</td>
                    <td className="py-3 pr-4">Employee</td>
                    <td className="py-3">
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
                        Invite pending
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
