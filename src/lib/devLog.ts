/**
 * console.log that is compiled out in production builds. Use for any debug line
 * that could echo personal data (emotional state, relationships, birth data,
 * match results) — those must never reach a real user's DevTools console.
 */
export function devLog(...args: unknown[]): void {
  if (import.meta.env.DEV) console.log(...args);
}
