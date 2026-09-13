"use client";

import Link from "next/link";

import { useAuth } from "@/lib/auth-context";
import { useRevealRoot } from "@/lib/motion";

export default function CTA() {
  const ref = useRevealRoot<HTMLElement>();
  const { firebaseUser } = useAuth();

  return (
    <section ref={ref} className="mx-auto max-w-6xl px-6 pt-20 pb-28">
      <div className="l-reveal l-raise rounded-2xl px-6 py-16 text-center md:px-16 md:py-24">
        <p className="l-eyebrow mb-6">Your turn</p>

        <h2 className="l-ask mx-auto max-w-2xl" style={{ color: "var(--paper)" }}>
          What will you ask first?
        </h2>

        {/* Bookends the hero: the page opened on a question and closes on yours. */}
        <Link
          href={firebaseUser ? "/chat" : "/login"}
          className="l-glow-hover mx-auto mt-10 flex max-w-xl items-center gap-3 rounded-full px-5 py-4"
          style={{ border: "1px solid var(--rule)", background: "var(--ink)" }}
        >
          <span className="l-machine flex-1 text-left text-[13px]" style={{ color: "var(--muted)" }}>
            Ask a business question about your data…
          </span>
          <span
            className="l-machine rounded-full px-4 py-2 text-[12px] tracking-[0.06em]"
            style={{ background: "var(--paper)", color: "var(--ink)" }}
          >
            {firebaseUser ? "Open workspace →" : "Start free →"}
          </span>
        </Link>

        <p className="l-machine mt-8 text-[11px]" style={{ color: "var(--muted)" }}>
          Bring a CSV or Excel file · read-only by construction · your data stays
          in your own database
        </p>
      </div>

      <footer
        className="mt-16 flex flex-col items-center justify-between gap-4 pt-8 sm:flex-row"
        style={{ borderTop: "1px solid var(--rule)" }}
      >
        <div className="flex items-center gap-2.5">
          <span className="block h-1.5 w-1.5 rounded-full" style={{ background: "var(--agent)" }} />
          <span className="l-machine text-[12px] tracking-[0.18em] uppercase" style={{ color: "var(--muted)" }}>
            NexusBI
          </span>
        </div>
        <p className="l-machine text-[11px]" style={{ color: "var(--muted)" }}>
          LangGraph · FastAPI · Next.js · Firebase
        </p>
      </footer>
    </section>
  );
}
