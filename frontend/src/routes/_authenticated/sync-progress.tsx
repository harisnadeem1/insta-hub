import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Clock3, CheckCircle2, AlertCircle, LoaderCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { KpiCard } from "@/components/kpi-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getToken } from "@/lib/auth-storage";
import { formatRelative } from "@/lib/mock-data";
import { toast } from "sonner";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

type SyncProgressItem = {
    profileId: number;
    username: string;
    member_name: string;
    jobId: string;
    status: "idle" | "waiting" | "delayed" | "active" | "completed" | "failed" | "not_found";
    progress: {
        stage?: string;
        pct?: number;
        username?: string;
        profileId?: number;
    } | null;
    returnvalue: {
        profileId?: number;
        followers_count?: number;
        posts_count?: number;
        comments_count?: number;
        visible_views_count?: number;
    } | null;
    failedReason: string | null;
    last_scraped_at: string | null;
};

type SyncProgressData = {
    summary: {
        total: number;
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        idle: number;
    };
    items: SyncProgressItem[];
};

export const Route = createFileRoute("/_authenticated/sync-progress")({
    head: () => ({
        meta: [
            { title: "Sync Progress — InstaNest" },
            {
                name: "description",
                content: "Track live progress for Instagram profile sync jobs.",
            },
        ],
    }),
    component: SyncProgressPage,
});

function SyncProgressPage() {
    const [data, setData] = useState<SyncProgressData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadStatus = async ({ silent = false }: { silent?: boolean } = {}) => {
        const token = getToken();

        try {
            if (silent) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            const response = await fetch(`${API_BASE_URL}/profiles/refresh-all/status`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error("Failed to load sync progress");
            }

            const result = await response.json();
            setData(result);
        } catch (error) {
            console.error("Failed to load sync progress:", error);
            toast.error("Could not load sync progress");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadStatus();

        const interval = setInterval(() => {
            loadStatus({ silent: true });
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    const sortedItems = useMemo(() => {
        if (!data?.items) return [];

        const order: Record<string, number> = {
            active: 0,
            waiting: 1,
            delayed: 2,
            failed: 3,
            completed: 4,
            idle: 5,
            not_found: 6,
        };

        return [...data.items].sort((a, b) => {
            const aRank = order[a.status] ?? 99;
            const bRank = order[b.status] ?? 99;

            if (aRank !== bRank) return aRank - bRank;
            return a.username.localeCompare(b.username);
        });
    }, [data]);

    return (
        <AppShell
            title="Sync Progress"
            subtitle="Track queued, running, completed, and failed profile sync jobs."
            actions={
                <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => loadStatus({ silent: true })}
                    disabled={refreshing}
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            }
        >
            <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <KpiCard label="Total jobs" value={data?.summary.total ?? 0} icon={<Clock3 className="h-3.5 w-3.5" />} />
                <KpiCard label="Waiting" value={data?.summary.waiting ?? 0} icon={<LoaderCircle className="h-3.5 w-3.5" />} />
                <KpiCard label="In progress" value={data?.summary.active ?? 0} icon={<RefreshCw className="h-3.5 w-3.5" />} />
                <KpiCard label="Completed" value={data?.summary.completed ?? 0} icon={<CheckCircle2 className="h-3.5 w-3.5" />} />
                <KpiCard label="Failed" value={data?.summary.failed ?? 0} icon={<AlertCircle className="h-3.5 w-3.5" />} />
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-card">
                <table className="w-full text-sm">
                    <thead className="border-b border-border bg-background/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                        <tr>
                            <th className="px-4 py-2.5 text-left font-medium">Username</th>
                            <th className="px-4 py-2.5 text-left font-medium">Member</th>
                            <th className="px-4 py-2.5 text-left font-medium">Queue status</th>
                            <th className="px-4 py-2.5 text-left font-medium">Stage</th>
                            <th className="px-4 py-2.5 text-right font-medium">Progress</th>
                            <th className="px-4 py-2.5 text-left font-medium">Last sync</th>
                            <th className="px-4 py-2.5 text-left font-medium">Details</th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-border">
                        {loading ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                                    Loading sync progress...
                                </td>
                            </tr>
                        ) : sortedItems.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                                    No sync jobs found.
                                </td>
                            </tr>
                        ) : (
                            sortedItems.map((item) => (
                                <tr key={item.profileId} className="transition-colors hover:bg-accent/40">
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-foreground">@{item.username}</div>
                                        <div className="text-[11px] text-muted-foreground">{item.jobId}</div>
                                    </td>

                                    <td className="px-4 py-3 text-xs text-muted-foreground">
                                        {item.member_name}
                                    </td>

                                    <td className="px-4 py-3">
                                        <JobStatusBadge status={item.status} />
                                    </td>

                                    <td className="px-4 py-3 text-xs text-muted-foreground">
                                        {formatStage(item.progress?.stage)}
                                    </td>

                                    <td className="px-4 py-3 text-right tabular-nums">
                                        {typeof item.progress?.pct === "number" ? `${item.progress.pct}%` : "—"}
                                    </td>

                                    <td className="px-4 py-3 text-xs text-muted-foreground">
                                        {formatRelative(item.last_scraped_at)}
                                    </td>

                                    <td className="px-4 py-3 text-xs text-muted-foreground">
                                        {item.failedReason
                                            ? item.failedReason
                                            : item.status === "completed"
                                                ? "Sync completed"
                                                : item.status === "active"
                                                    ? "Currently processing"
                                                    : item.status === "waiting" || item.status === "delayed"
                                                        ? "Queued for processing"
                                                        : item.status === "idle"
                                                            ? "Not started"
                                                            : "—"}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </AppShell>
    );
}

function formatStage(stage?: string) {
    if (!stage) return "—";
    if (stage === "scraping") return "Scraping";
    if (stage === "saving") return "Saving";
    if (stage === "done") return "Done";
    if (stage === "failed") return "Failed";
    if (stage === "waiting") return "Waiting";
    return stage;
}

function JobStatusBadge({
    status,
}: {
    status: "idle" | "waiting" | "delayed" | "active" | "completed" | "failed" | "not_found";
}) {
    const map = {
        idle: "Idle",
        waiting: "Waiting",
        delayed: "Waiting",
        active: "In progress",
        completed: "Completed",
        failed: "Failed",
        not_found: "Not found",
    };

    const className =
        status === "completed"
            ? "border-green-200 text-green-700"
            : status === "failed"
                ? "border-red-200 text-red-700"
                : status === "active"
                    ? "border-blue-200 text-blue-700"
                    : status === "waiting" || status === "delayed"
                        ? "border-amber-200 text-amber-700"
                        : "border-border text-muted-foreground";

    return (
        <Badge variant="outline" className={`text-[10px] ${className}`}>
            {map[status]}
        </Badge>
    );
}