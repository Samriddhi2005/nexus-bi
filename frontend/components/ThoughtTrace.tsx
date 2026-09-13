"use client";

import { useState } from "react";

import type { ThoughtStep } from "@/lib/types";

export default function ThoughtTrace({ steps }: { steps: ThoughtStep[] }) {
  const [open, setOpen] = useState(false);

  if (!steps.length) return null;

  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="l-machine text-[11px] tracking-[0.08em] uppercase transition-colors duration-150"
        style={{ color: "var(--agent)" }}
      >
        {open ? "▾" : "▸"} Agent reasoning trace ({steps.length})
      </button>
      {open && (
        <div className="mt-2">
          {steps.map((step, i) => (
            <div key={i} className="thought-item">
              <span
                className="l-machine inline-block rounded-full px-2 py-0.5 text-[10px] tracking-[0.08em] uppercase"
                style={{
                  color: "var(--agent)",
                  background: "color-mix(in srgb, var(--agent) 12%, transparent)",
                }}
              >
                {step.agent || "Agent"}
              </span>
              <div className="l-machine mt-1.5 text-[12.5px] leading-[1.6]">{step.thought}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
