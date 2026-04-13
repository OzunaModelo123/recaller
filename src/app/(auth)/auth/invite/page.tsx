import { Suspense } from "react";
import { InviteFinishClient } from "./invite-finish-client";

export default function AuthInvitePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground">Finishing your invite…</p>
        }
      >
        <InviteFinishClient />
      </Suspense>
    </div>
  );
}
