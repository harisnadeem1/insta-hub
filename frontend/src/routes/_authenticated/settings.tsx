import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getToken, clearAuth } from "@/lib/auth-storage";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

type SettingsPageData = {
  user: {
    id: number;
    full_name: string;
    email: string;
  };
};

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — InstaNest" },
      { name: "description", content: "Manage your account and scrape preferences in InstaNest." },
      { property: "og:title", content: "Settings — InstaNest" },
      {
        property: "og:description",
        content: "Manage your account and scrape preferences in InstaNest.",
      },
    ],
  }),
  loader: async (): Promise<SettingsPageData> => {
    const token = getToken();

    const response = await fetch(`${API_BASE_URL}/settings`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to load settings");
    }

    return response.json();
  },
  component: SettingsPage,
});

function SettingsPage() {
  const router = useRouter();
  const data = Route.useLoaderData();
  const isMountedRef = useRef(false);

  const [fullName, setFullName] = useState(data.user.full_name);
  const [email, setEmail] = useState(data.user.email);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

 

  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return (
    <AppShell title="Settings" subtitle="Account, preferences, and scrape behavior.">
      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="User profile" description="Public account details used in InstaNest.">
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const token = getToken();

              try {
                setProfileSaving(true);

                const response = await fetch(`${API_BASE_URL}/settings/profile`, {
                  method: "PATCH",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    full_name: fullName,
                    email,
                  }),
                });

                const result = await response.json().catch(() => null);

                if (!response.ok) {
                  toast.error(result?.message || "Failed to save profile");
                  return;
                }

                toast.success("Profile saved");
                await router.invalidate();
              } catch (error) {
                console.error("Save profile failed:", error);
                toast.error("Could not save profile");
              } finally {
                if (isMountedRef.current) {
                  setProfileSaving(false);
                }
              }
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs">
                Full name
              </Label>
              <Input
                id="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <Button type="submit" size="sm" disabled={profileSaving}>
              {profileSaving ? "Saving..." : "Save changes"}
            </Button>
          </form>
        </Section>

        <Section title="Password" description="Change the password used to sign in.">
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const token = getToken();

              try {
                setPasswordSaving(true);

                const response = await fetch(`${API_BASE_URL}/settings/password`, {
                  method: "PATCH",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword,
                  }),
                });

                const result = await response.json().catch(() => null);

                if (!response.ok) {
                  toast.error(result?.message || "Failed to update password");
                  return;
                }

                toast.success("Password updated");

                if (isMountedRef.current) {
                  setCurrentPassword("");
                  setNewPassword("");
                }
              } catch (error) {
                console.error("Password update failed:", error);
                toast.error("Could not update password");
              } finally {
                if (isMountedRef.current) {
                  setPasswordSaving(false);
                }
              }
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="current" className="text-xs">
                Current password
              </Label>
              <Input
                id="current"
                type="password"
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="next" className="text-xs">
                New password
              </Label>
              <Input
                id="next"
                type="password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <Button type="submit" size="sm" variant="secondary" disabled={passwordSaving}>
              {passwordSaving ? "Updating..." : "Update password"}
            </Button>
          </form>
        </Section>

     

        

        <Section title="Danger zone" description="Irreversible account actions.">
          <Button
            variant="destructive"
            size="sm"
            disabled={deletingAccount}
            onClick={async () => {
              const password = window.prompt("Enter your password to delete your account");
              if (!password) return;

              const token = getToken();

              try {
                setDeletingAccount(true);

                const response = await fetch(`${API_BASE_URL}/settings/account`, {
                  method: "DELETE",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ password }),
                });

                const result = await response.json().catch(() => null);

                if (!response.ok) {
                  toast.error(result?.message || "Failed to delete account");
                  return;
                }

                toast.success("Account deleted");
                clearAuth();
                await router.navigate({ to: "/auth" });
              } catch (error) {
                console.error("Delete account failed:", error);
                toast.error("Could not delete account");
              } finally {
                if (isMountedRef.current) {
                  setDeletingAccount(false);
                }
              }
            }}
          >
            {deletingAccount ? "Deleting..." : "Delete account"}
          </Button>
        </Section>
      </div>
    </AppShell>
  );
}

function Section({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-border bg-card p-5 ${className}`}>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

