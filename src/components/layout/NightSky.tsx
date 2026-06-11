import React, { useMemo } from "react";

/** Deterministic star positions so the sky never reshuffles between renders. */
function starShadows(count: number, seed: number, spread = 2200): string {
  let s = seed;
  const rand = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  return Array.from({ length: count }, () => {
    const x = Math.round(rand() * spread);
    const y = Math.round(rand() * spread);
    const alpha = (0.1 + rand() * 0.45).toFixed(2);
    return `${x}px ${y}px rgba(255,255,255,${alpha})`;
  }).join(",");
}

/**
 * Fixed full-viewport backdrop: a quiet, deterministic star field with two
 * faint auroras. Render once per page, behind everything.
 */
export const NightSky: React.FC = () => {
  const small = useMemo(() => starShadows(110, 7), []);
  const bright = useMemo(() => starShadows(30, 23), []);
  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="absolute top-0 left-0 w-px h-px rounded-full"
        style={{ boxShadow: small }}
      />
      <div
        className="absolute top-0 left-0 w-[1.5px] h-[1.5px] rounded-full"
        style={{ boxShadow: bright }}
      />
      <div className="absolute -top-32 right-[15%] w-[36vw] h-[36vw] bg-violet-600/4 blur-[120px] rounded-full" />
      <div className="absolute top-[20%] -left-32 w-[28vw] h-[28vw] bg-gold/3 blur-[120px] rounded-full" />
    </div>
  );
};
