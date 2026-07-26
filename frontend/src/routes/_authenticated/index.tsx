import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, AtSign, MessageSquare, Eye, Clock, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { KpiCard } from "@/components/kpi-card";
import { Button } from "@/components/ui/button";
import {
  profiles,
  members,
  getMemberById,
  getMemberTotals,
  getOverallTotals,
  formatCompact,
  formatNumber,
  formatRelative,
} from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Overview — InstaNest" },
      {
        name: "description",
        content: "Aggregated public Instagram stats across all your tracked members and profiles.",
      },
      { property: "og:title", content: "Overview — InstaNest" },
      {
        property: "og:description",
        content: "Aggregated public Instagram stats across all your tracked members and profiles.",
      },
    ],
  }),
  component: Overview,
});

function Overview() {
  const totals = getOverallTotals();
  const previewProfiles = [...profiles]
    .sort((a, b) => b.current_followers_count - a.current_followers_count)
    .slice(0, 6);
  const lastUpdated = [...profiles]
    .map((p) => p.last_scraped_at)
    .filter(Boolean)
    .sort()
    .reverse()[0];

  return (
    <AppShell
      title="Overview"
      subtitle="Aggregated public metrics across all members and profiles."
      actions={
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5 text-primary" />
          Updated {formatRelative(lastUpdated ?? null)}
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total followers"
          value={totals.followers}
          icon={<Users className="h-3.5 w-3.5" />}
          hint="Sum across all profiles"
          delta="2.4%"
        />
        <KpiCard
          label="Total posts"
          value={totals.posts}
          icon={<AtSign className="h-3.5 w-3.5" />}
          hint="Public posts visible"
        />
        <KpiCard
          label="Total comments"
          value={totals.comments}
          icon={<MessageSquare className="h-3.5 w-3.5" />}
          hint="Public post comments"
          delta="1.1%"
        />
        <KpiCard
          label="Visible views"
          value={totals.views}
          icon={<Eye className="h-3.5 w-3.5" />}
          hint="Post & reel views where available"
        />
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Profiles</h3>
            <p className="text-[11px] text-muted-foreground">
              Preview of tracked public Instagram profiles.
            </p>
          </div>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link to="/profiles">
              View all profiles <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {previewProfiles.map((p) => {
                const m = getMemberById(p.member_id);
                return (
                  <tr key={p.id} className="transition-colors hover:bg-accent/40">
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="grid gap-2 md:hidden">
          {previewProfiles.map((p) => {
            const m = getMemberById(p.member_id);
            return (
              <div key={p.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">
                      @{p.username}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">{m?.name}</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 border-t border-border pt-3">
                  <Stat label="Followers" value={p.current_followers_count} />
                  <Stat label="Posts" value={p.current_posts_count} />
                  <Stat label="Comments" value={p.current_comments_count} />
                  <Stat label="Views" value={p.current_visible_views_count} />
                </div>
              </div>
            );
          })}
        </div>

        {profiles.length === 0 && (
          <div className="mt-3 rounded-xl border border-dashed border-border bg-card/50 p-6 text-center">
            <div className="text-sm font-medium text-foreground">No profiles added yet</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Add your first member and link a public Instagram username to start tracking.
            </p>
            <div className="mt-3">
              <Button asChild size="sm">
                <Link to="/members">Add your first member</Link>
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Members</h3>
            <p className="text-[11px] text-muted-foreground">
              Aggregated totals from each member's linked profiles.
            </p>
          </div>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link to="/members">
              View all members <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {(() => {
          const memberRows = members
            .map((m) => ({ member: m, totals: getMemberTotals(m.id) }))
            .sort((a, b) => b.totals.followers - a.totals.followers)
            .slice(0, 8);
          return (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-background/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium">Member</th>
                      <th className="px-4 py-2.5 text-right font-medium">Accounts</th>
                      <th className="px-4 py-2.5 text-right font-medium">Followers</th>
                      <th className="px-4 py-2.5 text-right font-medium">Posts</th>
                      <th className="px-4 py-2.5 text-right font-medium">Comments</th>
                      <th className="px-4 py-2.5 text-right font-medium">Views</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {memberRows.map(({ member, totals }) => (
                      <tr key={member.id} className="transition-colors hover:bg-accent/40">
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{member.name}</div>
                          {member.notes && (
                            <div className="text-[11px] text-muted-foreground">{member.notes}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{totals.count}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatNumber(totals.followers)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatNumber(totals.posts)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {formatNumber(totals.comments)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {formatCompact(totals.views)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="grid gap-2 md:hidden">
                {memberRows.map(({ member, totals }) => (
                  <div key={member.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">
                          {member.name}
                        </div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {totals.count} {totals.count === 1 ? "account" : "accounts"}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2 border-t border-border pt-3">
                      <Stat label="Followers" value={totals.followers} />
                      <Stat label="Posts" value={totals.posts} />
                      <Stat label="Comments" value={totals.comments} />
                      <Stat label="Views" value={totals.views} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          );
        })()}
      </section>

      <p className="mt-8 text-[11px] text-muted-foreground">
        Views are based on publicly visible post/reel counts where available. Public accounts only.
      </p>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="tabular-nums text-sm font-medium text-foreground">{formatCompact(value)}</div>
    </div>
  );
}
