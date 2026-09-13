"use client";

import { useEffect, useState } from "react";

import { apiGet } from "@/lib/api";
import type { AuditLogEntry } from "@/lib/types";

export default function AdminAuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [uidFilter, setUidFilter] = useState("");
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    const params = new URLSearchParams();
    if (uidFilter) params.set("uid", uidFilter);
    if (blockedOnly) params.set("blocked_only", "true");
    apiGet<AuditLogEntry[]>(`/api/admin/audit-log?${params.toString()}`)
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load audit log."));
  };

  useEffect(load, [blockedOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = entries.length;
  const blockedCount = entries.filter((e) => e.blocked).length;
  const allowedCount = total - blockedCount;
  const blockRate = total > 0 ? Math.round((blockedCount / total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Visual Security Telemetry Card */}
      <div className="glass-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">🛡️ Audit Trail Telemetry</h3>
            <p className="text-xs text-slate-500">Live query validation breakdown and threat mitigation ratio</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-slate-400">Allowed:</span>
              <span className="font-semibold text-emerald-400">{allowedCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
              <span className="text-slate-400">Blocked:</span>
              <span className="font-semibold text-rose-400">{blockedCount}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-slate-800 px-2.5 py-1">
              <span className="text-slate-400">Block Rate:</span>
              <span className="font-semibold text-slate-200">{blockRate}%</span>
            </div>
          </div>
        </div>

        {/* Visual Progress Bar Ratio */}
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div className="flex h-full w-full">
            <div
              style={{ width: `${total > 0 ? (allowedCount / total) * 100 : 100}%` }}
              className="bg-emerald-500 transition-all duration-500"
              title={`Allowed: ${allowedCount}`}
            />
            <div
              style={{ width: `${total > 0 ? (blockedCount / total) * 100 : 0}%` }}
              className="bg-rose-500 transition-all duration-500"
              title={`Blocked: ${blockedCount}`}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={uidFilter}
          onChange={(e) => setUidFilter(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="Filter by uid…"
          className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-sm text-slate-100"
        />
        <label className="flex items-center gap-1 text-sm text-slate-400">
          <input type="checkbox" checked={blockedOnly} onChange={(e) => setBlockedOnly(e.target.checked)} />
          Blocked only
        </label>
        <button onClick={load} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500">
          Filter
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="glass-panel overflow-x-auto p-4">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="uppercase tracking-wide text-slate-500">
              <th className="pb-2">Timestamp</th>
              <th className="pb-2">User</th>
              <th className="pb-2">SQL Query</th>
              <th className="pb-2">Verdict</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-slate-800 align-top">
                <td className="py-2 whitespace-nowrap text-slate-500">{e.timestamp}</td>
                <td className="py-2 text-slate-300">{e.uid}</td>
                <td className="py-2 max-w-md truncate text-slate-400" title={e.sqlQuery ?? ""}>
                  {e.sqlQuery ?? "—"}
                </td>
                <td className="py-2 text-slate-400">{e.guardrailVerdict ?? "—"}</td>
                <td className="py-2">
                  <span className={`badge ${e.blocked ? "badge-blocked" : "badge-safe"}`}>
                    {e.blocked ? "Blocked" : "Allowed"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {entries.length === 0 && <p className="py-4 text-center text-slate-500">No audit entries found.</p>}
      </div>
    </div>
  );
}
