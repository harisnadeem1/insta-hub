import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
  Plus,
  MoreHorizontal,
  Users,
  Pencil,
  Trash2,
  AtSign,
  UserCircle2,
  MessageSquare,
  Eye,
  UsersRound,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { KpiCard } from "@/components/kpi-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { getToken } from "@/lib/auth-storage";
import { formatCompact, formatRelative } from "@/lib/mock-data";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

type MemberProfile = {
  id: number;
  username: string;
  current_followers_count: number;
};

type MemberItem = {
  id: number;
  name: string;
  notes: string | null;
  profile_count: number;
  followers: number;
  posts: number;
  comments: number;
  views: number;
  last_scraped_at: string | null;
  profiles: MemberProfile[];
};

type MembersPageData = {
  summary: {
    totalMembers: number;
    totalAccounts: number;
    totalFollowers: number;
    totalPosts: number;
    totalComments: number;
    totalViews: number;
  };
  members: MemberItem[];
};

export const Route = createFileRoute("/_authenticated/members")({
  head: () => ({
    meta: [
      { title: "Members — InstaNest" },
      {
        name: "description",
        content: "Group your tracked Instagram profiles by member and see aggregated public stats.",
      },
      { property: "og:title", content: "Members — InstaNest" },
      {
        property: "og:description",
        content: "Group public Instagram profiles by member with aggregated stats.",
      },
    ],
  }),
  loader: async (): Promise<MembersPageData> => {
    const token = getToken();

    const response = await fetch(`${API_BASE_URL}/members`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to load members");
    }

    return response.json();
  },
  component: MembersPage,
});

function MembersPage() {
  const [open, setOpen] = useState(false);
  const data = Route.useLoaderData();
  const router = useRouter();

  const { summary, members } = data;

  return (
    <AppShell
      title="Members"
      subtitle="Group profiles by member to compare aggregated public stats."
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add member</DialogTitle>
              <DialogDescription>
                A member is a group of Instagram profiles you want to track together.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={async (e) => {
                e.preventDefault();

                const form = new FormData(e.currentTarget);
                const token = getToken();

                const payload = {
                  name: String(form.get("name") || ""),
                  notes: String(form.get("notes") || ""),
                };

                const response = await fetch(`${API_BASE_URL}/members`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify(payload),
                });

                if (!response.ok) {
                  toast.error("Failed to add member");
                  return;
                }

                toast.success("Member added");
                setOpen(false);
                await router.invalidate();
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs">
                  Name
                </Label>
                <Input id="name" name="name" placeholder="e.g. Sara" required />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-xs">
                  Notes <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Textarea id="notes" name="notes" placeholder="Short description" rows={3} />
              </div>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create member</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard
          label="Total members"
          value={summary.totalMembers}
          icon={<UsersRound className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Total accounts"
          value={summary.totalAccounts}
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

      {members.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
          <Users className="mx-auto h-6 w-6 text-muted-foreground" />
          <div className="mt-3 text-sm font-medium">No members yet</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Add your first member to start grouping public Instagram profiles.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {members.map((m) => (
            <div
              key={m.id}
              className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                    {m.name[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">{m.name}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {m.notes ?? "No notes"}
                    </div>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <AtSign className="mr-2 h-3.5 w-3.5" /> Add profile
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive">
                      <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-border bg-background/40 text-[10px] text-muted-foreground"
                >
                  {m.profile_count} profiles
                </Badge>
                <Badge
                  variant="outline"
                  className="border-border bg-background/40 text-[10px] text-muted-foreground"
                >
                  Updated {formatRelative(m.last_scraped_at)}
                </Badge>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2 border-t border-border pt-3">
                <MiniStat label="Followers" value={m.followers} />
                <MiniStat label="Posts" value={m.posts} />
                <MiniStat label="Comments" value={m.comments} />
                <MiniStat label="Views" value={m.views} />
              </div>

              <div className="mt-4 space-y-1">
                {m.profiles.slice(0, 3).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-md border border-border/50 bg-background/40 px-2.5 py-1.5 text-[11px]"
                  >
                    <span className="truncate font-medium text-foreground">@{p.username}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatCompact(p.current_followers_count)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
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
