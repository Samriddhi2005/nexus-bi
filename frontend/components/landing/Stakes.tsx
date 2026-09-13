"use client";

import { useRevealRoot } from "@/lib/motion";

const SLOW_PATH = ["Question", "Ticket", "Analyst queue", "SQL", "Chart", "Answer"];
const FAST_PATH = ["Question", "Answer"];

function Hop({ label, tone, dim }: { label: string; tone: string; dim?: boolean }) {
  return (
    <span
      className="l-machine rounded-full px-3 py-1.5 text-[11px] whitespace-nowrap"
      style={{
        border: `1px solid ${dim ? "var(--rule)" : tone}`,
        color: dim ? "var(--muted)" : tone,
      }}
    >
      {label}
    </span>
  );
}

export default function Stakes() {
  const ref = useRevealRoot<HTMLElement>();

  return (
    <section
      ref={ref}
      data-stage="1"
      className="mx-auto max-w-6xl px-6 py-28 md:py-36"
    >
      <p className="l-eyebrow l-reveal mb-6">The gap</p>

      <h2 className="l-h2 l-reveal max-w-2xl" style={{ color: "var(--paper)" }}>
        Your data team has a queue.
        <br />
        Your decision doesn&rsquo;t.
      </h2>

      <p className="l-body l-reveal mt-6 max-w-xl">
        The question is never the hard part. The wait is — every hop between
        asking and knowing is a place the answer goes stale.
      </p>

      <div className="mt-16 space-y-10">
        <div className="l-reveal">
          <div className="mb-4 flex items-baseline gap-3">
            <span className="l-machine text-[11px] tracking-[0.14em] uppercase" style={{ color: "var(--muted)" }}>
              Today
            </span>
            <span className="h-px flex-1" style={{ background: "var(--rule)" }} />
            <span className="l-machine text-[12px]" style={{ color: "var(--muted)" }}>
              ~3 days
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
            {SLOW_PATH.map((hop, i) => (
              <span key={hop} className="flex items-center gap-2">
                <Hop label={hop} tone="var(--muted)" dim />
                {i < SLOW_PATH.length - 1 && (
                  <span style={{ color: "var(--rule)" }}>—</span>
                )}
              </span>
            ))}
          </div>
        </div>

        <div className="l-reveal">
          <div className="mb-4 flex items-baseline gap-3">
            <span
              className="l-machine text-[11px] tracking-[0.14em] uppercase"
              style={{ color: "var(--agent)" }}
            >
              With NexusBI
            </span>
            <span className="h-px flex-1" style={{ background: "var(--rule)" }} />
            <span className="l-machine text-[12px]" style={{ color: "var(--agent)" }}>
              1.8s
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
            {FAST_PATH.map((hop, i) => (
              <span key={hop} className="flex items-center gap-2">
                <Hop label={hop} tone="var(--agent)" />
                {i < FAST_PATH.length - 1 && (
                  <span style={{ color: "var(--agent)" }}>—</span>
                )}
              </span>
            ))}
            <span className="l-machine ml-2 text-[11px]" style={{ color: "var(--muted)" }}>
              the four hops in between became agents
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
