import { Users, UserPlus } from "lucide-react";
import { TeamInviteForm } from "./team-invite-form";

export default function TeamPage() {
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

      {/* Placeholder for team member list */}
      <div className="rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50/50 py-16 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
          <Users className="h-5 w-5 text-stone-300" />
        </div>
        <h3 className="mt-4 text-sm font-semibold text-stone-700">Team members</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-stone-400">
          A full team directory with roles, status, and activity will appear here
          in a future update.
        </p>
      </div>
    </div>
  );
}
