/**
 * Plain-language meanings for Human Design values returned by
 * /human-design/type and /human-design/bodygraph.
 *
 * The API is inconsistent about spelling ("Manifesting Generator" vs
 * "manifesting_generator", "Sacral Authority" vs "sacral", "g_center" vs
 * "G Center"), so every lookup normalises its key first. Unknown values
 * return null so the page shows nothing extra rather than a placeholder.
 *
 * Copy rules: neutral, everyday language; an open centre is never a flaw.
 */

/** Lowercase, turn separators into single spaces, trim. */
function norm(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value)
    .toLowerCase()
    .replace(/[_\-/,.:;()&+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lookup(
  aliases: Record<string, string>,
  meanings: Record<string, string>,
  key: string,
): string | null {
  if (!key) return null;
  const canonical = aliases[key] ?? key;
  return meanings[canonical] ?? null;
}

// ── Type ────────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  generator: "Generator",
  "manifesting generator": "Manifesting Generator",
  projector: "Projector",
  manifestor: "Manifestor",
  reflector: "Reflector",
};

const TYPE_ALIASES: Record<string, string> = {
  mg: "manifesting generator",
  "manifesting generators": "manifesting generator",
  "pure generator": "generator",
};

const TYPE_MEANINGS: Record<string, string> = {
  generator:
    "You have steady, renewable energy for work you enjoy, and it flows best when you respond to what life brings rather than chasing.",
  "manifesting generator":
    "You have plenty of energy and move quickly across several interests; respond first, then let people know what you are about to do.",
  projector:
    "You have a gift for seeing how people and things work, and your guidance lands best when someone recognises it and asks.",
  manifestor:
    "You are built to start things and set them moving, and telling people before you act keeps the way clear.",
  reflector:
    "You sense the mood and health of the people and places around you, and taking your time with big choices suits you well.",
};

function typeKey(value: unknown): string {
  const key = norm(value).replace(/\s+type$/, "");
  return TYPE_ALIASES[key] ?? key;
}

/** Display label for a type, e.g. "manifesting_generator" → "Manifesting Generator". */
export function humanDesignTypeLabel(value: unknown): string | null {
  return TYPE_LABELS[typeKey(value)] ?? null;
}

/** One everyday line explaining a Human Design type, or null if unknown. */
export function humanDesignTypeMeaning(value: unknown): string | null {
  return lookup({}, TYPE_MEANINGS, typeKey(value));
}

// ── Strategy ────────────────────────────────────────────────────────────────

// Filler words are dropped so "Wait to Respond", "To Respond" and "respond"
// all reduce to the same key.
const STRATEGY_FILLER = new Set([
  "wait",
  "waiting",
  "to",
  "for",
  "the",
  "an",
  "a",
  "before",
  "acting",
  "then",
  "and",
  "strategy",
]);

const STRATEGY_ALIASES: Record<string, string> = {
  responding: "respond",
  "respond inform": "respond inform",
  informing: "inform",
  invitations: "invitation",
  invited: "invitation",
  "be invited": "invitation",
  "lunar cycle": "lunar",
  "28 days": "lunar",
  "moon cycle": "lunar",
};

const STRATEGY_MEANINGS: Record<string, string> = {
  respond:
    "Let things come to you first, then notice your gut yes or no before you commit.",
  "respond inform":
    "Notice what you respond to, then tell the people it affects before you jump in.",
  inform:
    "Tell the people it affects before you act, and things move with less friction.",
  initiate:
    "Start things when you feel the urge, and keep the people around you in the loop as you go.",
  invitation:
    "Share your guidance when you are recognised or asked, especially for big things like work and relationships.",
  lunar:
    "Give big decisions about a month, talking them over along the way, before you settle.",
};

function strategyKey(value: unknown): string {
  const tokens = norm(value)
    .split(" ")
    .filter((t) => t && !STRATEGY_FILLER.has(t));
  const key = tokens.join(" ");
  return STRATEGY_ALIASES[key] ?? key;
}

/** One everyday line explaining a Human Design strategy, or null if unknown. */
export function humanDesignStrategyMeaning(value: unknown): string | null {
  return lookup({}, STRATEGY_MEANINGS, strategyKey(value));
}

// ── Authority ───────────────────────────────────────────────────────────────

const AUTHORITY_ALIASES: Record<string, string> = {
  emotions: "emotional",
  "solar plexus": "emotional",
  "emotional solar plexus": "emotional",
  "solar plexus emotional": "emotional",
  spleen: "splenic",
  "ego manifested": "ego",
  "ego projected": "ego",
  heart: "ego",
  "heart ego": "ego",
  "ego heart": "ego",
  will: "ego",
  "self projected": "self",
  "self projection": "self",
  g: "self",
  "g center": "self",
  identity: "self",
  mental: "environmental",
  "mental environmental": "environmental",
  "environmental mental": "environmental",
  outer: "environmental",
  none: "environmental",
  no: "environmental",
  "sounding board": "environmental",
  moon: "lunar",
  "lunar cycle": "lunar",
};

const AUTHORITY_MEANINGS: Record<string, string> = {
  emotional:
    "Big decisions come clearest once your feelings settle, so sleep on them rather than deciding in the moment.",
  sacral:
    "Your gut response in the moment, a felt yes or no, is your most reliable guide.",
  splenic:
    "Quiet, instant hunches about what feels right are your most reliable guide, so trust the first nudge.",
  ego: "Your choices hold best when they match what you truly want and are willing to commit to.",
  self: "Talk things through and listen to your own voice; what sounds true to you is your guide.",
  environmental:
    "Clarity comes from talking things over with people you trust and noticing which places feel right.",
  lunar:
    "Give big choices a full Moon cycle, about four weeks, and let clarity build over time.",
};

function authorityKey(value: unknown): string {
  return norm(value)
    .replace(/\s+(inner\s+)?authority$/, "")
    .replace(/^(inner\s+)?authority\s+/, "")
    .replace(/\s+(center|centre)$/, "");
}

/** One everyday line explaining a Human Design authority, or null if unknown. */
export function humanDesignAuthorityMeaning(value: unknown): string | null {
  return lookup(AUTHORITY_ALIASES, AUTHORITY_MEANINGS, authorityKey(value));
}

// ── Profile ─────────────────────────────────────────────────────────────────

const PROFILE_MEANINGS: Record<string, string> = {
  "1/3":
    "You build confidence by studying things deeply, then learn what works by trying it yourself.",
  "1/4":
    "You like a solid base of knowledge, and your openings come through people you already know.",
  "2/4":
    "You have natural gifts that grow in your own space, and your friends and network draw them out.",
  "2/5":
    "You need time alone to recharge, and people often look to you for practical answers.",
  "3/5":
    "You learn by trying and adjusting, and others come to you for practical solutions.",
  "3/6":
    "You learn by hands-on experience, and over time that turns into calm, trusted wisdom.",
  "4/6":
    "Your relationships open doors for you, and over the years you grow into someone others look up to.",
  "4/1":
    "You follow a steady path of your own and share well-researched ideas through your close circle.",
  "5/1":
    "People look to you to solve problems, and your careful research gives your answers weight.",
  "5/2":
    "People sense you can help when things get hard, and you also need quiet time to develop your gifts.",
  "6/2":
    "You have natural gifts that others notice, maturing over the years into an example people trust.",
  "6/3":
    "You learn through trial and adjustment, growing into a grounded, wise example for others.",
};

function profileKey(value: unknown): string {
  const match = norm(value).match(/([1-6])\s*([1-6])/);
  return match ? `${match[1]}/${match[2]}` : "";
}

/** One everyday line explaining a profile like "1/3", "1-3" or "1 / 3", or null. */
export function humanDesignProfileMeaning(value: unknown): string | null {
  return lookup({}, PROFILE_MEANINGS, profileKey(value));
}

// ── Centres ─────────────────────────────────────────────────────────────────

const CENTER_LABELS: Record<string, string> = {
  head: "Head",
  ajna: "Ajna",
  throat: "Throat",
  g: "G Center (Identity)",
  heart: "Heart (Ego)",
  sacral: "Sacral",
  "solar plexus": "Solar Plexus",
  spleen: "Spleen",
  root: "Root",
};

const CENTER_ALIASES: Record<string, string> = {
  crown: "head",
  mind: "ajna",
  identity: "g",
  self: "g",
  "g identity": "g",
  "identity g": "g",
  ego: "heart",
  will: "heart",
  "heart ego": "heart",
  "ego heart": "heart",
  "heart ego will": "heart",
  "will power": "heart",
  willpower: "heart",
  emotional: "solar plexus",
  emotions: "solar plexus",
  "emotional solar plexus": "solar plexus",
  solarplexus: "solar plexus",
  splenic: "spleen",
};

const CENTER_MEANINGS: Record<string, { defined: string; open: string }> = {
  head: {
    defined:
      "You have a steady flow of questions and ideas you want to explore.",
    open: "You pick up on other people's questions and inspiration, and can choose which ones are worth your time.",
  },
  ajna: {
    defined:
      "You have a consistent way of thinking things through and making sense of them.",
    open: "You can see an issue from many angles and are comfortable not holding one fixed opinion.",
  },
  throat: {
    defined:
      "You have a consistent way of speaking up and getting things done through your words.",
    open: "Your voice adapts to the people around you, and your words land well when the moment is right.",
  },
  g: {
    defined:
      "You have a steady sense of who you are and where you are heading.",
    open: "Your sense of direction grows from the people and places you choose, so pick surroundings that feel good.",
  },
  heart: {
    defined:
      "You have reliable willpower to keep the promises you truly want to keep.",
    open: "You have nothing to prove, and are free to commit only to what you really want.",
  },
  sacral: {
    defined:
      "You have steady, renewable energy for work and activities you enjoy.",
    open: "You read other people's energy well, and resting once you are done keeps you balanced.",
  },
  "solar plexus": {
    defined:
      "Your feelings move in a gentle wave, so clarity comes with a little time.",
    open: "You are sensitive to the moods around you and can feel for others without carrying their feelings as your own.",
  },
  spleen: {
    defined: "You have steady instincts for what is healthy and right for you.",
    open: "You notice what feels good in your body and surroundings, and find it easy to let go of what no longer fits.",
  },
  root: {
    defined: "You handle pressure and deadlines at a steady, consistent pace.",
    open: "You feel the pace of the people around you, and can choose to take things in your own time.",
  },
};

function centerKey(value: unknown): string {
  const key = norm(value).replace(/\s+(center|centre)$/, "");
  return CENTER_ALIASES[key] ?? key;
}

/** Display label for a centre, e.g. "g_center" → "G Center (Identity)". */
export function humanDesignCenterLabel(value: unknown): string | null {
  return CENTER_LABELS[centerKey(value)] ?? null;
}

/**
 * One everyday line for a centre in its defined or open state, or null if the
 * centre name is unknown.
 */
export function humanDesignCenterMeaning(
  value: unknown,
  defined: boolean,
): string | null {
  const entry = CENTER_MEANINGS[centerKey(value)];
  if (!entry) return null;
  return defined ? entry.defined : entry.open;
}
