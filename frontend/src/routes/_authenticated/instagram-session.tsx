import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SessionStatusResponse = {
  success: boolean;
  session: {
    exists: boolean;
    path: string;
    lastModified: string | null;
    sizeBytes: number | null;
  };
  setup: {
    inProgress: boolean;
    startedAt: string | null;
    completedAt: string | null;
    message: string | null;
    pid: number | null;
    lastExitCode: number | null;
    lastError: string | null;
    browserRunning: boolean;
    displayRunning: boolean;
    viewerUrl: string | null;
    log: string[];
  };
};

export const Route = createFileRoute("/_authenticated/instagram-session")({
  component: InstagramSessionPage,
});

function getToken() {
  return localStorage.getItem("token");
}

function InstagramSessionPage() {
  const [data, setData] = useState<SessionStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchStatus() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/instagram/session/status", {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || "Failed to load Instagram session status");
      }

      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function runAction(endpoint: "start" | "complete" | "reset") {
    try {
      setActionLoading(true);
      setError(null);

      const res = await fetch(`/api/instagram/session/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || `Failed to ${endpoint} session`);
      }

      setData((prev) => (prev ? { ...prev, ...json } : json));
      await fetchStatus();

      if (endpoint === "start" && json?.setup?.viewerUrl) {
        window.open(json.setup.viewerUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setActionLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
    const interval = window.setInterval(fetchStatus, 5000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Instagram Session</h1>
        <p className="text-sm text-muted-foreground">
          Manage the backend Playwright Instagram session used by the scraper.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Session Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {loading ? (
            <p>Loading status...</p>
          ) : (
            <>
              <p><span className="font-medium">Session exists:</span> {data?.session.exists ? "Yes" : "No"}</p>
              <p><span className="font-medium">Session path:</span> {data?.session.path || "-"}</p>
              <p><span className="font-medium">Last modified:</span> {data?.session.lastModified || "-"}</p>
              <p><span className="font-medium">Session size:</span> {data?.session.sizeBytes ?? "-"}</p>
              <p><span className="font-medium">In progress:</span> {data?.setup.inProgress ? "Yes" : "No"}</p>
              <p><span className="font-medium">Browser running:</span> {data?.setup.browserRunning ? "Yes" : "No"}</p>
              <p><span className="font-medium">Display running:</span> {data?.setup.displayRunning ? "Yes" : "No"}</p>
              <p><span className="font-medium">Started at:</span> {data?.setup.startedAt || "-"}</p>
              <p><span className="font-medium">Completed at:</span> {data?.setup.completedAt || "-"}</p>
              <p><span className="font-medium">PID:</span> {data?.setup.pid || "-"}</p>
              <p><span className="font-medium">Last exit code:</span> {data?.setup.lastExitCode ?? "-"}</p>
              <p><span className="font-medium">Last error:</span> {data?.setup.lastError || "-"}</p>
              <p><span className="font-medium">Message:</span> {data?.setup.message || "-"}</p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Browser Viewer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            On VPS, the Instagram login opens in a remote browser viewer backed by the server session.
          </p>

          {data?.setup.viewerUrl ? (
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() => window.open(data.setup.viewerUrl!, "_blank", "noopener,noreferrer")}
              >
                Open Browser Viewer
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground">Viewer URL not available yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={() => runAction("start")} disabled={actionLoading}>
            Start Session Setup
          </Button>

          <Button
            variant="secondary"
            onClick={() => runAction("complete")}
            disabled={actionLoading}
          >
            Mark Session Complete
          </Button>

          <Button
            variant="destructive"
            onClick={() => runAction("reset")}
            disabled={actionLoading}
          >
            Reset Session
          </Button>

          <Button variant="outline" onClick={fetchStatus} disabled={loading || actionLoading}>
            Refresh Status
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live Log</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          {data?.setup.log?.length ? (
            <div className="max-h-80 overflow-auto rounded-md border bg-muted p-3 font-mono">
              {data.setup.log.map((line, index) => (
                <div key={`${index}-${line}`}>{line}</div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No logs yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}