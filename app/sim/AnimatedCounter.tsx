"use client";

import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "./hooks/usePrefersReducedMotion";

export function AnimatedCounter({ to, from = 0 }: { to: number; from?: number }) {
  const [value, setValue] = useState(from);
  const reducedMotion = usePrefersReducedMotion();
  useEffect(() => {
    if (reducedMotion || to === from) { setValue(to); return; }
    const duration = 1500;
    const start = performance.now();
    let rafId: number;
    function tick() {
      const elapsed = performance.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + eased * (to - from)));
      if (progress < 1) rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [to, from, reducedMotion]);
  return <>{value}</>;
}
