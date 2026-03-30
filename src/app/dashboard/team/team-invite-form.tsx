"use client";

import { useActionState } from "react";
import { Check, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteTeamMember, type InviteResult } from "./actions";

export function TeamInviteForm() {
  const [state, formAction, pending] = useActionState(
    inviteTeamMember,
    null as InviteResult | null,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="invite-email" className="text-xs font-medium text-stone-500">
          Employee email
        </Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-300" />
          <Input
            id="invite-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="colleague@company.com"
            required
            disabled={pending}
            className="h-11 rounded-xl border-stone-200 bg-white pl-10 transition-all focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
          />
        </div>
        <p className="text-[11px] text-stone-400">
          They&apos;ll receive an email to set a password and join as an employee.
        </p>
      </div>

      {state?.ok === false ? (
        <p className="rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}
      {state?.ok === true ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-800">
          <Check className="h-4 w-4 text-emerald-600" />
          Invitation sent. They can use the link in their email.
        </div>
      ) : null}

      <Button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-stone-900 hover:bg-stone-800"
      >
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          "Send invitation"
        )}
      </Button>
    </form>
  );
}
