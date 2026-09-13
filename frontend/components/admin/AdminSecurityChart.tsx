"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { OverviewStats } from "@/lib/types";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

export default function AdminSecurityChart({ stats }: { stats: OverviewStats }) {
  const { chartData, safePercent, totalEvaluated } = useMemo(() => {
    const totalQueries = Math.max(stats.queries7d, stats.queriesToday, 1);
    const blocks = Math.max(stats.guardrailBlocksToday, 0);
    const allowed = Math.max(0, totalQueries - blocks);

    const safePct = totalQueries > 0 ? Math.round((allowed / totalQueries) * 100) : 100;

    const data = [
      {
        values: [allowed, blocks],
        labels: ["Allowed Queries", "Blocked Attacks"],
        type: "pie" as const,
        hole: 0.68,
        marker: {
          colors: ["#10b981", "#ef4444"],
          line: { color: "#0f172a", width: 2 },
        },
        textinfo: "none",
        hoverinfo: "label+value+percent",
      },
    ];

    return { chartData: data, safePercent: safePct, totalEvaluated: totalQueries };
  }, [stats]);

  const layout = useMemo(
    () => ({
      autosize: true,
      template: "plotly_dark" as const,
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      margin: { l: 10, r: 10, t: 10, b: 10 },
      showlegend: false,
      annotations: [
        {
          font: { size: 18, color: "#f8fafc", weight: "bold", family: "Inter, sans-serif" },
          showarrow: false,
          text: `${safePercent}%`,
          x: 0.5,
          y: 0.53,
        },
        {
          font: { size: 9, color: "#94a3b8", family: "Inter, sans-serif" },
          showarrow: false,
          text: "Safe Queries",
          x: 0.5,
          y: 0.42,
        },
      ],
    }),
    [safePercent]
  );

  return (
    <div className="glass-panel flex flex-col p-5">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">🛡️ Guardrail Security Posture</h3>
          <p className="text-xs text-slate-500">Read-only enforcement vs malicious mutations</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium border ${
            safePercent >= 95
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
          }`}
        >
          {safePercent >= 95 ? "Shield Active" : "Threats Filtered"}
        </span>
      </div>

      <div className="relative flex h-[200px] w-full items-center justify-center">
        <Plot
          data={chartData as never}
          layout={layout as never}
          style={{ width: "100%", height: "100%" }}
          useResizeHandler
          config={{
            displaylogo: false,
            responsive: true,
            displayModeBar: false,
          }}
        />
      </div>

      {/* Legend & Telemetry Breakdown */}
      <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-800/80 pt-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="text-slate-400">Allowed SELECT:</span>
          <span className="font-semibold text-slate-200">
            {totalEvaluated - stats.guardrailBlocksToday}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
          <span className="text-slate-400">Blocked DDL/DML:</span>
          <span className="font-semibold text-rose-400">{stats.guardrailBlocksToday}</span>
        </div>
      </div>
    </div>
  );
}
