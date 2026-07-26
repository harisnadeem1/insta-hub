import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { currentUser } from "@/lib/mock-data";

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
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <AppShell title="Settings" subtitle="Account, preferences, and scrape behavior.">
      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="User profile" description="Public account details used in InstaNest.">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              toast.success("Profile saved");
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs">
                Full name
              </Label>
              <Input id="name" defaultValue={currentUser.full_name} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">
                Email
              </Label>
              <Input id="email" type="email" defaultValue={currentUser.email} />
            </div>
            <Button type="submit" size="sm">
              Save changes
            </Button>
          </form>
        </Section>

        <Section title="Password" description="Change the password used to sign in.">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              toast.success("Password updated");
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="current" className="text-xs">
                Current password
              </Label>
              <Input id="current" type="password" placeholder="••••••••" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="next" className="text-xs">
                New password
              </Label>
              <Input id="next" type="password" placeholder="At least 8 characters" />
            </div>
            <Button type="submit" size="sm" variant="secondary">
              Update password
            </Button>
          </form>
        </Section>

        <Section title="Preferences" description="How InstaNest looks and behaves for you.">
          <div className="space-y-4">
            <Toggle
              label="Compact tables"
              hint="Denser rows on the profiles and snapshots pages."
              defaultChecked
            />
            <Toggle label="Weekly email digest" hint="Summary of stats every Monday." />
            <Toggle
              label="Highlight top movers"
              hint="Show trend badges on KPI cards."
              defaultChecked
            />
          </div>
        </Section>

        <Section
          title="Data refresh"
          description="How often tracked profiles are re-scraped."
          className="lg:col-span-2"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Refresh cadence</Label>
              <Input defaultValue="Every 6 hours" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Retention</Label>
              <Input defaultValue="Keep 180 days of snapshots" />
            </div>
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
            Scrape behavior only reads publicly available data. Private accounts are out of scope
            and never queried. Views are based on publicly visible post/reel counts where available.
          </p>
        </Section>

        <Section title="Danger zone" description="Irreversible account actions.">
          <Button variant="destructive" size="sm">
            Delete account
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

function Toggle({
  label,
  hint,
  defaultChecked,
}: {
  label: string;
  hint: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 bg-background/40 p-3">
      <div className="min-w-0">
        <div className="text-xs font-medium text-foreground">{label}</div>
        <div className="text-[11px] text-muted-foreground">{hint}</div>
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}
