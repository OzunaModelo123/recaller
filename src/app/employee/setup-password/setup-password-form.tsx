"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SetupPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: upErr } = await supabase.auth.updateUser({
      password,
      data: { password_set_at: new Date().toISOString() },
    });
    if (upErr) {
      setError(upErr.message);
      setLoading(false);
      return;
    }

    await supabase.auth.refreshSession();
    router.replace("/employee/my-plans");
    router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="new-password" className="text-xs font-medium text-stone-600">
          Create password
        </Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11 rounded-xl border-stone-200"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password" className="text-xs font-medium text-stone-600">
          Confirm password
        </Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="h-11 rounded-xl border-stone-200"
          required
        />
      </div>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      <Button
        type="submit"
        className="h-11 w-full rounded-xl bg-stone-900"
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : (
          "Continue to My Plans"
        )}
      </Button>
    </form>
  );
}
