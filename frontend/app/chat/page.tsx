"use client";

import { useEffect, useRef, useState } from "react";

import ProtectedRoute from "@/components/ProtectedRoute";
import ResultTabs from "@/components/ResultTabs";
import Sidebar from "@/components/Sidebar";
import ThoughtTrace from "@/components/ThoughtTrace";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import type { ChatResponse, SessionSummary, StoredMessage } from "@/lib/types";

const SAMPLE_PROMPTS = [
  "📈 What was the profit in July 2024?",
  "📉 Which months saw lower than average profit?",
  "📊 What is the trend of profit across all months?",
  "⭐ Which months had the highest customer satisfaction?",
];

export default function ChatPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadSessions = async () => {
    try {
      setSessions(await apiGet<SessionSummary[]>("/api/sessions"));
    } catch {
      setSessions([]);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    loadSessions();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectSession = async (id: string) => {
    setActiveSessionId(id);
    setError(null);
    try {
      setMessages(await apiGet<StoredMessage[]>(`/api/sessions/${id}/messages`));
    } catch {
      setMessages([]);
    }
  };

  const newChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setError(null);
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setError(null);
    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "user", content: trimmed },
    ]);
    setSending(true);

    try {
      const res = await apiPost<ChatResponse>("/api/chat", {
        message: trimmed,
        session_id: activeSessionId,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: res.message_id,
          role: "assistant",
          content: res.final_insights,
          sql_query: res.sql_query,
          guardrail_message: res.guardrail_message,
          thought_log: res.thought_log,
          chart_json: res.chart_json,
          columns: res.columns,
          rows: res.rows,
        },
      ]);

      if (!activeSessionId) {
        setActiveSessionId(res.session_id);
        await loadSessions();
      }
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 429
          ? "Daily query quota reached. Please try again after the reset window."
          : err instanceof Error
            ? err.message
            : "Something went wrong.";
      setError(message);
      setMessages((prev) => prev.slice(0, -1)); // roll back the optimistic user bubble
    } finally {
      setSending(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="flex h-screen" style={{ background: "var(--ink)", color: "var(--paper)" }}>
        <Sidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={selectSession}
          onNewChat={newChat}
          onDatasetUploaded={() => {}}
        />

        <main className="flex flex-1 flex-col overflow-hidden">
          {/* A slim bar, not a repeated tagline banner — a chat UI's main
              asset is vertical room for messages. */}
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{ borderBottom: "1px solid var(--rule)" }}
          >
            <div>
              <p className="l-eyebrow">Autonomous multi-agent BI</p>
              <h2 className="l-machine text-sm font-semibold" style={{ color: "var(--paper)" }}>
                Ask a business question about your data
              </h2>
            </div>
          </div>

          {messages.length === 0 && (
            <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2 lg:grid-cols-4">
              {SAMPLE_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => sendMessage(p.replace(/^\S+\s/, ""))}
                  className="l-glow-hover rounded-lg px-3 py-2 text-left text-xs transition-colors duration-150"
                  style={{ border: "1px solid var(--rule)", color: "var(--muted)" }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="my-3 flex justify-end">
                  <div
                    className="max-w-2xl rounded-2xl px-4 py-2 text-sm font-medium"
                    style={{ background: "var(--agent)", color: "var(--ink)" }}
                  >
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="my-5 max-w-3xl">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="block h-1.5 w-1.5 rounded-full" style={{ background: "var(--agent)" }} />
                    <span
                      className="l-machine text-[11px] font-semibold tracking-[0.14em] uppercase"
                      style={{ color: "var(--muted)" }}
                    >
                      NexusBI
                    </span>
                  </div>
                  <ThoughtTrace steps={m.thought_log ?? []} />
                  <ResultTabs
                    payload={{
                      content: m.content,
                      sql_query: m.sql_query,
                      guardrail_message: m.guardrail_message,
                      chart_json: m.chart_json,
                      columns: m.columns,
                      rows: m.rows,
                    }}
                  />
                </div>
              ),
            )}
            {sending && (
              <div className="l-machine my-3 text-sm" style={{ color: "var(--muted)" }}>
                Multi-agent brain at work…
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {error && (
            <div
              className="mx-4 mb-2 rounded-lg px-3 py-2 text-sm"
              style={{
                border: "1px solid color-mix(in srgb, var(--blocked) 35%, transparent)",
                background: "color-mix(in srgb, var(--blocked) 10%, transparent)",
                color: "var(--blocked)",
              }}
            >
              {error}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="flex gap-2 p-4"
            style={{ borderTop: "1px solid var(--rule)" }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask any business question about your data (e.g. sales, profit, trends)…"
              className="flex-1 rounded-lg px-4 py-2 text-sm outline-none"
              style={{ border: "1px solid var(--rule)", background: "var(--ink-raise)", color: "var(--paper)" }}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="l-machine rounded-lg px-5 py-2 text-sm font-semibold tracking-[0.02em] transition-opacity duration-150 disabled:opacity-40"
              style={{ background: "var(--paper)", color: "var(--ink)" }}
            >
              Send
            </button>
          </form>
        </main>
      </div>
    </ProtectedRoute>
  );
}
