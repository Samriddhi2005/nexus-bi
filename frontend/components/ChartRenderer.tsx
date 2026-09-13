"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

export type ChartType = "bar" | "line" | "area" | "donut";

// First two entries match the shared brand tokens (--agent, --answer) so the
// common single/dual-series case picks up the same colors as the rest of the
// product; the rest fill out variety for charts with more series.
const PALETTE = ["#5b8cff", "#f5b23d", "#34d399", "#a78bfa", "#ff5c5c", "#38bdf8"];

interface ChartRendererProps {
  chartJson?: string | null;
  columns?: string[];
  rows?: Record<string, unknown>[];
  title?: string;
}

interface PlotlyTrace {
  x?: unknown[];
  y?: unknown[];
  labels?: unknown[];
  values?: unknown[];
  type?: string;
  mode?: string;
  name?: string;
  fill?: string;
  hole?: number;
  marker?: Record<string, unknown>;
  line?: Record<string, unknown>;
}

export default function ChartRenderer({
  chartJson,
  columns = [],
  rows = [],
  title,
}: ChartRendererProps) {
  const [activeType, setActiveType] = useState<ChartType>("bar");

  // 1. Parse pre-computed chart_json if available
  const parsedServerFigure = useMemo(() => {
    if (!chartJson) return null;
    try {
      const parsed = JSON.parse(chartJson) as { data: PlotlyTrace[]; layout: Record<string, unknown> };
      if (Array.isArray(parsed.data) && parsed.data.length > 0) {
        return parsed;
      }
    } catch {
      // Fall through to client synthesis
    }
    return null;
  }, [chartJson]);

  // 2. Synthesize figure from tabular data (smart auto-fallback)
  const synthesizedFigure = useMemo(() => {
    if (parsedServerFigure) return null;
    if (!rows || rows.length < 1 || !columns || columns.length < 2) return null;

    // Detect numeric columns vs categorical columns
    const numericCols = columns.filter((col) => {
      let validCount = 0;
      for (const r of rows.slice(0, 10)) {
        const val = r[col];
        if (val !== null && val !== "" && !isNaN(Number(val))) {
          validCount++;
        }
      }
      return validCount > 0;
    });

    const categoryCols = columns.filter((c) => !numericCols.includes(c));
    const xCol = categoryCols.length > 0 ? categoryCols[0] : columns[0];
    const metrics = numericCols.length > 0 ? numericCols.slice(0, 3) : columns.slice(1, 2);

    const xValues = rows.map((r) => String(r[xCol] ?? ""));

    const traces: PlotlyTrace[] = metrics.map((mCol, idx) => {
      const yValues = rows.map((r) => {
        const num = Number(r[mCol]);
        return isNaN(num) ? 0 : num;
      });
      const formattedName = mCol.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

      return {
        x: xValues,
        y: yValues,
        name: formattedName,
        type: "bar",
        marker: { color: PALETTE[idx % PALETTE.length] },
      };
    });

    return {
      data: traces,
      layout: {
        title: title ? { text: title, font: { color: "#e6ebf4", size: 14 } } : undefined,
        xaxis: {
          title: xCol.replace(/_/g, " ").toUpperCase(),
          color: "#79879f",
          gridcolor: "#1a2333",
        },
        yaxis: {
          color: "#79879f",
          gridcolor: "#1a2333",
        },
      },
    };
  }, [parsedServerFigure, rows, columns, title]);

  const baseFigure = parsedServerFigure || synthesizedFigure;

  // 3. Adapt traces based on activeType selection
  const transformedFigure = useMemo(() => {
    if (!baseFigure) return null;

    const data = (baseFigure.data as PlotlyTrace[]).map((trace, idx) => {
      const color = PALETTE[idx % PALETTE.length];

      if (activeType === "bar") {
        return {
          ...trace,
          type: "bar",
          mode: undefined,
          fill: undefined,
          hole: undefined,
          marker: { ...trace.marker, color: trace.marker?.color || color },
        };
      }
      if (activeType === "line") {
        return {
          ...trace,
          type: "scatter",
          mode: "lines+markers",
          fill: undefined,
          hole: undefined,
          line: { color, width: 3 },
          marker: { size: 6, color },
        };
      }
      if (activeType === "area") {
        return {
          ...trace,
          type: "scatter",
          mode: "lines+markers",
          fill: "tozeroy",
          hole: undefined,
          line: { color, width: 2 },
          marker: { size: 5, color },
        };
      }
      if (activeType === "donut") {
        return {
          ...trace,
          type: "pie",
          mode: undefined,
          fill: undefined,
          hole: 0.5,
          labels: trace.x || trace.labels,
          values: trace.y || trace.values,
          marker: { colors: PALETTE },
        };
      }
      return trace;
    });

    return {
      data,
      layout: {
        ...baseFigure.layout,
        autosize: true,
        template: "plotly_dark",
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        font: { color: "#79879f", family: "var(--font-machine), ui-monospace, monospace" },
        margin: { l: 45, r: 20, t: 40, b: 40 },
        legend: {
          orientation: "h",
          yanchor: "bottom",
          y: 1.02,
          xanchor: "right",
          x: 1,
          font: { size: 11, color: "#e6ebf4" },
        },
      },
    };
  }, [baseFigure, activeType]);

  if (!transformedFigure) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center" style={{ color: "var(--muted)" }}>
        <p className="text-sm">No chart needed for this query (e.g., single scalar fact or empty result).</p>
      </div>
    );
  }

  const chartTypes: { type: ChartType; label: string }[] = [
    { type: "bar", label: "Bar" },
    { type: "line", label: "Line" },
    { type: "area", label: "Area" },
    { type: "donut", label: "Donut" },
  ];

  return (
    <div className="space-y-3">
      {/* Visual Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2" style={{ borderBottom: "1px solid var(--rule)" }}>
        <span className="l-eyebrow">
          {parsedServerFigure ? "AI-generated chart" : "Auto-synthesized visual"}
        </span>

        {/* Chart Type Selector */}
        <div className="flex items-center gap-1 rounded-lg p-1" style={{ border: "1px solid var(--rule)", background: "var(--ink-raise)" }}>
          {chartTypes.map(({ type, label }) => {
            const active = activeType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setActiveType(type)}
                className="l-machine rounded px-2.5 py-1 text-[11px] tracking-[0.04em] transition-colors duration-150"
                style={{
                  background: active ? "color-mix(in srgb, var(--agent) 18%, transparent)" : "transparent",
                  color: active ? "var(--agent)" : "var(--muted)",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Plotly Canvas Container */}
      <div className="overflow-hidden rounded-lg p-2" style={{ background: "var(--ink)" }}>
        <Plot
          data={transformedFigure.data as never}
          layout={transformedFigure.layout as never}
          style={{ width: "100%", height: "420px" }}
          useResizeHandler
          config={{
            displaylogo: false,
            responsive: true,
            modeBarButtonsToRemove: ["lasso2d", "select2d"],
            toImageButtonOptions: {
              format: "png",
              filename: "nexus_bi_visualization",
              height: 600,
              width: 900,
              scale: 2,
            },
          }}
        />
      </div>
    </div>
  );
}
