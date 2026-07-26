import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isAuthenticated, setAuth } from "@/lib/auth-storage";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: () => {
    if (isAuthenticated()) {
      throw redirect({ to: "/" });
    }
  },
  component: AuthPage,
});

type AuthMode = "login" | "signup";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
  });

  const isSignup = mode === "signup";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.id]: e.target.value,
    }));
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError("");
    setSuccessMessage("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const endpoint = isSignup ? "/auth/signup" : "/auth/login";

      const payload = isSignup
        ? {
            full_name: formData.full_name,
            email: formData.email,
            password: formData.password,
          }
        : {
            email: formData.email,
            password: formData.password,
          };

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Authentication failed");
      }

      setAuth(data.token, data.user);

      setSuccessMessage(isSignup ? "Account created successfully." : "Signed in successfully.");

      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 bg-background lg:grid-cols-2">
      <div className="flex items-center justify-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          <Logo className="mb-10" />

          <div className="mb-6 flex rounded-lg border border-border bg-muted/30 p-1">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={`flex-1 rounded-md px-3 py-2 text-sm transition ${
                mode === "login"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className={`flex-1 rounded-md px-3 py-2 text-sm transition ${
                mode === "signup"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Create account
            </button>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {isSignup ? "Create your account" : "Sign in"}
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            {isSignup
              ? "Create an InstaNest account to manage members and track public Instagram stats."
              : "Track public Instagram stats by member and profile."}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {isSignup ? (
              <div className="space-y-1.5">
                <Label htmlFor="full_name" className="text-xs">
                  Full name
                </Label>
                <Input
                  id="full_name"
                  type="text"
                  required={isSignup}
                  placeholder="Haris Nadeem"
                  value={formData.full_name}
                  onChange={handleChange}
                  className="h-10"
                />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="you@company.com"
                value={formData.email}
                onChange={handleChange}
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs">
                  Password
                </Label>
                {!isSignup ? (
                  <button
                    type="button"
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Forgot?
                  </button>
                ) : null}
              </div>

              <Input
                id="password"
                type="password"
                required
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                className="h-10"
              />
            </div>

            {error ? <p className="text-sm text-red-500">{error}</p> : null}
            {successMessage ? <p className="text-sm text-green-500">{successMessage}</p> : null}

            <Button type="submit" className="h-10 w-full" disabled={loading}>
              {loading
                ? isSignup
                  ? "Creating account..."
                  : "Signing in..."
                : isSignup
                  ? "Create account"
                  : "Sign in"}
            </Button>

            <div className="text-center text-xs text-muted-foreground">
              {isSignup ? "Already have an account? " : "New here? "}
              <button
                type="button"
                onClick={() => switchMode(isSignup ? "login" : "signup")}
                className="text-primary hover:underline"
              >
                {isSignup ? "Sign in" : "Create an account"}
              </button>
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
                <div className="mt-1 tabular-nums text-lg font-semibold text-foreground">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
