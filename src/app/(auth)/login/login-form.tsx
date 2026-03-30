"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setupError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push("/post-login");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Welcome back
        </h1>
        <p className="text-sm text-stone-500">
          Sign in to your Recaller account to continue.
        </p>
      </div>

      <form className="space-y-5" onSubmit={onSubmit}>
        {setupError ? (
          <div className="rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-800">
            <p>Account setup did not finish: {setupError}</p>
            <a
              href="/auth/signout"
              className="mt-1.5 inline-block text-xs font-medium underline underline-offset-2"
            >
              Clear session &amp; try again
            </a>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="email" className="text-xs font-medium text-stone-600">
            Email address
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 rounded-xl border-stone-200 bg-white px-4 transition-all focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-xs font-medium text-stone-600">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 rounded-xl border-stone-200 bg-white px-4 transition-all focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
            required
          />
        </div>

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <Button
          className="h-11 w-full rounded-xl bg-stone-900 text-sm font-medium transition-all hover:bg-stone-800"
          disabled={loading}
          type="submit"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>

      <div className="space-y-3 border-t border-stone-100 pt-5">
        <p className="text-sm text-stone-500">
          <span className="font-medium text-stone-700">Employer?</span>{" "}
          <Link className="underline underline-offset-2 hover:text-stone-900" href="/signup">
            Create your organization
          </Link>
        </p>
        <p className="text-sm text-stone-500">
          <span className="font-medium text-stone-700">Employee?</span>{" "}
          Ask your admin for an invite — you&apos;ll finish setup from the email link.
        </p>
      </div>
    </div>
  );
}

export function LoginForm() {
  return (
    <Suspense
      fallback={
        <div className="space-y-8">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
              Welcome back
            </h1>
            <p className="text-sm text-stone-500">Loading...</p>
          </div>
        </div>
      }
    >
      <LoginFormInner />
    </Suspense>
  );
}
