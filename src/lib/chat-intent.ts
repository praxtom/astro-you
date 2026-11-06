/**
 * Lightweight, client-side intent hints for the chat UI.
 *
 * These only decide whether to *offer* something gentle (a breathing pause, a
 * check-in reminder). They never change what is sent to the guide, so a false
 * positive costs one dismissible chip and a miss costs nothing.
 *
 * Covers English plus common Hinglish phrasing.
 */

const ANXIETY_PATTERNS: RegExp[] = [
  /\banxi(ous|ety)\b/i,
  /\bscared\b/i,
  /\bafraid\b/i,
  /\bpanic(king|ky)?\b/i,
  /\bworr(ied|y|ying)\b/i,
  /\bcan'?t sleep\b/i,
  /\bcannot sleep\b/i,
  /\bunable to sleep\b/i,
  /\boverwhelm(ed|ing)?\b/i,
  /\bstressed\b/i,
  /\bnervous\b/i,
  /\bghabra(hat|aya|ayi|a raha|a rahi)?\b/i,
  /\bdarr? lag (raha|rahi|ta|ti)\b/i,
  /\bbechain(i)?\b/i,
  /\bchinta\b/i,
  /\btension (ho|hai|me|mein)\b/i,
];

const RELATIONSHIP_PATTERNS: RegExp[] = [
  /\brelationship\b/i,
  /\b(boy|girl)friend\b/i,
  /\b(husband|wife|partner|spouse|fianc[eé]e?)\b/i,
  /\b(marriage|married|divorce|break ?up|ex)\b/i,
  /\b(love|crush|dating)\b/i,
  /\bheart\b/i,
  /\b(shaadi|rishta|pyaar|pyar)\b/i,
];

export function isAnxiousMessage(text: string): boolean {
  return ANXIETY_PATTERNS.some((re) => re.test(text));
}

export function isRelationshipMessage(text: string): boolean {
  return RELATIONSHIP_PATTERNS.some((re) => re.test(text));
}
