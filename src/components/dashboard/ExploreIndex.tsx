import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Compass,
  Download,
  Gift,
  Heart,
  Sun,
  Users,
} from "lucide-react";

interface Destination {
  index: string;
  icon: React.ReactNode;
  label: string;
  note: string;
  route: string;
}

const DESTINATIONS: Destination[] = [
  {
    index: "01",
    icon: <Sun size={15} />,
    label: "Daily Forecast",
    note: "Today, this week, this year",
    route: "/forecast",
  },
  {
    index: "02",
    icon: <Compass size={15} />,
    label: "Transit Oracle",
    note: "The sky over your chart",
    route: "/transit",
  },
  {
    index: "03",
    icon: <Heart size={15} />,
    label: "Compatibility",
    note: "Synastry & guna milan",
    route: "/compatibility",
  },
  {
    index: "04",
    icon: <Users size={15} />,
    label: "AI Astrologers",
    note: "Consult a specialist",
    route: "/consult",
  },
  {
    index: "05",
    icon: <Download size={15} />,
    label: "Reports",
    note: "Deep written readings",
    route: "/reports",
  },
  {
    index: "06",
    icon: <Gift size={15} />,
    label: "Remedies",
    note: "Gemstones, mantra, ritual",
    route: "/remedies",
  },
];

/** Numbered index of the app's main destinations, set like a table of contents. */
export const ExploreIndex: React.FC = () => {
  const navigate = useNavigate();

  return (
    <nav
      aria-label="Explore AstroYou"
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 border-t border-l border-white/8 animate-reveal-progressive"
    >
      {DESTINATIONS.map((d) => (
        <button
          key={d.route}
          onClick={() => navigate(d.route)}
          className="group relative text-left px-5 py-4 border-b border-r border-white/8 hover:bg-white/3.5 transition-colors duration-300"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="font-display italic text-white/25 text-sm group-hover:text-gold/70 transition-colors">
              {d.index}
            </span>
            <ArrowUpRight
              size={13}
              className="text-white/0 group-hover:text-gold transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </div>
          <div className="mt-2 flex items-center gap-2 text-white/80 group-hover:text-white transition-colors">
            <span className="text-gold/70">{d.icon}</span>
            <span className="text-sm font-medium">{d.label}</span>
          </div>
          <p className="mt-1 text-xs text-white/30">{d.note}</p>
        </button>
      ))}
    </nav>
  );
};
