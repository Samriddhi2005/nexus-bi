"use client";

import { useEffect, useRef } from "react";

import { useParallaxLayer, usePrefersReducedMotion } from "@/lib/motion";

interface FieldNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  pulse: number;
  pulseSpeed: number;
}

const AGENT_RGB = "91, 140, 255"; // var(--agent), #5b8cff — the machine's colour, ambient
const LINK_DIST = 150;
const MAX_NODES = 46;
const REPEL_RADIUS = 130;
const REPEL_STRENGTH = 1.6;

/**
 * The ambient background: agents as a live, drifting network of nodes and
 * the connections between them — the multi-agent thesis rendered as texture
 * rather than told. Canvas + rAF, no library. A `fixed` full-viewport plane,
 * so it reads as a living backdrop rather than content that scrolls away.
 */
export default function NeuralField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = usePrefersReducedMotion();
  const wrapRef = useParallaxLayer<HTMLDivElement>(0.06);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;
    let nodes: FieldNode[] = [];
    let frameId = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Pointer in viewport coordinates, which line up with canvas-local space
    // since this canvas is a fixed full-viewport plane. Starts off-screen so
    // repulsion is inert until the pointer actually moves.
    const pointer = { x: -9999, y: -9999 };

    const seed = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const density = Math.round((width * height) / 32000);
      const count = Math.min(Math.max(density, 20), MAX_NODES);
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.14,
        vy: (Math.random() - 0.5) * 0.14,
        r: 1 + Math.random() * 1.3,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.006 + Math.random() * 0.01,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;

        // Antigravity-style cursor repulsion: a per-frame positional nudge
        // away from the pointer, proportional to closeness. It isn't stored
        // in velocity, so it can't accumulate — the push simply stops once
        // the pointer moves away.
        const dxP = n.x - pointer.x;
        const dyP = n.y - pointer.y;
        const distP = Math.sqrt(dxP * dxP + dyP * dyP);
        if (distP < REPEL_RADIUS && distP > 0.01) {
          const force = (1 - distP / REPEL_RADIUS) * REPEL_STRENGTH;
          n.x += (dxP / distP) * force;
          n.y += (dyP / distP) * force;
        }

        if (n.x < -20) n.x = width + 20;
        else if (n.x > width + 20) n.x = -20;
        if (n.y < -20) n.y = height + 20;
        else if (n.y > height + 20) n.y = -20;
        n.pulse += n.pulseSpeed;
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist >= LINK_DIST) continue;
          ctx.strokeStyle = `rgba(${AGENT_RGB}, ${(1 - dist / LINK_DIST) * 0.14})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      for (const n of nodes) {
        const glow = 0.45 + Math.sin(n.pulse) * 0.3;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${AGENT_RGB}, ${0.3 + glow * 0.25})`;
        ctx.fill();
      }
    };

    const loop = () => {
      draw();
      frameId = requestAnimationFrame(loop);
    };

    seed();
    draw(); // one frame is always drawn, even under reduced motion

    if (!reduced) frameId = requestAnimationFrame(loop);

    const handleResize = () => seed();
    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frameId);
      } else if (!reduced) {
        frameId = requestAnimationFrame(loop);
      }
    };
    const handlePointerMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    };
    const handlePointerLeave = () => {
      pointer.x = -9999;
      pointer.y = -9999;
    };

    window.addEventListener("resize", handleResize);
    document.addEventListener("visibilitychange", handleVisibility);
    // Not reduced-motion-gated: a one-time positional nudge on move is a
    // response to input, not an ambient animation loop.
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [reduced]);

  return (
    <div ref={wrapRef} aria-hidden="true" className="fixed inset-0 -z-20">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
