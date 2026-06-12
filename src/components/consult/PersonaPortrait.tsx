import { useState } from "react";
import type { AstrologerPersona } from "../../lib/personas";
import { getPersonaAccent } from "../../lib/personas";

const SIZES = {
  sm: { box: "w-10 h-10 rounded-xl", initials: "text-sm" },
  md: { box: "w-14 h-14 rounded-2xl", initials: "text-lg" },
  lg: { box: "w-24 h-24 rounded-3xl", initials: "text-3xl" },
  xl: { box: "w-32 h-32 rounded-[2.5rem]", initials: "text-4xl" },
} as const;

/** Deterministic PRNG so each guide's sky never reshuffles. */
function seededRandom(seed: string) {
  let s = 0;
  for (let i = 0; i < seed.length; i++) {
    s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

interface SigilScene {
  stars: { x: number; y: number; r: number; o: number }[];
  constellation: { x: number; y: number }[];
  planetAngle: number;
}

const sceneCache = new Map<string, SigilScene>();

/** Each guide owns a small piece of sky: stars + a constellation of their own. */
function getSigilScene(id: string): SigilScene {
  const cached = sceneCache.get(id);
  if (cached) return cached;

  const rand = seededRandom(id);
  const stars = Array.from({ length: 16 }, () => ({
    x: 4 + rand() * 92,
    y: 4 + rand() * 92,
    r: 0.5 + rand() * 1.1,
    o: 0.25 + rand() * 0.6,
  }));
  const pointCount = 5 + Math.floor(rand() * 3);
  const constellation = Array.from({ length: pointCount }, (_, i) => {
    const angle =
      (i / pointCount) * Math.PI * 2 + rand() * 1.1 + (rand() > 0.5 ? 0.4 : 0);
    const radius = 18 + rand() * 22;
    return {
      x: 50 + Math.cos(angle) * radius,
      y: 46 + Math.sin(angle) * radius * 0.85,
    };
  });
  const scene = { stars, constellation, planetAngle: rand() * Math.PI * 2 };
  sceneCache.set(id, scene);
  return scene;
}

/**
 * Guide portrait. Prefers hand-placed artwork at /assets/guides/{id}.png —
 * drop a file there AND add the id to GUIDES_WITH_ARTWORK below. Otherwise
 * renders the guide's generative celestial sigil — a unique seeded
 * constellation in their signature color, with serif initials.
 */
const GUIDES_WITH_ARTWORK = new Set<string>([
  // e.g. "guru-vidyanath" once /assets/guides/guru-vidyanath.png exists
]);

export function PersonaPortrait({
  persona,
  size = "md",
}: {
  persona: AstrologerPersona;
  size?: keyof typeof SIZES;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const accent = getPersonaAccent(persona.id);
  const s = SIZES[size];
  const scene = getSigilScene(persona.id);
  const planetX = 50 + Math.cos(scene.planetAngle) * 41;
  const planetY = 50 + Math.sin(scene.planetAngle) * 41 * 0.92;

  if (GUIDES_WITH_ARTWORK.has(persona.id) && !imageFailed) {
    return (
      <div
        className={`${s.box} relative shrink-0 overflow-hidden border flex items-center justify-center select-none`}
        style={{ borderColor: `${accent}3a`, background: "#06060c" }}
      >
        <img
          src={`/assets/guides/${persona.id}.png`}
          alt={persona.name}
          className="w-full h-full object-cover"
          onError={() => setImageFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`${s.box} relative shrink-0 overflow-hidden border flex items-center justify-center select-none`}
      style={{ borderColor: `${accent}3a` }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
        <defs>
          <radialGradient
            id={`sigil-bg-${persona.id}`}
            cx="32%"
            cy="26%"
            r="90%"
          >
            <stop offset="0%" stopColor={accent} stopOpacity="0.26" />
            <stop offset="45%" stopColor={accent} stopOpacity="0.1" />
            <stop offset="100%" stopColor="#05050b" />
          </radialGradient>
        </defs>
        <rect width="100" height="100" fill={`url(#sigil-bg-${persona.id})`} />

        {/* this guide's sky */}
        {scene.stars.map((star, i) => (
          <circle
            key={i}
            cx={star.x}
            cy={star.y}
            r={star.r}
            fill="#ffffff"
            opacity={star.o * 0.7}
          />
        ))}

        {/* their constellation */}
        <polyline
          points={scene.constellation.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke={accent}
          strokeWidth="0.6"
          opacity="0.5"
        />
        {scene.constellation.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="1.5"
            fill={accent}
            opacity="0.9"
          />
        ))}

        {/* orbit + wandering planet */}
        <ellipse
          cx="50"
          cy="50"
          rx="41"
          ry="37.5"
          fill="none"
          stroke={accent}
          strokeWidth="0.4"
          opacity="0.3"
        />
        <circle
          cx={planetX}
          cy={planetY}
          r="2.2"
          fill={accent}
          opacity="0.95"
        />
      </svg>

      <span
        className={`${s.initials} font-display italic leading-none relative`}
        style={{ color: accent, textShadow: `0 0 14px ${accent}66` }}
      >
        {persona.avatar}
      </span>
    </div>
  );
}
