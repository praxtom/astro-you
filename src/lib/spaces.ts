/**
 * The five spaces of AstroYou — the information architecture.
 *
 * Each space answers one user question. Navigation, space tabs, and the
 * dashboard's explore index all derive from this single definition, so the
 * structure of the app lives in exactly one place.
 */

export interface SpacePage {
  label: string;
  path: string;
  /** Marks the space's landing page (where the header link goes). */
  primary?: boolean;
}

export interface Space {
  id: "today" | "guidance" | "chart" | "bonds" | "path";
  label: string;
  question: string;
  pages: SpacePage[];
}

export const SPACES: Space[] = [
  {
    id: "today",
    label: "Today",
    question: "Your forecast, and the best times to act today",
    pages: [
      { label: "Forecast", path: "/forecast", primary: true },
      { label: "Transits (Gochar)", path: "/transit" },
      { label: "Eclipses", path: "/eclipses" },
    ],
  },
  {
    id: "guidance",
    label: "Ask Jyotish",
    question: "Ask anything about your life, answered from your own chart",
    pages: [
      { label: "Chat with Jyotish", path: "/synthesis", primary: true },
      { label: "Choose a guide", path: "/consult" },
    ],
  },
  {
    id: "chart",
    label: "My Chart",
    question: "Your Kundali (birth chart) and what it says about you",
    pages: [
      { label: "Chart and reports", path: "/reports", primary: true },
      { label: "Numerology", path: "/numerology" },
      { label: "Human Design", path: "/human-design" },
      { label: "Vedic chart tools", path: "/advanced-vedic" },
      { label: "Astro Map", path: "/astromap" },
      { label: "Tarot", path: "/tarot" },
    ],
  },
  {
    id: "bonds",
    label: "Matching",
    question: "See how well two people match, from both birth charts",
    pages: [
      { label: "Kundali matching", path: "/compatibility", primary: true },
    ],
  },
  {
    id: "path",
    label: "Practices",
    question: "Remedies for your chart, and simple daily practices",
    pages: [
      { label: "Remedies", path: "/remedies", primary: true },
      { label: "Wellness", path: "/wellness" },
    ],
  },
];

export function getSpaceForPath(pathname: string): Space | undefined {
  return SPACES.find((space) =>
    space.pages.some(
      (page) => pathname === page.path || pathname.startsWith(page.path + "/"),
    ),
  );
}

export function getSpacePrimaryPath(space: Space): string {
  return (space.pages.find((p) => p.primary) ?? space.pages[0]).path;
}
