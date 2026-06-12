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
    question: "What's the sky doing now?",
    pages: [
      { label: "Forecast", path: "/forecast", primary: true },
      { label: "Transit Oracle", path: "/transit" },
      { label: "Eclipses", path: "/eclipses" },
    ],
  },
  {
    id: "guidance",
    label: "Guidance",
    question: "Who do I talk to?",
    pages: [
      { label: "Jyotish", path: "/synthesis", primary: true },
      { label: "The Circle", path: "/consult" },
    ],
  },
  {
    id: "chart",
    label: "My Chart",
    question: "Who am I?",
    pages: [
      { label: "Reports", path: "/reports", primary: true },
      { label: "Numerology", path: "/numerology" },
      { label: "Human Design", path: "/human-design" },
      { label: "Advanced Vedic", path: "/advanced-vedic" },
      { label: "Astro Map", path: "/astromap" },
      { label: "Tarot", path: "/tarot" },
    ],
  },
  {
    id: "bonds",
    label: "Bonds",
    question: "What about us?",
    pages: [
      { label: "Compatibility", path: "/compatibility", primary: true },
      { label: "Friends", path: "/friends" },
    ],
  },
  {
    id: "path",
    label: "Path",
    question: "What do I practice?",
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
