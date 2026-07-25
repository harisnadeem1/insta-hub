import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — InstaNest" },
      {
        name: "description",
        content: "Sign in to InstaNest to track public Instagram stats by member and profile.",
      },
      { property: "og:title", content: "Sign in — InstaNest" },
      {
        property: "og:description",
        content: "Sign in to track public Instagram stats by member and profile.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => navigate({ to: "/" }), 400);
  };

  return (
    <div className="grid min-h-screen grid-cols-1 bg-background lg:grid-cols-2">
      <div className="flex items-center justify-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          <Logo className="mb-10" />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track public Instagram stats by member and profile.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="you@company.com"
                defaultValue="alex@instanest.app"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs">
                  Password
                </Label>
                <button
                  type="button"
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Forgot?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                required
                placeholder="••••••••"
                defaultValue="demo1234"
                className="h-10"
              />
            </div>

            <Button type="submit" className="h-10 w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>

            <div className="text-center text-xs text-muted-foreground">
              New here?{" "}
              <Link to="/auth" className="text-primary hover:underline">
                Create an account
              </Link>
            </div>
          </form>

          <p className="mt-10 text-[11px] text-muted-foreground">
            Public accounts only. InstaNest never signs in to Instagram on your behalf.
          </p>
        </div>
      </div>

      <div className="relative hidden overflow-hidden border-l border-border bg-sidebar lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,oklch(0.28_0.05_190/0.6),transparent_60%)]" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="max-w-md">
            <div className="text-xs font-medium uppercase tracking-widest text-primary">
              InstaNest
            </div>
            <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-foreground">
              Track public Instagram stats in one calm, focused dashboard.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Group profiles by member, watch totals evolve, and keep a clean snapshot history — all
              without ever asking a tracked account to log in.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { k: "Followers", v: "355.3K" },
              { k: "Posts", v: "2.33K" },
              { k: "Views", v: "5.45M" },
            ].map((s) => (
              <div
                key={s.k}
                className="rounded-lg border border-border bg-card/60 p-4 backdrop-blur"
              >
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {s.k}
                </div>
                <div className="mt-1 tabular-nums text-lg font-semibold text-foreground">
                  {s.v}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}