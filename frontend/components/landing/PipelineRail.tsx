"use client";

import { useEffect, useState } from "react";

// One marker per section, labelled with what that section actually covers —
// an index of the page, not decorative numbering.
const STAGES = ["ask", "gap", "run", "guard", "result"];

export default function PipelineRail() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>("[data-stage]"),
    );
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const stage = Number((visible.target as HTMLElement).dataset.stage);
        if (!Number.isNaN(stage)) setActive(stage);
      },
      { threshold: [0.25, 0.5, 0.75], rootMargin: "-20% 0px -20% 0px" },
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed top-1/2 left-5 z-30 hidden -translate-y-1/2 flex-col items-center gap-4 xl:flex"
    >
      <div className="relative h-px w-px">
        <div
          className="absolute top-0 left-0 w-px"
          style={{ background: "var(--rule)", height: `${STAGES.length * 44}px` }}
        />
        <div
          className="absolute top-0 left-0 w-px transition-[height] duration-700 ease-out"
          style={{
            background: "var(--agent)",
            height: `${(active + 1) * 44}px`,
          }}
        />
      </div>

      <ul className="absolute top-0 left-0 flex flex-col">
        {STAGES.map((stage, i) => (
          <li key={stage} className="flex h-11 items-center gap-3">
            <span
              className={`block h-[5px] w-[5px] rounded-full transition-colors duration-500 ${
                i === active ? "l-pulse-dot" : ""
              }`}
              style={{
                background: i <= active ? "var(--agent)" : "var(--rule)",
                marginLeft: "-2px",
              }}
            />
            <span
              className="l-machine text-[10px] tracking-[0.16em] uppercase transition-colors duration-500"
              style={{ color: i === active ? "var(--agent)" : "var(--muted)" }}
            >
              {stage}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
