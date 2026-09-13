"use client";

import { useEffect, useState } from "react";

import { apiGet } from "@/lib/api";
import type { OverviewStats } from "@/lib/types";
import AdminTrendChart from "@/components/admin/AdminTrendChart";
import AdminSecurityChart from "@/components/admin/AdminSecurityChart";

const CARDS: { key: keyof OverviewStats; label: string; icon: string }[] = [
  { key: "totalUsers", label: "Total Users", icon: "👥" },
  { key: "queriesToday", label: "Queries Today", icon: "⚡" },
  { key: "queries7d", label: "Queries (7d)", icon: "📈" },
  { key: "guardrailBlocksToday", label: "Guardrail Blocks Today", icon: "🛡️" },
  { key: "errorsToday", label: "Errors Today", icon: "⚠️" },
];

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<OverviewStats>("/api/admin/overview")
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load overview."));
  }, []);

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!stats) return <p className="text-sm text-slate-500">Loading overview…</p>;

  return (
    <div className="space-y-6">
      {/* 5 KPI Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {CARDS.map((c) => (
          <div key={c.key} className="glass-panel p-5">
            <div className="text-2xl">{c.icon}</div>
            <div className="mt-2 text-2xl font-bold text-slate-100">{stats[c.key]}</div>
            <div className="text-xs text-slate-500">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Visual Analytics Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AdminTrendChart stats={stats} />
        </div>
        <div className="lg:col-span-1">
          <AdminSecurityChart stats={stats} />
        </div>
      </div>
    </div>
  );
}
