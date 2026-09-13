"use client";

import type { CSSProperties } from "react";

import { useRevealRoot } from "@/lib/motion";
import SqlLine from "./SqlLine";

// Verdict strings are the real ones returned by SQLGuardrail in core/security.py.
const ATTEMPTS = [
  {
    sql: "DROP TABLE Sales_Agent;",
    verdict: "Security Violation: Query contains prohibited keyword 'DROP'.",
    blocked: true,
  },
  {
    sql: "SELECT * FROM Sales_Agent; DELETE FROM Sales_Agent;",
    verdict: "Stacked queries with semicolons are not allowed for security.",
    blocked: true,
  },
  {
    sql: "SELECT month, AVG(profit) FROM Sales_Agent GROUP BY month;",
    verdict: "Query verified safe and read-only.",
    blocked: false,
  },
];

export default function Guardrail() {
  const ref = useRevealRoot<HTMLElement>();

  return (
    <section
      id="guardrail"
      ref={ref}
      data-stage="3"
      className="mx-auto max-w-6xl px-6 py-28 md:py-36"
    >
      <p className="l-eyebrow l-reveal mb-6">The wall</p>

      <h2 className="l-h2 l-reveal max-w-2xl" style={{ color: "var(--paper)" }}>
        It can&rsquo;t write to your database.
        <br />
        Not &ldquo;won&rsquo;t&rdquo; — can&rsquo;t.
      </h2>

      <p className="l-body l-reveal mt-6 max-w-xl">
        Every generated query is validated before it reaches SQLite. Only{" "}
        <span className="l-machine" style={{ color: "var(--agent)" }}>SELECT</span> and{" "}
        <span className="l-machine" style={{ color: "var(--agent)" }}>WITH</span>{" "}
        get through. Mutations, DDL, stacked statements and admin pragmas are
        rejected without ever touching the data — and every attempt is written
        to an audit log your admins can read.
      </p>

      <ul className="mt-14 space-y-3">
        {ATTEMPTS.map((attempt, i) => (
          <li
            key={attempt.sql}
            className="l-reveal l-raise flex flex-col gap-3 rounded-xl p-5 md:flex-row md:items-center md:justify-between md:gap-8"
            style={{
              borderColor: attempt.blocked
                ? "color-mix(in srgb, var(--blocked) 35%, transparent)"
                : "color-mix(in srgb, var(--agent) 35%, transparent)",
            }}
          >
            <code className="l-machine overflow-x-auto text-[12.5px] whitespace-nowrap">
              <SqlLine
                sql={attempt.sql}
                tone={attempt.blocked ? "var(--blocked)" : "var(--agent)"}
              />
            </code>

            <div className="flex shrink-0 items-center gap-3">
              <span
                className="l-machine l-float-idle rounded-full px-2.5 py-1 text-[10px] tracking-[0.12em] uppercase"
                style={{
                  color: attempt.blocked ? "var(--blocked)" : "var(--agent)",
                  border: `1px solid ${
                    attempt.blocked
                      ? "color-mix(in srgb, var(--blocked) 45%, transparent)"
                      : "color-mix(in srgb, var(--agent) 45%, transparent)"
                  }`,
                  // Staggered per row so the badges drift out of phase with
                  // each other rather than bobbing in lockstep.
                  "--float-delay": `${i * 0.7}s`,
                } as CSSProperties}
              >
                {attempt.blocked ? "Blocked" : "Allowed"}
              </span>
              <span
                className="l-machine hidden text-[11px] lg:block"
                style={{ color: "var(--muted)" }}
              >
                {attempt.verdict}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <p className="l-machine l-reveal mt-6 text-[11px]" style={{ color: "var(--muted)" }}>
        Blocked keywords: DROP · DELETE · UPDATE · INSERT · ALTER · TRUNCATE ·
        CREATE · ATTACH · DETACH · GRANT · REVOKE · PRAGMA · EXEC
      </p>
    </section>
  );
}
