import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Search,
  RefreshCw,
  MoreHorizontal,
  ExternalLink,
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
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { formatCompact, formatNumber, formatRelative } from "@/lib/mock-data";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

type SnapshotItem = {
  id: number;
  followers_count: number;
  posts_count: number;
  comments_count: number;
  visible_views_count: number;
  scraped_at: string;
  source: string;
  raw_payload: unknown;
};

type ProfileItem = {
  id: number;
  member_id: number;
  member_name: string;
  username: string;
  profile_url: string | null;
  profile_name: string | null;
  is_public: boolean;
  is_active: boolean;
  current_followers_count: number;
  current_posts_count: number;
  current_comments_count: number;
  current_visible_views_count: number;
  last_scraped_at: string | null;
  snapshots: SnapshotItem[];
};

type MemberOption = {
  id: number;
  name: string;
};

type ProfilesPageData = {
  summary: {
    totalProfiles: number;
    totalFollowers: number;
    totalPosts: number;
    totalComments: number;
    totalViews: number;
  };
  members: MemberOption[];
  profiles: ProfileItem[];
};

export const Route = createFileRoute("/_authenticated/profiles")({
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
  loader: async (): Promise<ProfilesPageData> => {
    const token = getToken();

    const response = await fetch(`${API_BASE_URL}/profiles`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to load profiles");
    }

    return response.json();
  },
  component: ProfilesPage,
});

function ProfilesPage() {
  const router = useRouter();
  const data = Route.useLoaderData();

  const isMountedRef = useRef(false);

  const [q, setQ] = useState("");
  const [memberFilter, setMemberFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [publicFilter, setPublicFilter] = useState<string>("all");
  const [selected, setSelected] = useState<ProfileItem | null>(null);
  const [addProfileOpen, setAddProfileOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { summary, members, profiles } = data;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const filtered = useMemo(() => {
    return profiles.filter((p) => {
      if (memberFilter !== "all" && String(p.member_id) !== memberFilter) return false;
      if (activeFilter === "active" && !p.is_active) return false;
      if (activeFilter === "inactive" && p.is_active) return false;
      if (publicFilter === "public" && !p.is_public) return false;
      if (publicFilter === "private" && p.is_public) return false;

      const query = q.trim().toLowerCase();
      if (query) {
        const haystack = [p.username, p.profile_name || "", p.member_name || ""]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [profiles, q, memberFilter, activeFilter, publicFilter]);

  return (
    <AppShell
      title="Profiles"
      subtitle="Public Instagram accounts tracked by username."
      actions={
        <Button size="sm" className="gap-1.5" onClick={() => setAddProfileOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Add profile
        </Button>
      }
    >
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Total profiles"
          value={summary.totalProfiles}
          icon={<UserCircle2 className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Total followers"
          value={summary.totalFollowers}
          icon={<Users className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Total posts"
          value={summary.totalPosts}
          icon={<AtSign className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Total comments"
          value={summary.totalComments}
          icon={<MessageSquare className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Total views"
          value={summary.totalViews}
          icon={<Eye className="h-3.5 w-3.5" />}
        />
      </div>

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
              <SelectItem key={m.id} value={String(m.id)}>
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
            {filtered.map((p) => (
              <tr
                key={p.id}
                className="cursor-pointer transition-colors hover:bg-accent/40"
                onClick={() => setSelected(p)}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">@{p.username}</div>
                  <div className="text-[11px] text-muted-foreground">{p.profile_name}</div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{p.member_name}</td>
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
                  <RowMenu
                    profile={p}
                    onChanged={async () => {
                      await router.invalidate();
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No profiles match these filters.
          </div>
        )}
      </div>

      <div className="grid gap-2 md:hidden">
        {filtered.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelected(p)}
            className="rounded-xl border border-border bg-card p-4 text-left"
            type="button"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-foreground">@{p.username}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {p.member_name} · {p.profile_name}
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
        ))}
      </div>

      <AddProfileSheet
        open={addProfileOpen}
        members={members}
        submitting={submitting}
        onOpenChange={setAddProfileOpen}
        onSubmit={async (values, form) => {
          const token = getToken();

          try {
            setSubmitting(true);

            const response = await fetch(`${API_BASE_URL}/profiles`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(values),
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => null);
              toast.error(errorData?.message || "Failed to add profile");
              return;
            }

            toast.success("Profile added");

            if (isMountedRef.current) {
              form.reset();
              setAddProfileOpen(false);
            }

            await router.invalidate();
          } catch {
            toast.error("Something went wrong");
          } finally {
            if (isMountedRef.current) {
              setSubmitting(false);
            }
          }
        }}
      />

      <ProfileDrawer profile={selected} onClose={() => setSelected(null)} />
    </AppShell>
  );
}

function AddProfileSheet({
  open,
  members,
  submitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  members: MemberOption[];
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    values: {
      member_id: number;
      username: string;
      profile_name: string | null;
      profile_url: string | null;
    },
    form: HTMLFormElement,
  ) => Promise<void>;
}) {
  const defaultMemberId = members[0]?.id ? String(members[0].id) : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="text-left">
          <SheetTitle>Add profile</SheetTitle>
          <SheetDescription>Add a public Instagram username under a member.</SheetDescription>
        </SheetHeader>

        <form
          className="mt-6 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();

            const form = e.currentTarget;
            const formData = new FormData(form);

            const memberId = Number(formData.get("member_id"));
            const username = String(formData.get("username") || "")
              .trim()
              .toLowerCase()
              .replace(/^@+/, "");
            const profileName = String(formData.get("profile_name") || "").trim();
            const profileUrl = String(formData.get("profile_url") || "").trim();

            if (!memberId) {
              toast.error("Please select a member");
              return;
            }

            if (!username) {
              toast.error("Username is required");
              return;
            }

            await onSubmit(
              {
                member_id: memberId,
                username,
                profile_name: profileName || null,
                profile_url: profileUrl || null,
              },
              form,
            );
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="member_id" className="text-xs">
              Member
            </Label>
            <select
              id="member_id"
              name="member_id"
              defaultValue={defaultMemberId}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background"
              required
            >
              {members.length === 0 ? (
                <option value="">No members available</option>
              ) : (
                members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="username" className="text-xs">
              Username
            </Label>
            <Input
              id="username"
              name="username"
              placeholder="e.g. sara.stylehub"
              autoComplete="off"
              required
            />
            <p className="text-[11px] text-muted-foreground">
              Public accounts only. Enter the username without spaces.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile_name" className="text-xs">
              Profile name <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="profile_name"
              name="profile_name"
              placeholder="e.g. Sara Style Hub"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile_url" className="text-xs">
              Profile URL <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="profile_url"
              name="profile_url"
              placeholder="https://instagram.com/sara.stylehub"
              autoComplete="off"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || members.length === 0}>
              {submitting ? "Creating..." : "Create profile"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function StatusBadges({ p }: { p: Pick<ProfileItem, "is_active" | "is_public"> }) {
  return (
    <div className="flex flex-wrap gap-1">
      <Badge
        variant="outline"
        className={`border-border text-[10px] ${p.is_active ? "text-primary" : "text-muted-foreground"}`}
      >
        {p.is_active ? "Active" : "Inactive"}
      </Badge>
      <Badge variant="outline" className="border-border text-[10px] text-muted-foreground">
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

async function pollRefreshStatus(
  profileId: number,
  jobId: string,
  onChanged: () => Promise<void>,
  attempt = 0,
) {
  const token = getToken();
  const maxAttempts = 60; // ~5 min at 5s intervals
  const intervalMs = 5000;

  if (attempt >= maxAttempts) {
    toast.error("Refresh is taking longer than expected — check back later");
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/profiles/${profileId}/refresh-status/${jobId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!response.ok) {
      toast.error("Could not check refresh status");
      return;
    }

    const data = await response.json();

    if (data.status === "completed") {
      toast.success("Profile stats refreshed");
      await onChanged();
      return;
    }

    if (data.status === "failed") {
      toast.error(data.failedReason || "Refresh failed");
      return;
    }

    setTimeout(() => pollRefreshStatus(profileId, jobId, onChanged, attempt + 1), intervalMs);
  } catch (error) {
    console.error("Poll refresh status failed:", error);
    setTimeout(() => pollRefreshStatus(profileId, jobId, onChanged, attempt + 1), intervalMs);
  }
}

function RowMenu({ profile, onChanged }: { profile: ProfileItem; onChanged: () => Promise<void> }) {
  const handleRefresh = async () => {
    const token = getToken();

    try {
      const response = await fetch(`${API_BASE_URL}/profiles/${profile.id}/refresh`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        toast.error(data?.message || "Failed to start refresh");
        return;
      }

      if (data?.alreadyRunning) {
        toast.info("Already working on this profile");
        pollRefreshStatus(profile.id, data.jobId, onChanged);
        return;
      }

      toast.info("Refresh started");
      pollRefreshStatus(profile.id, data.jobId, onChanged);
    } catch (error) {
      console.error("Refresh request failed:", error);
      toast.error("Could not reach the server");
    }
  };

  const handleDeactivate = async () => {
    const token = getToken();

    const response = await fetch(`${API_BASE_URL}/profiles/${profile.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        is_active: false,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      toast.error(errorData?.message || "Failed to update profile");
      return;
    }

    toast.success("Profile updated");
    await onChanged();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" type="button">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>View details</DropdownMenuItem>
        <DropdownMenuItem onClick={handleRefresh}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh stats
        </DropdownMenuItem>
        <DropdownMenuItem>Edit</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleDeactivate}
          className="text-destructive focus:text-destructive"
        >
          Deactivate
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProfileDrawer({ profile, onClose }: { profile: ProfileItem | null; onClose: () => void }) {
  if (!profile) return null;

  const history = profile.snapshots.slice(0, 6);

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
                {profile.profile_name} · {profile.member_name}
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
            {profile.profile_url ? (
              <a
                href={profile.profile_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Open profile <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
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
