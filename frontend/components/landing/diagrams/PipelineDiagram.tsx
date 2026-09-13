"use client";

import type { NodeState, RunState } from "../TheRun";

const NODE_W = 168;
const NODE_H = 72;
const ROW_Y = 56;
const MID_Y = ROW_Y + NODE_H / 2;

const NODES = [
  { key: "planner", x: 16, title: "PLANNER", sub: "writes SQLite" },
  { key: "guardrail", x: 242, title: "GUARDRAIL", sub: "read-only check" },
  { key: "execute", x: 468, title: "EXECUTE", sub: "runs on SQLite" },
  { key: "synthesize", x: 694, title: "SYNTHESIZE", sub: "→ answer + chart" },
] as const;

function strokeFor(state: NodeState): string {
  if (state === "failed") return "var(--blocked)";
  if (state === "active") return "var(--agent)";
  if (state === "done") return "color-mix(in srgb, var(--agent) 50%, transparent)";
  return "var(--rule)";
}

function textFor(state: NodeState): string {
  if (state === "failed") return "var(--blocked)";
  if (state === "idle") return "var(--muted)";
  return "var(--paper)";
}

export default function PipelineDiagram({ state }: { state: RunState }) {
  const states: Record<string, NodeState> = {
    planner: state.planner,
    guardrail: state.guardrail,
    execute: state.execute,
    synthesize: state.synthesize,
  };

  const edgeTone = (from: NodeState, to: NodeState) =>
    from === "done" && to !== "idle"
      ? "color-mix(in srgb, var(--agent) 55%, transparent)"
      : "var(--rule)";

  return (
    <figure className="m-0">
      <svg
        viewBox="0 0 880 300"
        role="img"
        aria-label="NexusBI agent pipeline: the planner writes SQL, the guardrail allows only read-only queries, the executor runs it; when execution fails the error is routed back to the planner to retry up to three times, and the healed query is then synthesized into an answer."
        className="w-full"
        style={{ maxWidth: "100%", height: "auto", color: "var(--muted)" }}
      >
        <defs>
          <marker id="ar-dim" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <polygon points="0,1 10,5 0,9" style={{ fill: "var(--rule)" }} />
          </marker>
          <marker id="ar-live" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <polygon points="0,1 10,5 0,9" style={{ fill: "var(--agent)" }} />
          </marker>
          <marker id="ar-fail" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <polygon points="0,1 10,5 0,9" style={{ fill: "var(--blocked)" }} />
          </marker>
        </defs>

        {/* Forward edges, each labelled with what actually moves across it. */}
        {[
          { x1: 184, x2: 242, label: "writes SQL", from: states.planner, to: states.guardrail },
          { x1: 410, x2: 468, label: "SELECT only", from: states.guardrail, to: states.execute },
          { x1: 636, x2: 694, label: "3 rows", from: states.execute, to: states.synthesize },
        ].map((edge) => {
          const live = edge.from === "done" && edge.to !== "idle";
          return (
            <g key={edge.label}>
              <line
                x1={edge.x1}
                y1={MID_Y}
                x2={edge.x2 - 8}
                y2={MID_Y}
                markerEnd={live ? "url(#ar-live)" : "url(#ar-dim)"}
                style={{
                  stroke: edgeTone(edge.from, edge.to),
                  strokeWidth: 1.5,
                  transition: "stroke .4s ease",
                }}
              />
              <text
                x={(edge.x1 + edge.x2) / 2}
                y={MID_Y - 12}
                textAnchor="middle"
                className="l-machine"
                style={{
                  fill: live ? "var(--agent)" : "var(--muted)",
                  fontSize: 10,
                  letterSpacing: "0.06em",
                  transition: "fill .4s ease",
                }}
              >
                {edge.label}
              </text>
            </g>
          );
        })}

        {/* Nodes. */}
        {NODES.map((node) => {
          const nodeState = states[node.key];
          return (
            <g key={node.key}>
              <rect
                x={node.x}
                y={ROW_Y}
                width={NODE_W}
                height={NODE_H}
                rx={10}
                className={nodeState === "active" || nodeState === "failed" ? "l-node-live" : undefined}
                style={{
                  fill: "var(--ink-raise)",
                  stroke: strokeFor(nodeState),
                  color: strokeFor(nodeState), // drives currentColor in the .l-node-live glow
                  strokeWidth: nodeState === "active" || nodeState === "failed" ? 2 : 1.25,
                  transition: "stroke .4s ease, stroke-width .4s ease",
                }}
              />
              <text
                x={node.x + NODE_W / 2}
                y={ROW_Y + 30}
                textAnchor="middle"
                className="l-machine"
                style={{
                  fill: textFor(nodeState),
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  transition: "fill .4s ease",
                }}
              >
                {node.title}
              </text>
              <text
                x={node.x + NODE_W / 2}
                y={ROW_Y + 50}
                textAnchor="middle"
                className="l-machine"
                style={{ fill: "var(--muted)", fontSize: 10 }}
              >
                {node.sub}
              </text>
            </g>
          );
        })}

        {/* The retry edge — the one coloured edge, because it's the whole
            argument: a failure here doesn't end the run, it re-enters it. */}
        <path
          d="M 552 128 V 236 H 108 V 136"
          fill="none"
          pathLength={1}
          markerEnd={state.retryDrawn > 0.98 ? "url(#ar-fail)" : undefined}
          style={{
            stroke: "var(--blocked)",
            strokeWidth: 2,
            strokeDasharray: 1,
            strokeDashoffset: 1 - state.retryDrawn,
            opacity: state.retryDrawn > 0 ? 1 : 0,
            transition: "stroke-dashoffset .25s linear, opacity .3s ease",
          }}
        />

        <text
          x={330}
          y={256}
          textAnchor="middle"
          className="l-machine"
          style={{
            fill: "var(--blocked)",
            fontSize: 10.5,
            letterSpacing: "0.06em",
            opacity: state.retryDrawn > 0.15 ? 1 : 0,
            transition: "opacity .3s ease",
          }}
        >
          error routed back · retry ≤ 3
        </text>
        <text
          x={330}
          y={272}
          textAnchor="middle"
          className="l-machine"
          style={{
            fill: "var(--muted)",
            fontSize: 10,
            opacity: state.retryDrawn > 0.15 ? 1 : 0,
            transition: "opacity .3s ease",
          }}
        >
          no such column: proft
        </text>
      </svg>

      <figcaption className="l-machine mt-3 text-[11px]" style={{ color: "var(--muted)" }}>
        A failed query re-enters the graph instead of ending the run — the red
        edge is the loop that makes this agentic rather than a one-shot
        translator.
      </figcaption>
    </figure>
  );
}
