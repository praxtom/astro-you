/**
 * Sanitize user-controlled free text before it is interpolated into an LLM
 * prompt. This is defense-in-depth against prompt injection: even though the
 * system prompt instructs the model to treat memory as data, untrusted text
 * (especially guest-supplied atman data) should not be able to inject newlines,
 * role markers, or "ignore previous instructions"-style directives verbatim.
 */
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?previous\s+instructions/gi,
  /disregard\s+(all\s+)?(previous|above)/gi,
  /system\s*:/gi,
  /assistant\s*:/gi,
  /\bDAN\b/g,
  /<\/?(system|assistant|user|instruction)[^>]*>/gi,
];

export function sanitizePromptText(value: unknown, maxLength = 200): string {
  if (typeof value !== "string") return "";
  let out = value
    // collapse newlines/tabs so prompt structure can't be forged
    .replace(/[\r\n\t]+/g, " ")
    // strip remaining ASCII control characters (0x00–0x1F)
    // eslint-disable-next-line no-control-regex
    .replace(new RegExp("[\\u0000-\\u001f]", "g"), "")
    // neutralize markdown headings / code fences used to delimit sections
    .replace(/[`#]{2,}/g, " ");
  for (const re of INJECTION_PATTERNS) out = out.replace(re, "[redacted]");
  out = out.trim();
  return out.length > maxLength ? out.slice(0, maxLength) + "…" : out;
}

/**
 * Sanitize the free-text fields of an atman context object. Returns a new
 * object; numeric/enum fields pass through untouched.
 */
export function sanitizeAtmanContext<T extends Record<string, any> | undefined>(
  atman: T,
): T {
  if (!atman || typeof atman !== "object") return atman;
  const a: any = { ...atman };

  const cleanList = (arr: any, fields: string[], cap = 50) =>
    Array.isArray(arr)
      ? arr.slice(0, cap).map((item) => {
          if (typeof item === "string") return sanitizePromptText(item);
          if (item && typeof item === "object") {
            const copy: any = { ...item };
            for (const f of fields) {
              if (f in copy) copy[f] = sanitizePromptText(copy[f]);
            }
            return copy;
          }
          return item;
        })
      : arr;

  if (Array.isArray(a.knownPatterns))
    a.knownPatterns = cleanList(a.knownPatterns, ["pattern"]);
  if (Array.isArray(a.activeEvents))
    a.activeEvents = cleanList(a.activeEvents, ["title"]);
  if (Array.isArray(a.routines)) a.routines = cleanList(a.routines, ["title"]);
  if (Array.isArray(a.keyRelationships))
    a.keyRelationships = cleanList(a.keyRelationships, [
      "name",
      "relation",
      "dynamic",
      "notes",
    ]);
  if (Array.isArray(a.adviceHistory))
    a.adviceHistory = cleanList(a.adviceHistory, ["advice", "context"]);
  if (typeof a.dailyIntention === "string")
    a.dailyIntention = sanitizePromptText(a.dailyIntention);

  return a as T;
}
