"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth-context";

const LINKS = [
  { href: "#run", label: "How it runs" },
  { href: "#guardrail", label: "Guardrail" },
  { href: "#architecture", label: "Architecture" },
];

export default function Nav() {
  const { firebaseUser, loading } = useAuth();
  const [lifted, setLifted] = useState(false);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      setLifted(window.scrollY > 24);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
    };
  }, []);

  return (
    <header
      className="fixed inset-x-0 top-0 z-40 transition-colors duration-300"
      style={{
        background: lifted ? "rgba(7, 11, 20, 0.82)" : "transparent",
        backdropFilter: lifted ? "blur(14px)" : "none",
        borderBottom: `1px solid ${lifted ? "var(--rule)" : "transparent"}`,
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span
            className="block h-2 w-2 rounded-full"
            style={{ background: "var(--agent)" }}
          />
          <span className="l-machine text-[13px] font-semibold tracking-[0.2em] uppercase">
            NexusBI
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[13px] transition-colors duration-200 hover:text-[var(--paper)]"
              style={{ color: "var(--muted)" }}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* A marketing page shouldn't bounce a signed-in visitor, so the CTA
            adapts instead of redirecting. Neutral label while auth resolves. */}
        <Link
          href={firebaseUser ? "/chat" : "/login"}
          className="l-machine l-glow-hover rounded-full px-4 py-2 text-[12px] tracking-[0.08em]"
          style={{ background: "var(--paper)", color: "var(--ink)" }}
        >
          {loading ? " " : firebaseUser ? "Open workspace →" : "Sign in"}
        </Link>
      </div>
    </header>
  );
}
