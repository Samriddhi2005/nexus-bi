"use client";

import { useScrollProgress, useTilt } from "@/lib/motion";
import PipelineDiagram from "./diagrams/PipelineDiagram";

export type NodeState = "idle" | "active" | "done" | "failed";

export interface RunState {
  planner: NodeState;
  guardrail: NodeState;
  execute: NodeState;
  synthesize: NodeState;
  retryDrawn: number;
  healed: boolean;
  agent: string;
  thought: string;
  tone: "agent" | "blocked" | "answer";
  meta: string;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Maps scroll progress onto the real sequence the LangGraph state machine
 * runs: generate_sql → guardrail → execute_sql → (error routed back, retry)
 * → execute_sql → synthesize. Thought strings are verbatim from
 * core/agent_graph.py so the page shows what the product actually logs.
 */
export function runStateFor(p: number): RunState {
  if (p < 0.18) {
    return {
      planner: "active", guardrail: "idle", execute: "idle", synthesize: "idle",
      retryDrawn: 0, healed: false,
      agent: "Planner & SQL Engineer",
      thought: "Analyzing user question and database schema to generate an optimized SQLite query.",
      tone: "agent",
      meta: "attempt 1",
    };
  }
  if (p < 0.34) {
    return {
      planner: "done", guardrail: "active", execute: "idle", synthesize: "idle",
      retryDrawn: 0, healed: false,
      agent: "Security Guardrail",
      thought: "Verified SQL query: SAFE (Read-Only SELECT enforced).",
      tone: "agent",
      meta: "select-only",
    };
  }
  if (p < 0.5) {
    return {
      planner: "done", guardrail: "done", execute: "active", synthesize: "idle",
      retryDrawn: 0, healed: false,
      agent: "Database Executor",
      thought: "Running query against SQLite…",
      tone: "agent",
      meta: "executing",
    };
  }
  if (p < 0.62) {
    return {
      planner: "done", guardrail: "done", execute: "failed", synthesize: "idle",
      retryDrawn: 0, healed: false,
      agent: "Database Executor",
      thought: "SQLite execution failed with error: no such column: proft.",
      tone: "blocked",
      meta: "failed",
    };
  }
  if (p < 0.76) {
    return {
      planner: "active", guardrail: "idle", execute: "failed", synthesize: "idle",
      retryDrawn: clamp01((p - 0.62) / 0.08),
      healed: p > 0.69,
      agent: "Self-Healing Engine",
      thought: "Attempt 2: Fixing query based on error -> no such column: proft",
      tone: "blocked",
      meta: "retry 1 of 3",
    };
  }
  if (p < 0.88) {
    return {
      planner: "done", guardrail: "done", execute: "done", synthesize: "idle",
      retryDrawn: 1, healed: true,
      agent: "Database Executor",
      thought: "Query executed successfully in SQLite. Fetched 3 rows.",
      tone: "agent",
      meta: "3 rows",
    };
  }
  return {
    planner: "done", guardrail: "done", execute: "done", synthesize: "done",
    retryDrawn: 1, healed: true,
    agent: "Business Strategist & Visualizer",
    thought: "Synthesizing raw SQL results into executive insights and Plotly visualization.",
    tone: "answer",
    meta: "answer ready",
  };
}

const TONE_VAR: Record<RunState["tone"], string> = {
  agent: "var(--agent)",
  blocked: "var(--blocked)",
  answer: "var(--answer)",
};

function QueryLine({ healed }: { healed: boolean }) {
  return (
    <code className="l-machine text-[clamp(0.72rem,1.15vw,0.9rem)] leading-[1.8]">
      <span style={{ color: "var(--agent)" }}>SELECT</span> month,{" "}
      <span
        className="rounded px-1 transition-colors duration-300"
        style={{
          color: healed ? "var(--paper)" : "var(--blocked)",
          background: healed
            ? "transparent"
            : "color-mix(in srgb, var(--blocked) 16%, transparent)",
          textDecoration: healed ? "none" : "underline wavy",
          textUnderlineOffset: "3px",
        }}
      >
        {healed ? "profit" : "proft"}
      </span>{" "}
      <span style={{ color: "var(--agent)" }}>FROM</span> Sales_Agent
      <br />
      <span style={{ color: "var(--agent)" }}>WHERE</span> profit &lt; (
      <span style={{ color: "var(--agent)" }}>SELECT AVG</span>(profit){" "}
      <span style={{ color: "var(--agent)" }}>FROM</span> Sales_Agent);
    </code>
  );
}

/** Narrow screens get the same sequence as a readable static stack. */
const STATIC_STEPS = [
  ["Planner & SQL Engineer", "Writes SQLite from your question and the live schema.", "agent"],
  ["Security Guardrail", "Rejects anything that isn't a read-only SELECT.", "agent"],
  ["Database Executor", "Fails: no such column: proft", "blocked"],
  ["Self-Healing Engine", "Reads the error, rewrites proft → profit, retries (max 3).", "blocked"],
  ["Database Executor", "Succeeds. 3 rows.", "agent"],
  ["Business Strategist", "Turns rows into an executive answer and a chart.", "answer"],
] as const;

export default function TheRun() {
  const [ref, progress] = useScrollProgress<HTMLDivElement>();
  const state = runStateFor(progress);
  const thoughtTilt = useTilt<HTMLDivElement>(5);
  const queryTilt = useTilt<HTMLDivElement>(5);

  return (
    <section id="run" data-stage="2" className="relative">
      {/* Desktop: pinned and scroll-scrubbed. */}
      <div ref={ref} className="hidden md:block md:h-[420vh]">
        <div className="sticky top-0 flex h-screen items-center">
          <div className="mx-auto w-full max-w-6xl px-6">
            <p className="l-eyebrow mb-3">The run · scroll to advance</p>
            <h2 className="l-h2 mb-10 max-w-2xl" style={{ color: "var(--paper)" }}>
              Watch a question fail, and fix itself.
            </h2>

            <PipelineDiagram state={state} />

            <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
              <div
                ref={thoughtTilt}
                className="l-raise l-tilt rounded-xl p-5"
                style={{
                  borderColor: TONE_VAR[state.tone],
                  // Explicit here rather than split across two classes: .l-tilt's
                  // own transition shorthand would otherwise silently override a
                  // separate transition-colors utility instead of combining with it.
                  transition: "border-color 300ms ease, transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                <div className="mb-2.5 flex items-center justify-between gap-4">
                  <span
                    className="l-machine text-[11px] tracking-[0.14em] uppercase transition-colors duration-300"
                    style={{ color: TONE_VAR[state.tone] }}
                  >
                    {state.agent}
                  </span>
                  <span className="l-machine text-[11px]" style={{ color: "var(--muted)" }}>
                    {state.meta}
                  </span>
                </div>
                <p className="l-machine text-[13px] leading-[1.65]" style={{ color: "var(--paper)" }}>
                  {state.thought}
                </p>
              </div>

              <div ref={queryTilt} className="l-raise l-tilt rounded-xl p-5">
                <p className="l-eyebrow mb-2.5">Query in flight</p>
                <QueryLine healed={state.healed} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Narrow screens: no pinning, no scrubbing — the sequence told plainly. */}
      <div className="mx-auto max-w-6xl px-6 py-24 md:hidden">
        <p className="l-eyebrow mb-3">The run</p>
        <h2 className="l-h2 mb-8" style={{ color: "var(--paper)" }}>
          Watch a question fail, and fix itself.
        </h2>
        <ol className="space-y-3">
          {STATIC_STEPS.map(([agent, detail, tone], i) => (
            <li
              key={`${agent}-${i}`}
              className="l-raise rounded-xl p-4"
              style={{
                borderColor:
                  tone === "blocked"
                    ? "color-mix(in srgb, var(--blocked) 45%, transparent)"
                    : "var(--rule)",
              }}
            >
              <div
                className="l-machine mb-1.5 text-[11px] tracking-[0.12em] uppercase"
                style={{ color: TONE_VAR[tone as RunState["tone"]] }}
              >
                {String(i + 1).padStart(2, "0")} · {agent}
              </div>
              <p className="text-[13px] leading-[1.6]" style={{ color: "var(--muted)" }}>
                {detail}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
