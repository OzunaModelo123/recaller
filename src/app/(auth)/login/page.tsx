import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
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
              Training that sticks, powered by AI.
            </h1>
            <p className="text-base leading-relaxed text-stone-300">
              Transform any content into actionable learning plans your team
              actually completes. From YouTube videos to PDFs — AI does the
              heavy lifting.
            </p>
            <div className="flex gap-6 pt-2">
              <div>
                <p className="text-2xl font-semibold text-white">2-10</p>
                <p className="mt-0.5 text-xs text-stone-400">
                  Steps per plan
                </p>
              </div>
              <div className="w-px bg-white/10" />
              <div>
                <p className="text-2xl font-semibold text-white">5 sec</p>
                <p className="mt-0.5 text-xs text-stone-400">
                  YouTube to plan
                </p>
              </div>
              <div className="w-px bg-white/10" />
              <div>
                <p className="text-2xl font-semibold text-white">3x</p>
                <p className="mt-0.5 text-xs text-stone-400">
                  Better retention
                </p>
              </div>
            </div>
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
            href="/signup"
            className="text-sm font-medium text-stone-500 transition-colors hover:text-stone-900"
          >
            Create organization &rarr;
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 pb-12">
          <div className="w-full max-w-sm">
            <LoginForm />
          </div>
        </div>
      </div>
    </main>
  );
}
