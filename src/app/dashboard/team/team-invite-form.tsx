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
        <Label htmlFor="invite-email">
          Employee email
        </Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="invite-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="colleague@company.com"
            required
            disabled={pending}
            className="h-11 rounded-xl pl-10"
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          They&apos;ll get an email link to accept the invite, then choose a password
          before accessing training.
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
        className="rounded-xl"
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
