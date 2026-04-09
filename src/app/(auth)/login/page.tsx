import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-sidebar lg:block">
        <div className="grain absolute inset-0" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(232,115,74,0.12),transparent_50%)]" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-sidebar-primary/8 blur-3xl" />

        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-accent text-sm font-bold text-sidebar-foreground shadow-sm">
              R
            </div>
            <span className="text-lg font-semibold tracking-tight text-sidebar-foreground">
              Recaller
            </span>
          </Link>

          <div className="max-w-md space-y-6">
            <h1 className="text-4xl font-semibold leading-tight tracking-tight text-sidebar-foreground text-balance">
              Training that sticks, powered by AI.
            </h1>
            <p className="text-base leading-relaxed text-sidebar-foreground/70">
              Transform any content into actionable learning plans your team
              actually completes. From YouTube videos to PDFs — AI does the
              heavy lifting.
            </p>
            <div className="flex gap-6 pt-2">
              <div>
                <p className="text-2xl font-semibold text-sidebar-primary">2-10</p>
                <p className="mt-0.5 text-xs text-sidebar-foreground/60">
                  Steps per plan
                </p>
              </div>
              <div className="w-px bg-sidebar-border" />
              <div>
                <p className="text-2xl font-semibold text-sidebar-primary">5 sec</p>
                <p className="mt-0.5 text-xs text-sidebar-foreground/60">
                  YouTube to plan
                </p>
              </div>
              <div className="w-px bg-sidebar-border" />
              <div>
                <p className="text-2xl font-semibold text-sidebar-primary">3x</p>
                <p className="mt-0.5 text-xs text-sidebar-foreground/60">
                  Better retention
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-sidebar-foreground/50">
            &copy; {new Date().getFullYear()} Recaller. Built for teams that
            value real learning.
          </p>
        </div>
      </div>

      <div className="flex flex-col bg-background">
        <div className="flex items-center justify-between p-6 lg:justify-end">
          <Link
            href="/"
            className="flex items-center gap-2.5 lg:hidden"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary shadow-sm">
              R
            </div>
            <span className="text-base font-semibold tracking-tight text-foreground">
              Recaller
            </span>
          </Link>
          <Link
            href="/signup"
            className="text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-primary"
          >
            Create organization &rarr;
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 pb-12">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card/90 p-6 shadow-[var(--shadow-card)] backdrop-blur-sm sm:p-8">
            <LoginForm />
          </div>
        </div>
      </div>
    </main>
  );
}
