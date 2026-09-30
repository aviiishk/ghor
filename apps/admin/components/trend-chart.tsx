"use client";

import { useMemo } from "react";
import { AreaChart } from "@/components/charts/area-chart";
import { Area } from "@/components/charts/area";
import { LineChart } from "@/components/charts/line-chart";
import { Line } from "@/components/charts/line";
import { Grid } from "@/components/charts/grid";
import { XAxis } from "@/components/charts/x-axis";
import { YAxis } from "@/components/charts/y-axis";
import { ChartTooltip } from "@/components/charts/tooltip";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export interface TrendSeries {
  key: string;
  label: string;
  color: string; // a --chart-N variable
}

// One chart card: Bklit area/line chart in GHOR colours + a legend with period totals
// (colour is never the only cue) + an always-available table view. When the period has no
// data at all it says so instead of drawing a flat line at zero.
export function TrendChart({
  title,
  description,
  data,
  series,
  kind = "line",
  loading,
  unit
}: {
  title: string;
  description?: string;
  data: Record<string, unknown>[] | undefined;
  series: TrendSeries[];
  kind?: "line" | "area";
  loading?: boolean;
  unit?: string;
}) {
  const rows = useMemo(
    (): Record<string, unknown>[] =>
      (data ?? []).map((d) => ({ ...d, date: new Date(`${String(d.date)}T00:00:00+05:30`) })),
    [data]
  );
  const totals = series.map((s) =>
    rows.reduce((n, r) => n + (typeof r[s.key] === "number" ? (r[s.key] as number) : 0), 0)
  );
  const hasData = rows.some((r) => series.some((s) => typeof r[s.key] === "number" && (r[s.key] as number) > 0));
  const Chart = kind === "area" ? AreaChart : LineChart;

  return (
    <Card className="rounded-2xl border-hairline shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-ink">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        <ul className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-body" aria-label={`${title} legend`}>
          {series.map((s, i) => (
            <li key={s.key} className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.label}
              {!unit && <span className="font-semibold text-ink">{totals[i]}</span>}
            </li>
          ))}
        </ul>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-48 w-full rounded-xl bg-surface-sunken" />
        ) : !hasData ? (
          <div className="grid h-48 place-items-center rounded-xl border border-dashed border-hairline text-sm text-muted">
            No activity recorded in this period yet.
          </div>
        ) : (
          <Chart data={rows} xDataKey="date" aspectRatio="3 / 1" margin={{ left: 36, right: 12, top: 12, bottom: 28 }}>
            <Grid horizontal />
            {series.map((s) =>
              kind === "area" ? (
                <Area key={s.key} dataKey={s.key} fill={s.color} stroke={s.color} />
              ) : (
                <Line key={s.key} dataKey={s.key} stroke={s.color} />
              )
            )}
            {/* Counts are integers: hide fractional ticks, and blank 0 (the baseline says it)
                so it never collides with the first date label. */}
            <YAxis formatValue={(v) => (v === 0 || !Number.isInteger(v) ? "" : String(v))} />
            <XAxis />
            <ChartTooltip />
          </Chart>
        )}
        {!loading && hasData && (
          <details className="mt-3 text-xs text-muted">
            <summary className="cursor-pointer">View as table</summary>
            <div className="mt-2 max-h-56 overflow-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-muted">
                    <th className="py-1 pr-3 font-semibold">Day</th>
                    {series.map((s) => (
                      <th key={s.key} className="py-1 pr-3 font-semibold">
                        {s.label}
                        {unit ? ` (${unit})` : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data ?? []).map((d) => (
                    <tr key={String(d.date)} className="border-t border-hairline text-body">
                      <td className="py-1 pr-3">{String(d.date)}</td>
                      {series.map((s) => (
                        <td key={s.key} className="py-1 pr-3">
                          {d[s.key] === null || d[s.key] === undefined ? "—" : String(d[s.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
