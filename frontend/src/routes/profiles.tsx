import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Plus,
  Search,
  RefreshCw,
  MoreHorizontal,
  ExternalLink,
  ArrowRight,
  Users,
  AtSign,
  MessageSquare,
  Eye,
  UserCircle2,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { KpiCard } from "@/components/kpi-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  profiles,
  members,
  snapshots,
  getMemberById,
  getMemberTotals,
  getOverallTotals,
  formatCompact,
  formatNumber,
  formatRelative,
  type InstagramProfile,
} from "@/lib/mock-data";

export const Route = createFileRoute("/profiles")({
  head: () => ({
    meta: [
      { title: "Profiles — InstaNest" },
      {
        name: "description",
        content: "All tracked public Instagram profiles with current followers, posts, and views.",
      },
      { property: "og:title", content: "Profiles — InstaNest" },
      {
        property: "og:description",
        content: "All tracked public Instagram profiles with live public metrics.",
      },
    ],
  }),
  component: ProfilesPage,
});

function ProfilesPage() {
  const [q, setQ] = useState("");
  const [memberFilter, setMemberFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [publicFilter, setPublicFilter] = useState<string>("all");
  const [selected, setSelected] = useState<InstagramProfile | null>(null);

  const totals = getOverallTotals();
  const membersPreview = members.slice(0, 6).map((m) => ({ m, t: getMemberTotals(m.id) }));

  const filtered = useMemo(() => {
    return profiles.filter((p) => {
      if (memberFilter !== "all" && p.member_id !== memberFilter) return false;
      if (activeFilter === "active" && !p.is_active) return false;
      if (activeFilter === "inactive" && p.is_active) return false;
      if (publicFilter === "public" && !p.is_public) return false;
      if (publicFilter === "private" && p.is_public) return false;
      if (q && !p.username.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [q, memberFilter, activeFilter, publicFilter]);

  return (
    <AppShell
      title="Profiles"
      subtitle="Public Instagram accounts tracked by username."
      actions={
        <Button size="sm" className="gap-1.5" onClick={() => toast("Coming soon")}>
          <Plus className="h-3.5 w-3.5" /> Add profile
        </Button>
      }
    >
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Total profiles"
          value={profiles.length}
          icon={<UserCircle2 className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Total followers"
          value={totals.followers}
          icon={<Users className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Total posts"
          value={totals.posts}
          icon={<AtSign className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Total comments"
          value={totals.comments}
          icon={<MessageSquare className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Total views"
          value={totals.views}
          icon={<Eye className="h-3.5 w-3.5" />}
        />
      </div>

      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Members</h3>
            <p className="text-[11px] text-muted-foreground">
              Aggregated stats grouped by member.
            </p>
          </div>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link to="/members">
              View all members <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-background/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Member</th>
                <th className="px-4 py-2.5 text-right font-medium">Total accounts</th>
                <th className="px-4 py-2.5 text-right font-medium">Followers</th>
                <th className="px-4 py-2.5 text-right font-medium">Posts</th>
                <th className="px-4 py-2.5 text-right font-medium">Comments</th>
                <th className="px-4 py-2.5 text-right font-medium">Views</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {membersPreview.map(({ m, t }) => (
                <tr key={m.id} className="transition-colors hover:bg-accent/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                        {m.name[0]}
                      </div>
                      <div className="font-medium text-foreground">{m.name}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{t.count}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatNumber(t.followers)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatNumber(t.posts)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {formatNumber(t.comments)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {formatCompact(t.views)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-2 md:hidden">
          {membersPreview.map(({ m, t }) => (
            <div key={m.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  {m.name[0]}
                </div>
                <div className="text-sm font-semibold text-foreground">{m.name}</div>
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {t.count} accounts
                </span>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 border-t border-border pt-3">
                <MiniStat label="Followers" value={t.followers} />
                <MiniStat label="Posts" value={t.posts} />
                <MiniStat label="Comments" value={t.comments} />
                <MiniStat label="Views" value={t.views} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2.5">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by username"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Select value={memberFilter} onValueChange={setMemberFilter}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All members</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={activeFilter} onValueChange={setActiveFilter}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={publicFilter} onValueChange={setPublicFilter}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any visibility</SelectItem>
            <SelectItem value="public">Public</SelectItem>
            <SelectItem value="private">Private</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-background/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Username</th>
              <th className="px-4 py-2.5 text-left font-medium">Member</th>
              <th className="px-4 py-2.5 text-right font-medium">Followers</th>
              <th className="px-4 py-2.5 text-right font-medium">Posts</th>
              <th className="px-4 py-2.5 text-right font-medium">Comments</th>
              <th className="px-4 py-2.5 text-right font-medium">Views</th>
              <th className="px-4 py-2.5 text-left font-medium">Status</th>
              <th className="px-4 py-2.5 text-left font-medium">Last sync</th>
              <th className="px-2 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((p) => {
              const m = getMemberById(p.member_id);
              return (
                <tr
                  key={p.id}
                  className="cursor-pointer transition-colors hover:bg-accent/40"
                  onClick={() => setSelected(p)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">@{p.username}</div>
                    <div className="text-[11px] text-muted-foreground">{p.profile_name}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{m?.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatNumber(p.current_followers_count)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatNumber(p.current_posts_count)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {formatNumber(p.current_comments_count)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {formatCompact(p.current_visible_views_count)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadges p={p} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatRelative(p.last_scraped_at)}
                  </td>
                  <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                    <RowMenu />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No profiles match these filters.
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="grid gap-2 md:hidden">
        {filtered.map((p) => {
          const m = getMemberById(p.member_id);
          return (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className="rounded-xl border border-border bg-card p-4 text-left"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">
                    @{p.username}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {m?.name} · {p.profile_name}
                  </div>
                </div>
                <StatusBadges p={p} />
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 border-t border-border pt-3">
                <MiniStat label="Followers" value={p.current_followers_count} />
                <MiniStat label="Posts" value={p.current_posts_count} />
                <MiniStat label="Comments" value={p.current_comments_count} />
                <MiniStat label="Views" value={p.current_visible_views_count} />
              </div>
            </button>
          );
        })}
      </div>

      <ProfileDrawer profile={selected} onClose={() => setSelected(null)} />
    </AppShell>
  );
}

function StatusBadges({ p }: { p: InstagramProfile }) {
  return (
    <div className="flex flex-wrap gap-1">
      <Badge
        variant="outline"
        className={`border-border text-[10px] ${p.is_active ? "text-primary" : "text-muted-foreground"}`}
      >
        {p.is_active ? "Active" : "Inactive"}
      </Badge>
      <Badge
        variant="outline"
        className="border-border text-[10px] text-muted-foreground"
      >
        {p.is_public ? "Public" : "Private"}
      </Badge>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="tabular-nums text-sm font-semibold text-foreground">
        {formatCompact(value)}
      </div>
    </div>
  );
}

function RowMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>View details</DropdownMenuItem>
        <DropdownMenuItem>
          <RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh stats
        </DropdownMenuItem>
        <DropdownMenuItem>Edit</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive">
          Deactivate
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProfileDrawer({
  profile,
  onClose,
}: {
  profile: InstagramProfile | null;
  onClose: () => void;
}) {
  if (!profile) return null;
  const member = getMemberById(profile.member_id);
  const history = snapshots
    .filter((s) => s.instagram_profile_id === profile.id)
    .slice(0, 6);

  return (
    <Sheet open={!!profile} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="text-left">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
              {profile.username[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <SheetTitle className="truncate text-base">@{profile.username}</SheetTitle>
              <SheetDescription className="truncate text-xs">
                {profile.profile_name} · {member?.name}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <QuickStat label="Followers" value={formatNumber(profile.current_followers_count)} />
          <QuickStat label="Posts" value={formatNumber(profile.current_posts_count)} />
          <QuickStat label="Comments" value={formatNumber(profile.current_comments_count)} />
          <QuickStat
            label="Visible views"
            value={formatNumber(profile.current_visible_views_count)}
          />
        </div>

        <div className="mt-6 rounded-lg border border-border bg-card p-3 text-xs">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium text-foreground">Source</span>
            <a
              href={profile.profile_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Open profile <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <dl className="grid grid-cols-2 gap-y-1 text-muted-foreground">
            <dt>Public</dt>
            <dd className="text-foreground">{profile.is_public ? "Yes" : "No"}</dd>
            <dt>Active</dt>
            <dd className="text-foreground">{profile.is_active ? "Yes" : "No"}</dd>
            <dt>Last scraped</dt>
            <dd className="text-foreground">{formatRelative(profile.last_scraped_at)}</dd>
          </dl>
        </div>

        <div className="mt-6">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent snapshots
          </h4>
          <ol className="relative space-y-3 border-l border-border pl-4">
            {history.map((s) => (
              <li key={s.id} className="relative">
                <span className="absolute -left-[21px] top-1 grid h-3 w-3 place-items-center rounded-full border border-border bg-background">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{formatRelative(s.scraped_at)}</span>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    {s.source}
                  </Badge>
                </div>
                <div className="mt-0.5 tabular-nums text-sm text-foreground">
                  {formatNumber(s.followers_count)} followers
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-6">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Raw payload
          </h4>
          <pre className="max-h-56 overflow-auto rounded-lg border border-border bg-background/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
{JSON.stringify(history[0]?.raw_payload ?? {}, null, 2)}
          </pre>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 tabular-nums text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}