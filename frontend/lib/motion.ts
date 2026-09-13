"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToMotionPreference(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * Reads the OS "reduce motion" setting reactively. useSyncExternalStore keeps
 * this out of an effect, so there's no setState-in-effect cascade and SSR gets
 * a stable `false` snapshot.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToMotionPreference,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}

/**
 * Attach to a section; every descendant carrying `.l-reveal` fades up as it
 * enters the viewport, staggered by document order. Mutates the DOM directly
 * rather than holding state, so a reveal never re-renders the tree.
 */
export function useRevealRoot<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const items = Array.from(root.querySelectorAll<HTMLElement>(".l-reveal"));
    if (!items.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          el.style.transitionDelay = `${(items.indexOf(el) % 6) * 60}ms`;
          el.dataset.shown = "true";
          observer.unobserve(el);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );

    items.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return ref;
}

/**
 * Maps a tall section's scroll range onto 0..1 for scroll-scrubbed sequences.
 * The initial measurement is deferred into rAF so the effect never calls
 * setState synchronously.
 */
export function useScrollProgress<T extends HTMLElement>(): [
  React.RefObject<T | null>,
  number,
] {
  const ref = useRef<T | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frame = 0;

    const measure = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      if (travel <= 0) {
        setProgress(rect.top <= 0 ? 1 : 0);
        return;
      }
      setProgress(Math.min(1, Math.max(0, -rect.top / travel)));
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return [ref, progress];
}

/**
 * Magnetic tilt: the element rotates slightly toward the pointer within its
 * own bounds and springs back on leave — the "elements respond to cursor
 * movement" mechanic, done as a CSS 3D transform rather than a canvas/3D
 * library. `strength` is the max rotation in degrees.
 */
export function useTilt<T extends HTMLElement>(strength = 7) {
  const ref = useRef<T | null>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;

    const handleMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      el.style.transform = `perspective(900px) rotateX(${(-py * strength).toFixed(2)}deg) rotateY(${(px * strength).toFixed(2)}deg)`;
    };

    const reset = () => {
      el.style.transform = "";
    };

    el.addEventListener("pointermove", handleMove);
    el.addEventListener("pointerleave", reset);
    return () => {
      el.removeEventListener("pointermove", handleMove);
      el.removeEventListener("pointerleave", reset);
    };
  }, [strength, reduced]);

  return ref;
}

/**
 * Depth layer for a `position: fixed` plane. A fixed element doesn't move on
 * scroll, so translating it by `-scrollY * speed` makes it drift at that
 * fraction of the page's rate — 0.15 reads as "far behind the content".
 * Writes the transform straight to the node so scrolling stays off React's
 * render path.
 */
export function useParallaxLayer<T extends HTMLElement>(speed: number) {
  const ref = useRef<T | null>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (reduced) {
      el.style.transform = "";
      return;
    }

    let frame = 0;

    const apply = () => {
      frame = 0;
      const shift = -window.scrollY * speed;
      el.style.transform = `translate3d(0, ${shift.toFixed(2)}px, 0)`;
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [speed, reduced]);

  return ref;
}
