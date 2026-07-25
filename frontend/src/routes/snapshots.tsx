import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, FileJson, Eye } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  snapshots,
  profiles,
  members,
  getProfileById,
  getMemberById,
  formatNumber,
  formatRelative,
  type Snapshot,
} from "@/lib/mock-data";

export const Route = createFileRoute("/snapshots")({
  head: () => ({
    meta: [
      { title: "Snapshots — InstaNest" },
      {
        name: "description",
        content: "Historical scrape snapshots for every tracked public Instagram profile.",
      },
      { property: "og:title", content: "Snapshots — InstaNest" },
      {
        property: "og:description",
        content: "Historical scrape snapshots for every tracked public Instagram profile.",
      },
    ],
  }),
  component: SnapshotsPage,
});

function SnapshotsPage() {
  const [profileFilter, setProfileFilter] = useState("all");
  const [memberFilter, setMemberFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [selected, setSelected] = useState<Snapshot | null>(null);

  const rows = useMemo(() => {
    return [...snapshots]
      .filter((s) => {
        const p = getProfileById(s.instagram_profile_id);
        if (!p) return false;
        if (profileFilter !== "all" && p.id !== profileFilter) return false;
        if (memberFilter !== "all" && p.member_id !== memberFilter) return false;
        if (sourceFilter !== "all" && s.source !== sourceFilter) return false;
        return true;
      })
      .sort((a, b) => b.scraped_at.localeCompare(a.scraped_at));
  }, [profileFilter, memberFilter, sourceFilter]);

  const download = (type: "csv" | "json") => {
    toast.success(`Export started`, { description: `${rows.length} rows as ${type.toUpperCase()}` });
  };

  return (
    <AppShell
      title="Snapshots"
      subtitle="Every scrape recorded for debugging and history."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => download("csv")}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => download("json")}>
            <FileJson className="h-3.5 w-3.5" /> JSON
          </Button>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2.5">
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
        <Select value={profileFilter} onValueChange={setProfileFilter}>
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All profiles</SelectItem>
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                @{p.username}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any source</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="api">API</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto text-[11px] text-muted-foreground">
          {rows.length} snapshot{rows.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-border bg-background/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Scraped at</th>
              <th className="px-4 py-2.5 text-left font-medium">Profile</th>
              <th className="px-4 py-2.5 text-left font-medium">Member</th>
              <th className="px-4 py-2.5 text-right font-medium">Followers</th>
              <th className="px-4 py-2.5 text-right font-medium">Posts</th>
              <th className="px-4 py-2.5 text-right font-medium">Comments</th>
              <th className="px-4 py-2.5 text-right font-medium">Views</th>
              <th className="px-4 py-2.5 text-left font-medium">Source</th>
              <th className="px-2 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((s) => {
              const p = getProfileById(s.instagram_profile_id);
              const m = p ? getMemberById(p.member_id) : null;
              return (
                <tr key={s.id} className="hover:bg-accent/30">
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatRelative(s.scraped_at)}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">@{p?.username}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{m?.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatNumber(s.followers_count)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatNumber(s.posts_count)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {formatNumber(s.comments_count)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {formatNumber(s.visible_views_count)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      {s.source}
                    </Badge>
                  </td>
                  <td className="px-2 py-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setSelected(s)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No snapshots match these filters.
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">Raw payload</DialogTitle>
          </DialogHeader>
          <pre className="max-h-[400px] overflow-auto rounded-md border border-border bg-background/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
{JSON.stringify(selected?.raw_payload ?? {}, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}