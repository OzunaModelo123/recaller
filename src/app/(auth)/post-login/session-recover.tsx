"use client";

import { useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Server never sees `#access_token=…` on `/post-login`. Persist the session, then
 * hard-navigate to `/auth/invite` so routing matches the normal invite flow.
 */
export function PostLoginSessionRecover() {
  const router = useRouter();
  const [failed, setFailed] = useState<string | null>(null);

  useLayoutEffect(() => {
    const hash = window.location.hash?.startsWith("#")
      ? window.location.hash.slice(1)
      : "";
    const sp = new URLSearchParams(hash);
    const accessToken = sp.get("access_token");
    const refreshToken = sp.get("refresh_token");

    if (!accessToken || !refreshToken) {
      router.replace("/login");
      return;
    }

    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (cancelled) return;
      if (error) {
        setFailed(error.message);
        return;
      }
      window.location.assign("/auth/invite");
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (failed) {
    return (
      <div className="mx-auto max-w-sm p-8 text-center text-sm text-muted-foreground">
        <p className="text-destructive">{failed}</p>
        <a href="/login" className="mt-3 inline-block underline">
          Back to login
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm p-8 text-center text-sm text-muted-foreground">
      Finishing sign-in…
    </div>
  );
}
