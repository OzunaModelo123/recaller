"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { formatAuthError } from "@/lib/auth/authErrors";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    const supabase = createClient();

    const callbackUrl = `${window.location.origin}/callback`;

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: callbackUrl,
        data: {
          full_name: fullName,
          org_name: orgName,
          signup_as: "employer",
        },
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(formatAuthError(signUpError));
      return;
    }

    if (signUpData.session) {
      router.push("/post-login");
      router.refresh();
      return;
    }

    setMessage("Check your email for a confirmation link.");
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-stone-900 via-stone-800 to-amber-900/80 lg:block">
        <div className="grain absolute inset-0" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(217,170,100,0.15),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(120,80,40,0.2),transparent_60%)]" />

        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-sm font-bold text-white backdrop-blur-sm">
              R
            </div>
            <span className="text-lg font-semibold tracking-tight text-white">
              Recaller
            </span>
          </Link>

          <div className="max-w-md space-y-6">
            <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white text-balance">
              Give your team training that actually works.
            </h1>
            <p className="text-base leading-relaxed text-stone-300">
              Set up your organization in under a minute. Upload content, let AI generate
              plans, and start tracking real learning outcomes.
            </p>
          </div>

          <p className="text-xs text-stone-500">
            &copy; {new Date().getFullYear()} Recaller. Built for teams that
            value real learning.
          </p>
        </div>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center justify-between p-6 lg:justify-end">
          <Link
            href="/"
            className="flex items-center gap-2.5 lg:hidden"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900 text-xs font-bold text-white">
              R
            </div>
            <span className="text-base font-semibold tracking-tight text-stone-900">
              Recaller
            </span>
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-stone-500 transition-colors hover:text-stone-900"
          >
            Already have an account? &rarr;
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 pb-12">
          <div className="w-full max-w-sm">
            <div className="space-y-8">
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
                  Create your organization
                </h1>
                <p className="text-sm text-stone-500">
                  For employers only. Employees join through invites sent from
                  Team settings.
                </p>
              </div>

              <form className="space-y-5" onSubmit={onSubmit}>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-xs font-medium text-stone-600">
                      Your full name
                    </Label>
                    <Input
                      id="fullName"
                      placeholder="Jane Smith"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="h-11 rounded-xl border-stone-200 bg-white px-4 transition-all focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="orgName" className="text-xs font-medium text-stone-600">
                      Organization
                    </Label>
                    <Input
                      id="orgName"
                      placeholder="Acme Inc."
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      className="h-11 rounded-xl border-stone-200 bg-white px-4 transition-all focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-medium text-stone-600">
                    Work email
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
                    autoComplete="new-password"
                    minLength={8}
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 rounded-xl border-stone-200 bg-white px-4 transition-all focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
                    required
                  />
                </div>

                {error ? (
                  <p className="whitespace-pre-line rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-800">
                    {error}
                  </p>
                ) : null}
                {message ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800">
                    {message}
                  </div>
                ) : null}

                <Button
                  className="h-11 w-full rounded-xl bg-stone-900 text-sm font-medium transition-all hover:bg-stone-800"
                  disabled={loading}
                  type="submit"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Create account"
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
