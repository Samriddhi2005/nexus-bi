"use client";

import { useEffect, useState } from "react";

import { apiGet, apiPatch } from "@/lib/api";
import type { AdminUserSummary } from "@/lib/types";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingUid, setSavingUid] = useState<string | null>(null);

  const load = () => {
    apiGet<AdminUserSummary[]>("/api/admin/users")
      .then(setUsers)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load users."));
  };

  useEffect(load, []);

  const updateUser = async (uid: string, patch: Partial<{ role: string; plan: string; dailyLimit: number }>) => {
    setSavingUid(uid);
    try {
      await apiPatch(`/api/admin/users/${uid}`, patch);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSavingUid(null);
    }
  };

  if (error) return <p className="text-sm text-red-400">{error}</p>;

  return (
    <div className="glass-panel overflow-x-auto p-4">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-slate-500">
            <th className="pb-2">Email</th>
            <th className="pb-2">Role</th>
            <th className="pb-2">Plan</th>
            <th className="pb-2">Quota Used / Limit</th>
            <th className="pb-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.uid} className="border-t border-slate-800">
              <td className="py-2 text-slate-200">{u.email ?? u.uid}</td>
              <td className="py-2">
                <select
                  value={u.role}
                  disabled={savingUid === u.uid}
                  onChange={(e) => updateUser(u.uid, { role: e.target.value })}
                  className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </td>
              <td className="py-2">
                <select
                  value={u.plan}
                  disabled={savingUid === u.uid}
                  onChange={(e) => updateUser(u.uid, { plan: e.target.value })}
                  className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                >
                  <option value="free">free</option>
                  <option value="pro">pro</option>
                </select>
              </td>
              <td className="py-2 text-slate-400">
                {u.quotaUsed} / {u.quotaLimit}
              </td>
              <td className="py-2">
                <button
                  disabled={savingUid === u.uid}
                  onClick={() => {
                    const next = prompt("New daily query limit:", String(u.quotaLimit));
                    const parsed = next ? parseInt(next, 10) : NaN;
                    if (!Number.isNaN(parsed)) updateUser(u.uid, { dailyLimit: parsed });
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Edit quota
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
