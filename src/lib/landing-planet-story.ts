export const PLANET_STORY_FORCE_NAMES = [
  "Sun",
  "Moon",
  "Mars",
  "Mercury",
  "Jupiter",
  "Venus",
  "Saturn",
  "Rahu",
  "Ketu",
] as const;

export type PlanetStoryForceName = (typeof PLANET_STORY_FORCE_NAMES)[number];
export type PlanetStoryAlignment = "left" | "right" | "center";

export interface PlanetStoryForce {
  name: PlanetStoryForceName;
  sanskrit: string;
}

export interface PlanetStoryChapter {
  id:
    | "moving-sky"
    | "self-inner-world"
    | "will-intelligence"
    | "wisdom-desire"
    | "time-mastery"
    | "karmic-axis"
    | "synthesis";
  number: string;
  eyebrow: string;
  title: string;
  body: string;
  jyotish: string;
  question: string;
  accent: string;
  glow: string;
  alignment: PlanetStoryAlignment;
  forces: readonly PlanetStoryForce[];
}

export const PLANET_STORY_CHAPTERS: readonly PlanetStoryChapter[] = [
  {
    id: "moving-sky",
    number: "00",
    eyebrow: "The Moving Sky",
    title: "The stars, revealed.",
    body: "Before your first breath, the sky was already in motion. AstroYou is your personal Jyotish guide: it knows your chart, remembers your story, and stays with you on the hard days.",
    jyotish:
      "Jyotish means the science of light: nine grahas describe how consciousness meets life.",
    question: "Descend to meet the forces in conversation.",
    accent: "#E5B96A",
    glow: "rgba(229, 185, 106, 0.18)",
    alignment: "left",
    forces: [],
  },
  {
    id: "self-inner-world",
    number: "01",
    eyebrow: "Self & Inner World",
    title: "The light you radiate. The world you feel.",
    body: "Surya is the flame of purpose. Chandra is the inner tide of memory, instinct, and belonging. Together, they hold the conversation between who you are becoming and how life feels within.",
    jyotish:
      "The Sun shows vitality and direction. The Moon reveals emotional rhythm and the mind's first response.",
    question: "How do your outer light and inner weather meet?",
    accent: "#D9D7EA",
    glow: "rgba(126, 145, 196, 0.18)",
    alignment: "right",
    forces: [
      { name: "Sun", sanskrit: "Surya" },
      { name: "Moon", sanskrit: "Chandra" },
    ],
  },
  {
    id: "will-intelligence",
    number: "02",
    eyebrow: "Will & Intelligence",
    title: "The force to act. The mind that makes meaning.",
    body: "Mangal gives courage a direction. Budha turns experience into language, choices, and skill. One moves first; the other understands the movement.",
    jyotish:
      "Mars describes drive, boundaries, and decisive energy. Mercury reveals perception, speech, learning, and adaptability.",
    question: "Does your mind guide your fire—or race to explain it?",
    accent: "#DC7A5E",
    glow: "rgba(200, 91, 69, 0.2)",
    alignment: "left",
    forces: [
      { name: "Mars", sanskrit: "Mangal" },
      { name: "Mercury", sanskrit: "Budha" },
    ],
  },
  {
    id: "wisdom-desire",
    number: "03",
    eyebrow: "Wisdom & Desire",
    title: "What expands you. What you choose to cherish.",
    body: "Guru asks what makes life meaningful. Shukra reveals what makes it beautiful. Their dialogue shapes faith, relationship, abundance, and the values beneath your choices.",
    jyotish:
      "Jupiter governs growth, ethics, and higher knowledge. Venus speaks through affection, art, pleasure, and harmony.",
    question: "What if your deepest desire is also a teacher?",
    accent: "#E8C46F",
    glow: "rgba(232, 196, 111, 0.2)",
    alignment: "right",
    forces: [
      { name: "Jupiter", sanskrit: "Guru" },
      { name: "Venus", sanskrit: "Shukra" },
    ],
  },
  {
    id: "time-mastery",
    number: "04",
    eyebrow: "Time & Mastery",
    title: "What time asks you to master.",
    body: "Shani does not rush the lesson. Through structure, consequence, and patient effort, Saturn reveals the strength that can only be earned—not borrowed.",
    jyotish:
      "Saturn shows duty, delay, endurance, and the life areas where maturity becomes freedom.",
    question: "Which part of your life is asking for devotion, not speed?",
    accent: "#A9B1C2",
    glow: "rgba(100, 116, 139, 0.2)",
    alignment: "left",
    forces: [{ name: "Saturn", sanskrit: "Shani" }],
  },
  {
    id: "karmic-axis",
    number: "05",
    eyebrow: "The Karmic Axis",
    title: "The pull ahead. The wisdom behind.",
    body: "Rahu magnifies the unfinished hunger of becoming. Ketu carries the strange familiarity of what the soul already knows. They are opposites, but never separate.",
    jyotish:
      "Rahu and Ketu are the opposing lunar nodes—not physical planets—and Jyotish reads them as one karmic axis.",
    question: "What are you reaching toward, and what are you ready to release?",
    accent: "#9B87D2",
    glow: "rgba(123, 104, 182, 0.24)",
    alignment: "right",
    forces: [
      { name: "Rahu", sanskrit: "North Node" },
      { name: "Ketu", sanskrit: "South Node" },
    ],
  },
  {
    id: "synthesis",
    number: "06",
    eyebrow: "The Living Chart",
    title: "No planet speaks alone.",
    body: "A planet is an influence. A chart is the conversation between them. Your birth moment makes that conversation yours.",
    jyotish:
      "Houses, aspects, signs, and Dashas turn nine forces into one evolving Kundali—not nine isolated predictions.",
    question: "Your first breath is where the interpretation begins.",
    accent: "#E5B96A",
    glow: "rgba(229, 185, 106, 0.24)",
    alignment: "center",
    forces: [],
  },
] as const;

export interface PlanetStoryState {
  progress: number;
  scenePosition: number;
  activeIndex: number;
  activeChapter: PlanetStoryChapter;
  fromIndex: number;
  toIndex: number;
  transitionProgress: number;
}

export function getPlanetStoryState(progress: number): PlanetStoryState {
  const safeProgress = Number.isFinite(progress)
    ? Math.min(Math.max(progress, 0), 1)
    : 0;
  const finalIndex = PLANET_STORY_CHAPTERS.length - 1;
  const scenePosition = safeProgress * finalIndex;
  const fromIndex = Math.min(Math.floor(scenePosition), finalIndex);
  const toIndex = Math.min(fromIndex + 1, finalIndex);
  const transitionProgress = scenePosition - fromIndex;
  const activeIndex = Math.min(Math.round(scenePosition), finalIndex);

  return {
    progress: safeProgress,
    scenePosition,
    activeIndex,
    activeChapter: PLANET_STORY_CHAPTERS[activeIndex],
    fromIndex,
    toIndex,
    transitionProgress,
  };
}

export function getFocusedPlanetNames(progress: number): readonly PlanetStoryForceName[] {
  const { activeChapter } = getPlanetStoryState(progress);
  if (activeChapter.id === "moving-sky" || activeChapter.id === "synthesis") {
    return PLANET_STORY_FORCE_NAMES;
  }

  return activeChapter.forces.map((force) => force.name);
}
