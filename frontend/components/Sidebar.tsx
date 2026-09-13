"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiGet, apiUpload } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { DatasetSummary, SchemaResponse, SessionSummary } from "@/lib/types";

interface Props {
  sessions: SessionSummary[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDatasetUploaded: () => void;
}

export default function Sidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDatasetUploaded,
}: Props) {
  const { profile, signOutUser } = useAuth();
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [schemaText, setSchemaText] = useState("");
  const [showSchema, setShowSchema] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const loadDatasets = async () => {
    try {
      setDatasets(await apiGet<DatasetSummary[]>("/api/datasets"));
    } catch {
      setDatasets([]);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    loadDatasets();
  }, []);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      await apiUpload<DatasetSummary>("/api/datasets", file);
      await loadDatasets();
      onDatasetUploaded();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const toggleSchema = async () => {
    if (!showSchema) {
      try {
        const res = await apiGet<SchemaResponse>("/api/datasets/schema");
        setSchemaText(res.schema_text);
      } catch {
        setSchemaText("Failed to load schema.");
      }
    }
    setShowSchema((v) => !v);
  };

  return (
    <aside className="sidebar-gradient flex h-full w-72 flex-shrink-0 flex-col overflow-y-auto p-4">
      <Link href="/" className="mb-5 flex items-center gap-2.5">
        <span className="block h-2 w-2 rounded-full" style={{ background: "var(--agent)" }} />
        <span className="l-machine text-[13px] font-semibold tracking-[0.2em] uppercase" style={{ color: "var(--paper)" }}>
          NexusBI
        </span>
      </Link>

      <button
        onClick={onNewChat}
        className="l-glow-hover mb-5 rounded-lg py-2 text-sm font-medium"
        style={{
          border: "1px solid color-mix(in srgb, var(--agent) 40%, transparent)",
          background: "color-mix(in srgb, var(--agent) 10%, transparent)",
          color: "var(--agent)",
        }}
      >
        + New Chat
      </button>

      <div className="mb-5 flex-1 overflow-y-auto">
        <p className="l-eyebrow mb-2">Sessions</p>
        {sessions.length === 0 && (
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            No conversations yet.
          </p>
        )}
        <ul className="space-y-1">
          {sessions.map((s) => {
            const active = s.id === activeSessionId;
            return (
              <li key={s.id}>
                <button
                  onClick={() => onSelectSession(s.id)}
                  className="w-full truncate rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors duration-150"
                  style={{
                    background: active ? "color-mix(in srgb, var(--agent) 14%, transparent)" : "transparent",
                    color: active ? "var(--paper)" : "var(--muted)",
                  }}
                  title={s.title}
                >
                  {s.title}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mb-5 pt-4" style={{ borderTop: "1px solid var(--rule)" }}>
        <p className="l-eyebrow mb-2">Data source</p>
        <label
          className="block cursor-pointer rounded-lg px-3 py-2.5 text-center text-xs transition-colors duration-150"
          style={{ border: "1px dashed var(--rule)", color: "var(--muted)" }}
        >
          {uploading ? "Uploading…" : "Upload CSV / Excel"}
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = "";
            }}
          />
        </label>
        {uploadError && (
          <p className="mt-1 text-xs" style={{ color: "var(--blocked)" }}>
            {uploadError}
          </p>
        )}

        {datasets.length > 0 && (
          <ul className="mt-2 space-y-1">
            {datasets.map((d) => (
              <li
                key={d.id}
                className="l-machine truncate rounded-md px-2 py-1 text-[10.5px]"
                style={{ background: "var(--ink-raise)", color: "var(--muted)" }}
                title={d.tableName}
              >
                {d.tableName} <span style={{ opacity: 0.7 }}>· {d.rowCount} rows</span>
              </li>
            ))}
          </ul>
        )}

        <button
          onClick={toggleSchema}
          className="l-machine mt-2.5 text-[11px] tracking-[0.06em]"
          style={{ color: "var(--agent)" }}
        >
          {showSchema ? "Hide schema" : "Inspect schema →"}
        </button>
        {showSchema && (
          <pre
            className="l-machine mt-2 max-h-40 overflow-auto rounded-lg p-2 text-[10px]"
            style={{ background: "var(--ink)", color: "var(--muted)", border: "1px solid var(--rule)" }}
          >
            {schemaText}
          </pre>
        )}
      </div>

      {/* Extra bottom padding: Next.js's dev-mode indicator badge sits in
          this same corner during local development, and this keeps the two
          from visually overlapping. Harmless in production, where it doesn't exist. */}
      <div className="pt-3 pb-8 text-xs" style={{ borderTop: "1px solid var(--rule)", color: "var(--muted)" }}>
        <p className="truncate" style={{ color: "var(--paper)" }}>
          {profile?.email}
        </p>
        {profile && (
          <p className="l-machine mt-0.5 text-[10.5px]">
            {profile.plan} · {profile.quota.used}/{profile.quota.dailyLimit} today
          </p>
        )}
        {profile?.role === "admin" && (
          <Link href="/admin" className="mt-1.5 block" style={{ color: "var(--agent)" }}>
            Admin Portal →
          </Link>
        )}
        <button
          onClick={signOutUser}
          className="mt-1.5 transition-colors duration-150"
          style={{ color: "var(--muted)" }}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
