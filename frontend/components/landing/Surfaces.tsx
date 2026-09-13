"use client";

import { useEffect, useState } from "react";

import { usePrefersReducedMotion, useRevealRoot } from "@/lib/motion";
import SqlLine from "./SqlLine";

const TABS = ["Insights", "Chart", "Raw data", "SQL inspector"] as const;

const MONTHS = [
  { label: "JAN", profit: 40000, below: true },
  { label: "FEB", profit: 60000, below: true },
  { label: "MAR", profit: 75000, below: false },
  { label: "APR", profit: 60000, below: true },
  { label: "MAY", profit: 70000, below: false },
  { label: "JUN", profit: 70000, below: false },
  { label: "JUL", profit: 80000, below: false },
];

const MAX = 80000;
const AVG = 65000;
const BAR_W = 36;
const GAP = 16;
const BASE_Y = 150;
const MAX_H = 110;

function ProfitChart() {
  const startX = (420 - (MONTHS.length * BAR_W + (MONTHS.length - 1) * GAP)) / 2;
  const avgY = BASE_Y - (AVG / MAX) * MAX_H;

  return (
    <figure className="m-0">
      <svg
        viewBox="0 0 420 180"
        role="img"
        aria-label="Monthly profit for January through July 2024. January, February and April fall below the 65,000 average; March, May, June and July sit above it."
        className="w-full"
        style={{ maxWidth: "100%", height: "auto" }}
      >
        {MONTHS.map((m, i) => {
          const h = (m.profit / MAX) * MAX_H;
          const x = startX + i * (BAR_W + GAP);
          return (
            <g key={m.label}>
              <rect
                x={x}
                y={BASE_Y - h}
                width={BAR_W}
                height={h}
                rx={3}
                style={{
                  fill: m.below
                    ? "var(--answer)"
                    : "color-mix(in srgb, var(--agent) 32%, transparent)",
                }}
              />
              <text
                x={x + BAR_W / 2}
                y={166}
                textAnchor="middle"
                className="l-machine"
                style={{ fill: "var(--muted)", fontSize: 9, letterSpacing: "0.08em" }}
              >
                {m.label}
              </text>
            </g>
          );
        })}

        {/* The average is the mechanism the question turns on, so it's drawn. */}
        <line
          x1={startX - 10}
          y1={avgY}
          x2={420 - startX + 10}
          y2={avgY}
          style={{ stroke: "var(--paper)", strokeWidth: 1, strokeDasharray: "4 4", opacity: 0.55 }}
        />
        <text
          x={420 - startX + 12}
          y={avgY - 5}
          textAnchor="end"
          className="l-machine"
          style={{ fill: "var(--paper)", fontSize: 9.5, opacity: 0.7 }}
        >
          avg $65,000
        </text>
      </svg>
      <figcaption className="l-machine mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
        Amber bars are the three months the query returned.
      </figcaption>
    </figure>
  );
}

function RawTable() {
  const rows = [
    ["January", "40000"],
    ["February", "60000"],
    ["April", "60000"],
  ];
  return (
    <table className="l-machine w-full text-left text-[12.5px]">
      <thead>
        <tr>
          {["month", "profit"].map((h) => (
            <th
              key={h}
              className="pb-2 text-[10px] tracking-[0.14em] uppercase"
              style={{ color: "var(--muted)", borderBottom: "1px solid var(--rule)" }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(([month, profit]) => (
          <tr key={month}>
            <td className="py-2" style={{ color: "var(--paper)", borderBottom: "1px solid var(--rule)" }}>
              {month}
            </td>
            <td className="py-2" style={{ color: "var(--answer)", borderBottom: "1px solid var(--rule)" }}>
              {profit}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Surfaces() {
  const ref = useRevealRoot<HTMLElement>();
  const reduced = usePrefersReducedMotion();
  const [tab, setTab] = useState(0);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (pinned || reduced) return;
    const id = setInterval(() => setTab((t) => (t + 1) % TABS.length), 4200);
    return () => clearInterval(id);
  }, [pinned, reduced]);

  return (
    <section ref={ref} data-stage="4" className="mx-auto max-w-6xl px-6 py-28 md:py-36">
      <p className="l-eyebrow l-reveal mb-6">What comes back</p>

      <h2 className="l-h2 l-reveal max-w-2xl" style={{ color: "var(--paper)" }}>
        An answer you can check.
      </h2>

      <p className="l-body l-reveal mt-6 max-w-xl">
        Four views of the same run. The prose is for the meeting; the SQL is for
        whoever asks where the number came from.
      </p>

      {/* Glass is reserved for product-UI mockups, so the marketing surface and
          the app surface stay visually distinguishable. */}
      <div className="l-reveal glass-panel mt-12 overflow-hidden">
        <div
          className="flex flex-wrap gap-1 p-2"
          style={{ borderBottom: "1px solid var(--rule)" }}
        >
          {TABS.map((label, i) => (
            <button
              key={label}
              onClick={() => {
                setTab(i);
                setPinned(true);
              }}
              className="l-machine rounded-lg px-3.5 py-2 text-[11px] tracking-[0.08em] transition-colors duration-200"
              style={{
                background: tab === i ? "color-mix(in srgb, var(--agent) 16%, transparent)" : "transparent",
                color: tab === i ? "var(--agent)" : "var(--muted)",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-[260px] p-6 md:p-8">
          {tab === 0 && (
            <div className="max-w-2xl">
              <p
                className="border-l-2 pl-5 text-[15px] leading-[1.65]"
                style={{ borderColor: "var(--answer)", color: "var(--paper)" }}
              >
                Three of seven months closed below the $65,000 average — January
                ($40,000), February ($60,000) and April ($60,000). January alone
                accounts for most of the shortfall at 38% under the line, and it
                is the only month where expenses climbed while sales fell.
              </p>
              <p className="l-body mt-5">
                <span className="l-machine text-[11px] tracking-[0.12em] uppercase" style={{ color: "var(--muted)" }}>
                  Recommended action ·{" "}
                </span>
                Pull January&rsquo;s expense lines before setting Q4 targets — the
                pattern that produced it hasn&rsquo;t recurred since March.
              </p>
            </div>
          )}

          {tab === 1 && <ProfitChart />}
          {tab === 2 && <RawTable />}

          {tab === 3 && (
            <div>
              <div className="mb-4 flex items-center gap-3">
                <span
                  className="l-machine rounded-full px-3 py-1 text-[10px] tracking-[0.12em] uppercase"
                  style={{
                    color: "var(--agent)",
                    border: "1px solid color-mix(in srgb, var(--agent) 40%, transparent)",
                  }}
                >
                  Read-only · verified
                </span>
                <span className="l-machine text-[11px]" style={{ color: "var(--muted)" }}>
                  executed in 1.8s
                </span>
              </div>
              <pre className="l-machine overflow-x-auto text-[12.5px] leading-[1.8]" style={{ color: "var(--paper)" }}>
                <SqlLine sql={"SELECT month, profit FROM Sales_Agent\nWHERE profit < (SELECT AVG(profit) FROM Sales_Agent)\nORDER BY date;"} />
              </pre>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
