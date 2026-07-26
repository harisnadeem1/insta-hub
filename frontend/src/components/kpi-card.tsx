import type { ReactNode } from "react";
import { formatCompact } from "@/lib/mock-data";
import { ArrowUpRight } from "lucide-react";

export function KpiCard({
  label,
  value,
  hint,
  icon,
  delta,
}: {
  label: string;
  value: number;
  hint?: string;
  icon?: ReactNode;
  delta?: string;
}) {
  return (
    <div className="group relative rounded-xl border border-border bg-card p-4 transition-colors hover:border-border/80 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            {icon}
            <span>{label}</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="tabular-nums text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {formatCompact(value)}
            </span>
            {delta && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                <ArrowUpRight className="h-3 w-3" /> {delta}
              </span>
            )}
          </div>
          {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
        </div>
      </div>
    </div>
  );
}
