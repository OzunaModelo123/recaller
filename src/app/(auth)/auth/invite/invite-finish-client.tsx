"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { employeeInviteNeedsPassword } from "@/lib/auth/employee-invite-state";
import { sanitizeInternalNext } from "@/lib/auth/safe-next";
import { completeAuthProvisioningAction } from "./actions";

/**
 * Finishes Supabase magic-link / invite flows (hash or ?code=), persists cookies,
 * then hard-navigates so the next document request includes auth cookies (avoids
 * client router races that left people on /login).
 */
export function InviteFinishClient() {
  const searchParams = useSearchParams();
  const nextRaw = searchParams.get("next");
  const codeFromQuery = searchParams.get("code");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const next = sanitizeInternalNext(nextRaw, "/employee/setup-password");
    let cancelled = false;

    (async () => {
      const supabase = createClient();

      const hash = window.location.hash?.startsWith("#")
        ? window.location.hash.slice(1)
        : "";
      const hsp = new URLSearchParams(hash);
      const accessToken = hsp.get("access_token");
      const refreshToken = hsp.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (cancelled) return;
        if (error) {
          setErr(error.message);
          return;
        }
        const q = window.location.search;
        window.history.replaceState({}, "", q ? `/auth/invite${q}` : "/auth/invite");
      } else if (codeFromQuery) {
        const { error } = await supabase.auth.exchangeCodeForSession(codeFromQuery);
        if (cancelled) return;
        if (error) {
          setErr(error.message);
          return;
        }
        const qs = new URLSearchParams(window.location.search);
        qs.delete("code");
        const rest = qs.toString();
        window.history.replaceState(
          {},
          "",
          rest ? `/auth/invite?${rest}` : "/auth/invite",
        );
      } else {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;
        if (!session?.user) {
          window.location.assign(`/login?next=${encodeURIComponent(next)}`);
          return;
        }
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;

      if (!user) {
        window.location.assign(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      await new Promise((r) => setTimeout(r, 120));
      if (cancelled) return;

      const provisioned = await completeAuthProvisioningAction();
      if (cancelled) return;
      if (!provisioned.ok) {
        setErr(provisioned.error);
        return;
      }

      if (employeeInviteNeedsPassword(user)) {
        window.location.assign("/employee/setup-password");
        return;
      }

      if (next.startsWith("/dashboard") || next.startsWith("/employee")) {
        window.location.assign(next);
        return;
      }

      window.location.assign("/post-login");
    })();

    return () => {
      cancelled = true;
    };
  }, [nextRaw, codeFromQuery]);

  if (err) {
    return (
      <div className="mx-auto max-w-sm p-8 text-center text-sm">
        <p className="text-destructive">{err}</p>
        <a href="/login" className="mt-3 inline-block underline">
          Sign in
        </a>
      </div>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">Finishing your invite…</p>
  );
}
