"use client";

import { useState } from "react";

import ChartRenderer from "./ChartRenderer";

const TABS = ["Insights", "Chart", "Raw Data", "SQL Inspector"] as const;
type Tab = (typeof TABS)[number];

export interface AssistantPayload {
  content: string;
  sql_query?: string | null;
  guardrail_message?: string | null;
  chart_json?: string | null;
  columns?: string[];
  rows?: Record<string, unknown>[];
}

function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = columns.map(escape).join(",");
  const body = rows.map((row) => columns.map((c) => escape(row[c])).join(",")).join("\n");
  return `${header}\n${body}`;
}

function downloadCsv(columns: string[], rows: Record<string, unknown>[]) {
  const csv = toCsv(columns, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "nexus_bi_result.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function ResultTabs({ payload }: { payload: AssistantPayload }) {
  const [tab, setTab] = useState<Tab>("Insights");
  const columns = payload.columns ?? [];
  const rows = payload.rows ?? [];

  return (
    <div className="mt-2 overflow-hidden rounded-xl" style={{ border: "1px solid var(--rule)" }}>
      <div className="flex flex-wrap gap-1 p-1" style={{ borderBottom: "1px solid var(--rule)" }}>
        {TABS.map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="l-machine rounded-lg px-3 py-1.5 text-[11px] tracking-[0.06em] uppercase transition-colors duration-150"
              style={{
                background: active ? "color-mix(in srgb, var(--agent) 16%, transparent)" : "transparent",
                color: active ? "var(--agent)" : "var(--muted)",
              }}
            >
              {t}
            </button>
          );
        })}
      </div>

      <div className="p-4">
        {tab === "Insights" && (
          <div
            className="whitespace-pre-wrap border-l-2 pl-4 text-sm leading-relaxed"
            style={{ borderColor: "var(--answer)", color: "var(--paper)" }}
          >
            {payload.content || "No insights generated."}
          </div>
        )}

        {tab === "Chart" && (
          <ChartRenderer
            chartJson={payload.chart_json}
            columns={columns}
            rows={rows}
            title={payload.sql_query ? "Query Visual Analytics" : undefined}
          />
        )}

        {tab === "Raw Data" &&
          (rows.length ? (
            <div>
              <div className="mb-2 flex justify-end">
                <button
                  onClick={() => downloadCsv(columns, rows)}
                  className="l-machine rounded-lg px-3 py-1 text-[11px] tracking-[0.04em] transition-colors duration-150"
                  style={{ border: "1px solid var(--rule)", color: "var(--paper)" }}
                >
                  Download CSV
                </button>
              </div>
              <div className="max-h-80 overflow-auto rounded-lg" style={{ border: "1px solid var(--rule)" }}>
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0" style={{ background: "var(--ink-raise)" }}>
                    <tr>
                      {columns.map((c) => (
                        <th
                          key={c}
                          className="l-machine px-3 py-2 font-semibold tracking-[0.04em]"
                          style={{ borderBottom: "1px solid var(--rule)", color: "var(--paper)" }}
                        >
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} style={{ background: i % 2 ? "color-mix(in srgb, var(--ink-raise) 60%, transparent)" : "transparent" }}>
                        {columns.map((c) => (
                          <td
                            key={c}
                            className="px-3 py-1.5"
                            style={{ borderBottom: "1px solid color-mix(in srgb, var(--rule) 70%, transparent)", color: "var(--muted)" }}
                          >
                            {String(row[c] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              No tabular data returned.
            </p>
          ))}

        {tab === "SQL Inspector" && (
          <div>
            <span className={`badge ${payload.guardrail_message ? "badge-safe" : "badge-blocked"}`}>
              {payload.guardrail_message ? "Read-only · verified" : "Blocked"}
            </span>
            <pre
              className="l-machine mt-2 overflow-x-auto rounded-lg p-3 text-xs"
              style={{ background: "var(--ink)", color: "var(--paper)", border: "1px solid var(--rule)" }}
            >
              {payload.sql_query || "-- No SQL generated"}
            </pre>
            {payload.guardrail_message && (
              <p className="mt-1.5 text-xs" style={{ color: "var(--muted)" }}>
                Guardrail note: {payload.guardrail_message}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
