"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { usePrefersReducedMotion } from "@/lib/motion";
import SqlLine from "./SqlLine";

const QUESTION = "Which months came in below average?";
const SQL = `SELECT month, profit FROM Sales_Agent
WHERE profit < (SELECT AVG(profit) FROM Sales_Agent)
ORDER BY date;`;

function useTypewriter(text: string, start: boolean, speed: number, skip: boolean) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!start || skip) return;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [start, text, speed, skip]);

  // Reduced motion resolves to the finished string by derivation rather than
  // by pushing state from an effect.
  if (skip) return { shown: text, done: true };
  return { shown: text.slice(0, count), done: count >= text.length };
}

/**
 * Renders the typed portion followed by the remainder at zero opacity. The
 * full string therefore exists in the server-rendered HTML — so the headline
 * is visible to crawlers and read whole by screen readers — and the block
 * never changes height, so nothing shifts while it types.
 */
function Typed({ full, shown, caret }: { full: string; shown: string; caret: boolean }) {
  return (
    <>
      {shown}
      {caret && <span className="l-caret-inline" aria-hidden="true" />}
      <span style={{ opacity: 0 }}>{full.slice(shown.length)}</span>
    </>
  );
}

export default function Hero() {
  const reduced = usePrefersReducedMotion();
  const [sequenced, setSequenced] = useState(0);

  // Reduced motion jumps straight to the resting state; derived, so the effect
  // below never has to push state to represent it.
  const step = reduced ? 4 : sequenced;

  // One orchestrated page-load sequence. Everything after the hero is quieter.
  useEffect(() => {
    if (reduced) return;
    const timers = [
      setTimeout(() => setSequenced(1), 260),
      setTimeout(() => setSequenced(2), 1750),
      setTimeout(() => setSequenced(3), 3550),
      setTimeout(() => setSequenced(4), 4050),
    ];
    return () => timers.forEach(clearTimeout);
  }, [reduced]);

  const question = useTypewriter(QUESTION, step >= 1, 34, reduced);
  const sql = useTypewriter(SQL, step >= 2, 12, reduced);

  return (
    <section
      data-stage="0"
      className="relative mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-center overflow-hidden px-6 pt-28 pb-20"
    >
      {/* Ambient depth behind the hero only — the two semantic hues, slow and
          soft, so it reads as atmosphere rather than decoration. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="l-orb-agent" style={{ top: "-10%", left: "-8%", width: "38vw", height: "38vw" }} />
        <div className="l-orb-answer" style={{ bottom: "-16%", right: "-6%", width: "30vw", height: "30vw" }} />
      </div>

      <p className="l-eyebrow mb-8">Autonomous multi-agent BI</p>

      {/* The human voice. */}
      <h1 className="l-ask max-w-3xl" style={{ color: "var(--paper)" }}>
        &ldquo;
        <Typed
          full={QUESTION}
          shown={question.shown}
          caret={step === 1 && !question.done}
        />
        &rdquo;
      </h1>

      {/* The translation marker: where the human sentence becomes machine. */}
      <div
        className="mt-8 mb-5 flex items-center gap-3 transition-opacity duration-500"
        style={{ opacity: step >= 2 ? 1 : 0 }}
      >
        <span
          className="l-machine text-[11px] tracking-[0.14em] uppercase"
          style={{ color: "var(--agent)" }}
        >
          planner → sql engineer
        </span>
        <span className="h-px flex-1" style={{ background: "var(--rule)" }} />
      </div>

      {/* The machine voice. */}
      <pre
        className="l-machine overflow-x-auto text-[clamp(0.8rem,1.55vw,1.05rem)] leading-[1.75] transition-opacity duration-300"
        style={{ opacity: step >= 2 ? 1 : 0, color: "var(--paper)" }}
      >
        <code>
          <SqlLine sql={sql.shown} />
          {step === 2 && !sql.done && <span className="l-caret-inline" aria-hidden="true" />}
          <span style={{ opacity: 0 }}>{SQL.slice(sql.shown.length)}</span>
        </code>
      </pre>

      {/* Verdict + cost, stamped once the guardrail clears it. */}
      <div
        className="mt-7 flex flex-wrap items-center gap-3"
        style={{ visibility: step >= 3 ? "visible" : "hidden" }}
      >
        <span
          className={`l-machine rounded-full px-3 py-1.5 text-[11px] tracking-[0.12em] uppercase ${
            step >= 3 ? "l-stamp-float" : ""
          }`}
          style={{
            color: "var(--agent)",
            border: "1px solid color-mix(in srgb, var(--agent) 40%, transparent)",
            background: "color-mix(in srgb, var(--agent) 10%, transparent)",
          }}
        >
          Read-only · verified
        </span>
        <span className="l-machine text-[11px]" style={{ color: "var(--muted)" }}>
          3 rows · 1.8s · 0 retries
        </span>
      </div>

      {/* The answer — the only place amber appears in this section. */}
      <div
        className="mt-10 max-w-2xl"
        style={{
          opacity: step >= 4 ? 1 : 0,
          transform: step >= 4 ? "none" : "translateY(14px)",
          transition: "opacity .7s cubic-bezier(.16,1,.3,1), transform .7s cubic-bezier(.16,1,.3,1)",
        }}
      >
        <p
          className="border-l-2 pl-5 text-[clamp(1rem,1.5vw,1.2rem)] leading-[1.6]"
          style={{ borderColor: "var(--answer)", color: "var(--paper)" }}
        >
          January, February and April all landed under the{" "}
          <span style={{ color: "var(--answer)" }}>$65,000</span> seven-month
          average. January is the outlier at{" "}
          <span style={{ color: "var(--answer)" }}>$40,000</span> — 38% below the
          line.
        </p>
      </div>

      <div className="mt-12 flex flex-wrap items-center gap-3">
        <Link
          href="/login"
          className="l-machine l-glow-hover rounded-full px-6 py-3 text-[13px] tracking-[0.06em]"
          style={{ background: "var(--paper)", color: "var(--ink)" }}
        >
          Start asking →
        </Link>
        <a
          href="#run"
          className="l-machine rounded-full px-6 py-3 text-[13px] tracking-[0.06em] transition-colors duration-200"
          style={{ border: "1px solid var(--rule)", color: "var(--muted)" }}
        >
          Watch it repair a query
        </a>
      </div>
    </section>
  );
}
