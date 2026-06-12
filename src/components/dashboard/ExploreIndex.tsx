import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Compass,
  Flame,
  Heart,
  ScrollText,
  Sparkles,
  Sun,
} from "lucide-react";
import { SPACES, getSpacePrimaryPath, type Space } from "../../lib/spaces";

const SPACE_ICONS: Record<Space["id"], React.ReactNode> = {
  today: <Sun size={15} />,
  guidance: <Sparkles size={15} />,
  chart: <ScrollText size={15} />,
  bonds: <Heart size={15} />,
  path: <Flame size={15} />,
};

/**
 * The five spaces as a table of contents — each entry is a question the app
 * answers, derived from the same definition that drives the header nav.
 */
export const ExploreIndex: React.FC = () => {
  const navigate = useNavigate();

  return (
    <nav
      aria-label="Explore AstroYou"
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 border-t border-l border-white/8 animate-reveal-progressive"
    >
      {SPACES.map((space, i) => (
        <button
          key={space.id}
          onClick={() => navigate(getSpacePrimaryPath(space))}
          className="group relative text-left px-5 py-4 border-b border-r border-white/8 hover:bg-white/3.5 transition-colors duration-300"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="font-display italic text-white/25 text-sm group-hover:text-gold/70 transition-colors">
              {String(i + 1).padStart(2, "0")}
            </span>
            <ArrowUpRight
              size={13}
              className="text-white/0 group-hover:text-gold transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </div>
          <div className="mt-2 flex items-center gap-2 text-white/80 group-hover:text-white transition-colors">
            <span className="text-gold/70">{SPACE_ICONS[space.id]}</span>
            <span className="text-sm font-medium">{space.label}</span>
          </div>
          <p className="mt-1 text-xs text-white/30 italic font-display">
            {space.question}
          </p>
          <p className="mt-1.5 text-[0.6rem] uppercase tracking-[0.15em] text-white/20 truncate">
            {space.pages.map((p) => p.label).join(" · ")}
          </p>
        </button>
      ))}

      {/* sixth cell: the wandering door */}
      <button
        onClick={() => navigate("/astromap")}
        className="group relative text-left px-5 py-4 border-b border-r border-white/8 hover:bg-white/3.5 transition-colors duration-300"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="font-display italic text-white/25 text-sm group-hover:text-gold/70 transition-colors">
            06
          </span>
          <ArrowUpRight
            size={13}
            className="text-white/0 group-hover:text-gold transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </div>
        <div className="mt-2 flex items-center gap-2 text-white/80 group-hover:text-white transition-colors">
          <span className="text-gold/70">
            <Compass size={15} />
          </span>
          <span className="text-sm font-medium">Astro Map</span>
        </div>
        <p className="mt-1 text-xs text-white/30 italic font-display">
          Where in the world favours you?
        </p>
        <p className="mt-1.5 text-[0.6rem] uppercase tracking-[0.15em] text-white/20">
          Relocation lines
        </p>
      </button>
    </nav>
  );
};
