import type { ProactiveNudgePartner, UserContext } from "./gemini.js";
import { sanitizePromptText } from "./sanitize.js";

/**
 * Pick the person a synastry nudge is about from the user's OWN server-loaded
 * relationships. The client's `partnerData` is only a hint (its name selects
 * among them); its fields are never trusted or interpolated into the prompt.
 * Falls back to the first partner, then to nobody (no nudge).
 */
export function selectNudgePartner(
  relationships: NonNullable<UserContext["atman"]>["keyRelationships"],
  hint?: unknown,
): ProactiveNudgePartner | null {
  const list = Array.isArray(relationships) ? relationships : [];
  if (list.length === 0) return null;

  const hintName =
    hint && typeof hint === "object" && typeof (hint as any).name === "string"
      ? (hint as { name: string }).name.trim().toLowerCase()
      : "";
  const chosen =
    (hintName &&
      list.find(
        (r) =>
          typeof r?.name === "string" &&
          r.name.trim().toLowerCase() === hintName,
      )) ||
    list.find((r) => r?.relation === "partner") ||
    null;
  if (!chosen) return null;

  const name = sanitizePromptText(chosen.name, 60);
  if (!name) return null;
  return {
    name,
    relation: sanitizePromptText(chosen.relation, 30) || undefined,
    dynamic: sanitizePromptText(chosen.dynamic, 30) || undefined,
    zodiacSign: sanitizePromptText(chosen.zodiacSign, 30) || undefined,
  };
}
