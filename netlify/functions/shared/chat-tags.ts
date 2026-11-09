/**
 * Hidden machine tags the chat model may append to a reply:
 *
 *   <routine>{...}</routine>   — an optional practice suggestion (JSON)
 *   <chips>["…","…"]</chips>   — 1–2 short follow-up suggestions (JSON array)
 *
 * Neither may ever reach the visible chat. Deltas are streamed as they arrive,
 * so stripping only the final text is not enough: the opening `<rou` can land
 * in one delta and the rest in the next, and a reply truncated by the output
 * cap can end inside a tag that never closes. The streaming filter below holds
 * back anything that could be the start of a hidden tag until it knows.
 */

export const HIDDEN_TAG_NAMES = ["routine", "chips"] as const;
export type HiddenTagName = (typeof HIDDEN_TAG_NAMES)[number];

export const MAX_REPLY_CHIPS = 2;
export const MAX_REPLY_CHIP_CHARS = 60;

type OpenMatch =
  | { kind: "open"; name: HiddenTagName; length: number }
  | { kind: "partial" }
  | { kind: "none" };

/** Classify text starting with "<": a hidden-tag opener, a maybe, or not. */
function matchHiddenOpen(text: string): OpenMatch {
  const lower = text.toLowerCase();
  for (const name of HIDDEN_TAG_NAMES) {
    const opener = `<${name}`;
    if (lower.length < opener.length) {
      if (opener.startsWith(lower)) return { kind: "partial" };
      continue;
    }
    if (!lower.startsWith(opener)) continue;
    const next = lower.charAt(opener.length);
    if (!next) return { kind: "partial" };
    if (next !== ">" && !/\s/.test(next)) continue; // e.g. "<chipset"
    const end = lower.indexOf(">", opener.length);
    if (end === -1) return { kind: "partial" };
    return { kind: "open", name, length: end + 1 };
  }
  return { kind: "none" };
}

export interface HiddenTagFilter {
  /** Feed one raw model delta; returns the text that is safe to show now. */
  push(delta: string): string;
  /**
   * End of stream: returns any held-back visible text. An unclosed hidden tag
   * (or a dangling "<chi" fragment) is dropped, never shown.
   */
  flush(): string;
}

export function createHiddenTagFilter(): HiddenTagFilter {
  let pending = "";
  let insideTag: HiddenTagName | null = null;

  const drain = (final: boolean): string => {
    let out = "";
    while (pending) {
      if (insideTag) {
        const closer = `</${insideTag}>`;
        const idx = pending.toLowerCase().indexOf(closer);
        if (idx === -1) {
          if (final) {
            pending = "";
            insideTag = null;
          } else {
            // Keep only enough to recognise a closer split across deltas.
            pending = pending.slice(
              Math.max(0, pending.length - (closer.length - 1)),
            );
          }
          break;
        }
        pending = pending.slice(idx + closer.length);
        insideTag = null;
        continue;
      }
      const lt = pending.indexOf("<");
      if (lt === -1) {
        out += pending;
        pending = "";
        break;
      }
      out += pending.slice(0, lt);
      pending = pending.slice(lt);
      const match = matchHiddenOpen(pending);
      if (match.kind === "open") {
        insideTag = match.name;
        pending = pending.slice(match.length);
        continue;
      }
      if (match.kind === "partial") {
        if (final) pending = "";
        break;
      }
      out += "<";
      pending = pending.slice(1);
    }
    return out;
  };

  return {
    push(delta: string) {
      if (typeof delta !== "string" || !delta) return "";
      pending += delta;
      return drain(false);
    },
    flush() {
      return drain(true);
    },
  };
}

/** Remove every hidden tag — complete, unclosed or dangling — from `text`. */
export function stripHiddenTags(text: string): string {
  if (typeof text !== "string" || !text) return "";
  const filter = createHiddenTagFilter();
  return (filter.push(text) + filter.flush()).trim();
}

/** Inner text of the first complete `<name>…</name>`, or null. */
export function extractHiddenTag(
  text: string,
  name: HiddenTagName,
): string | null {
  if (typeof text !== "string") return null;
  const match = text.match(
    new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"),
  );
  return match ? match[1] : null;
}

/** The suggested routine JSON, if the model appended a complete one. */
export function parseRoutineTag(text: string): unknown {
  const inner = extractHiddenTag(text, "routine");
  if (!inner) return undefined;
  try {
    const parsed = JSON.parse(inner.trim());
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function cleanChip(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[<>*_`#[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .trim();
  if (!cleaned || cleaned.length > MAX_REPLY_CHIP_CHARS) return null;
  return cleaned;
}

/**
 * Follow-up suggestions from a `<chips>` tag: at most two short, plain,
 * de-duplicated strings. Anything malformed yields an empty list.
 */
export function parseReplyChips(text: string): string[] {
  const inner = extractHiddenTag(text, "chips");
  if (!inner) return [];
  let candidates: unknown[] = [];
  try {
    const parsed = JSON.parse(inner.trim());
    if (Array.isArray(parsed)) candidates = parsed;
  } catch {
    candidates = inner.split(/\n|\|/);
  }
  const chips: string[] = [];
  for (const candidate of candidates) {
    const chip = cleanChip(candidate);
    if (!chip) continue;
    if (chips.some((c) => c.toLowerCase() === chip.toLowerCase())) continue;
    chips.push(chip);
    if (chips.length >= MAX_REPLY_CHIPS) break;
  }
  return chips;
}
