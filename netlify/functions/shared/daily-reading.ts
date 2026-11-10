/**
 * The day's sign reading, made readable.
 *
 * The astrology API's daily sign text is stitched from stock sentences:
 * fragments ("Positive movement energy."), repeated openers, a mix of "you"
 * and "one". These helpers turn it into a short lede plus a few clean
 * sentences. The Gemini rewrite lives in gemini.ts; this file is the
 * deterministic fallback and the validation for that rewrite.
 */

export interface DailyReading {
  /** One sentence for the home hero. */
  lede: string;
  /** Three to five sentences for the full reading. */
  reading: string;
}

const PLANET_OR_HOUSE =
  /\b(sun|moon|mercury|venus|mars|jupiter|saturn|rahu|ketu|\d{1,2}(st|nd|rd|th) house)\b/i;

/** Split into sentences, keeping terminal punctuation. */
export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Third-person "one" phrasing → "you", so the reading speaks to the reader. */
function toSecondPerson(sentence: string): string {
  return sentence
    .replace(/\bwho one is\b/gi, "who you are")
    .replace(/\bone is\b/gi, "you are")
    .replace(/\bone's\b/gi, "your");
}

/**
 * Drop fragments (under four words), exact repeats, and a second sentence in
 * a row that opens with the same word. Keeps the original order.
 */
export function cleanSentences(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  let lastOpener = "";
  for (const raw of splitSentences(text)) {
    const sentence = toSecondPerson(raw);
    const words = sentence.split(" ").filter(Boolean);
    if (words.length < 4) continue;
    const key = sentence.toLowerCase();
    if (seen.has(key)) continue;
    const opener = words[0].toLowerCase();
    if (opener === lastOpener) continue;
    seen.add(key);
    lastOpener = opener;
    out.push(sentence);
  }
  return out;
}

/** Deterministic reading: the specific (planet/house) sentence leads. */
export function fallbackDailyReading(text: string): DailyReading | null {
  const sentences = cleanSentences(text);
  if (sentences.length === 0) return null;
  const lede = sentences.find((s) => PLANET_OR_HOUSE.test(s)) ?? sentences[0];
  const reading = sentences.slice(0, 5).join(" ");
  return { lede, reading };
}

/** Accept a model rewrite only when it is the shape and size we asked for. */
export function parseDailyReading(raw: unknown): DailyReading | null {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const { lede, reading } = value as Record<string, unknown>;
  if (typeof lede !== "string" || typeof reading !== "string") return null;
  const l = lede.trim();
  const r = reading.trim();
  if (l.length < 20 || l.length > 220) return null;
  if (r.length < 80 || r.length > 700) return null;
  return { lede: l, reading: r };
}

export function buildDailyReadingPrompt(sign: string, text: string): string {
  return `You edit daily Vedic horoscope copy for the Moon sign ${sign}.

Source text:
"""
${text.slice(0, 2000)}
"""

Rewrite it as JSON: {"lede": string, "reading": string}
- "lede": one sentence, at most 25 words. Lead with the most specific line (a planet or house) and what it means for the day.
- "reading": three or four plain sentences, at most 90 words in all. Speak to the reader as "you". It is shown on its own, below the lede: it must make sense without it (no "this" or "that" pointing back to the lede), and it should not repeat the lede.
- Keep every planet, house and sign the source names. Do not add placements, dates, numbers or promises that are not in the source.
- Every sentence must either name a planet, house or sign from the source, or tell the reader one concrete thing to do or watch for today. Delete any sentence that does neither.
- Delete vague cosmic statements entirely, for example "Neutral planetary aspects create breathing room between fate and free choice" or "Loving awareness transforms ordinary moments into sacred gifts". Also drop hype words ("quantum", "manifestation", "benevolent forces", "energy" with nothing concrete).
- Warm, calm, practical.
- No emojis, no headings, no quotes around sentences.`;
}
