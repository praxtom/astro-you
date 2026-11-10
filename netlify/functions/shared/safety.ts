/**
 * Deterministic safety helpers for AstroYou guidance surfaces.
 *
 * - detectCrisisRisk(): a keyword/phrase screen (English + common Hinglish /
 *   Hindi) run on the user's message BEFORE any credit is reserved or any model
 *   is called. When it fires, the caller returns CRISIS_SAFETY_REPLY instead of
 *   generating — we never let a model improvise around self-harm.
 * - softenOutcomeCertainty(): a light post-filter for non-streamed narratives
 *   that rewrites absolute outcome claims ("guaranteed", "destined to") into
 *   non-deterministic language.
 */

const CRISIS_PATTERNS: RegExp[] = [
  // English
  /\bsuicid(e|al)\b/,
  /\bkill(ing)?\s+my\s*self\b/,
  /\bend(ing)?\s+(my|my\s+own)\s+life\b/,
  /\bend(ing)?\s+it\s+all\b/,
  /\bhang(ing)?\s+my\s*self\b/,
  /\boverdos(e|ed|ing)\b/,
  /\b(jump|jumping)\s+(off|from|in\s+front\s+of)\b.*\b(bridge|building|roof|terrace|train|metro)\b/,
  /\b(drink|drinking|take|taking|eat|eating|swallow|swallowing)\s+(poison|rat\s+poison|phenyl)\b/,
  /\btak(e|ing)\s+my\s+(own\s+)?life\b/,
  /\b(want|wanted|wanting|wants)\s+to\s+die\b/,
  /\bwanna\s+die\b/,
  /\bwish\s+i\s+(was|were)\s+dead\b/,
  /\bbetter\s+off\s+dead\b/,
  /\bi\s+(do\s*not|dont|don't)\s+want\s+to\s+(live|be\s+alive|wake\s+up)\b/,
  /\bself[\s-]?harm(ing)?\b/,
  /\b(cut|cutting|hurt|hurting|harm|harming)\s+my\s*self\b/,
  /\bno\s+(reason|point)\s+(to|in)\s+(live|living|go\s+on|going\s+on)\b/,
  /\b(life\s+is\s+)?not\s+worth\s+living\b/,
  // Hinglish (romanised Hindi)
  /\bmarna\s+chaht[aie]\b/,
  /\bmarna\s+hai\b/,
  /\bmar\s+ja+(u|oo|un|oon)g[ai]\b/,
  /\bmar\s+ja+na\s+hai\b/,
  /\b(zeh[ae]r|zahar)\s+kha/,
  /\b(ph|f)a+n[sd][ia]\s+(laga|le\s+l)/,
  /\bmar\s+ja+na\s+chaht[aie]\b/,
  /\bkhud\s*khushi\b/,
  /\bkhudkushi\b/,
  /\ba+tm?a?hatya\b/,
  /\bsuicide\s+kar/,
  /\bjee+na\s+nahi+\s+chaht[aie]\b/,
  /\bjee+ne\s+ka\s+(koi\s+)?(mann?|matlab)\s+nahi/,
  /\bzind[ae]gi\s+khatam\s+kar/,
  /\bkhud\s+ko\s+(khatam|maar|mar)\b/,
  /\bjaan\s+de\s+(dunga|dungi|du|doon)\b/,
  // Devanagari
  /आत्महत्या/,
  /खुदकुशी/,
  /ख़ुदकुशी/,
  /मरना\s*चाहत[ाीे]/,
  /जीना\s*नहीं\s*चाहत[ाीे]/,
  /खुद\s*को\s*(खत्म|ख़त्म|मार)/,
];

// Common idioms that contain trigger words but are not risk statements.
const FALSE_POSITIVE_PATTERNS: RegExp[] = [
  /\bsuicide\s+squad\b/g,
  /\bkill(ing)?\s+my\s*self\s+(laughing|with\s+laughter)\b/g,
];

function normalizeForScreen(text: string): string {
  return text.toLowerCase().replace(/[‘’ʼ]/g, "'").replace(/\s+/g, " ").trim();
}

/**
 * Returns true when the text contains a likely self-harm / suicide statement.
 * Deliberately conservative toward safety: a few false positives (a calm
 * safety message) are far cheaper than a missed crisis.
 */
export function detectCrisisRisk(text: unknown): boolean {
  if (typeof text !== "string" || !text.trim()) return false;
  let normalized = normalizeForScreen(text);
  for (const re of FALSE_POSITIVE_PATTERNS) {
    normalized = normalized.replace(re, " ");
  }
  return CRISIS_PATTERNS.some((re) => re.test(normalized));
}

/** Fixed, warm safety reply. Never model-generated. */
export const CRISIS_SAFETY_REPLY = `I'm really glad you told me this. What you're carrying sounds very heavy, and you don't have to hold it alone.

Please reach out to someone right now:
- **Tele-MANAS (India, free, 24x7):** call **14416** or **1-800-891-4416**
- **If you are in immediate danger:** call **112** for emergency services
- Or call a trusted friend or family member and tell them how you're feeling.

If you can, don't stay alone with this tonight — be near someone, even just on the phone.

I'm here and will keep talking with you, but your safety matters more than any chart. Would you like to tell me what's been happening?`;

type Replacement = [RegExp, string];

// Order matters: specific phrases before the generic single words.
const OUTCOME_REPLACEMENTS: Replacement[] = [
  [/\b(is|are)\s+guaranteed\s+to\b/gi, "$1 well placed to"],
  [/\bguaranteed\s+to\b/gi, "well placed to"],
  [/\bguaranteed\b/gi, "promising"],
  [/\bguarantees\b/gi, "supports"],
  [/\bguarantee\b/gi, "support"],
  [/\bwill\s+definitely\b/gi, "may"],
  [/\bdefinitely\s+will\b/gi, "may"],
  [/\bwill\s+certainly\b/gi, "may"],
  [/\bwill\s+surely\b/gi, "may"],
  [/\bno\s+adverse\s+effects?\b/gi, "milder challenges"],
  [/\b(are|is|were|was)\s+destined\s+to\s+be\b/gi, "$1 well suited to be"],
  [/\b(are|is|were|was)\s+destined\s+to\b/gi, "$1 inclined to"],
  [/\bdestined\s+for\b/gi, "well placed for"],
  [/\bdestined\s+to\b/gi, "inclined to"],
  [/\bbuilt\s+to\s+withstand\b/gi, "able to work through"],
];

function matchLeadingCase(original: string, replacement: string): string {
  const first = original.charAt(0);
  if (first && first === first.toUpperCase() && first !== first.toLowerCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/**
 * Rewrites absolute outcome phrases into non-deterministic language. Used on
 * non-streamed narratives (e.g. compatibility) where we can post-process the
 * full text before the user sees it.
 */
export function softenOutcomeCertainty(text: string): string {
  if (typeof text !== "string" || !text) return text;
  let out = text;
  for (const [re, replacement] of OUTCOME_REPLACEMENTS) {
    out = out.replace(re, (match: string, ...groups: unknown[]) => {
      const captured = typeof groups[0] === "string" ? groups[0] : "";
      const expanded = replacement.replace("$1", captured);
      return matchLeadingCase(match, expanded);
    });
  }
  return out;
}
