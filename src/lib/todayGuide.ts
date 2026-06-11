import type { PanchangData } from "../hooks/usePanchang";
import type { UserProfile } from "../types/user";

export interface TodayGuide {
  energy: string;
  action: string;
  caution: string;
  nudge: string;
  why: string;
}

/**
 * The day's guidance — Energy / Do / Take care — derived from panchang
 * timing and Atman's memory of the user. Shared by the dashboard's
 * TodayTriptych and the rail's reading-card fallback.
 */
export function buildTodayGuide(
  atmanState: UserProfile["atman"] | undefined,
  panchang: PanchangData | null,
  panchangError: string | null,
  isSignedIn: boolean,
): TodayGuide {
  const emotion = atmanState?.emotionalState || "stable";
  const hasRoutineGap =
    isSignedIn && (!atmanState?.routines || atmanState.routines.length === 0);
  const energy =
    emotion === "anxious" || emotion === "chaotic"
      ? "Grounding and slower decisions"
      : emotion === "energetic"
        ? "High momentum for visible work"
        : panchang?.nakshatra && panchang.nakshatra !== "—"
          ? `${panchang.nakshatra} supports focused progress`
          : "Steady, practical movement";
  const action = hasRoutineGap
    ? "Set one small daily practice so guidance has a rhythm to work with."
    : emotion === "anxious"
      ? "Use the Daily Altar for a short grounding practice before big choices."
      : "Ask Jyotish one concrete question and turn the answer into one action.";
  const caution =
    panchang?.rahu_kaal && panchang.rahu_kaal !== "—"
      ? `Avoid starting important commitments during Rahu Kaal (${panchang.rahu_kaal}).`
      : "Do not turn a passing mood into a final decision.";
  const nudge = hasRoutineGap
    ? "No active daily practice is saved yet. Add one gentle anchor."
    : `Your current rhythm looks ${emotion}. Let today's guidance match that pace.`;
  const why = [
    panchang?.nakshatra && panchang.nakshatra !== "—"
      ? `Panchang: ${panchang.nakshatra} nakshatra.`
      : panchangError
        ? "Panchang timing is refreshing."
        : "Panchang is still loading.",
    panchang?.rahu_kaal && panchang.rahu_kaal !== "—"
      ? `Timing: Rahu Kaal is ${panchang.rahu_kaal}.`
      : "Timing: no Rahu Kaal data yet.",
    hasRoutineGap
      ? "Memory: no active routine is saved."
      : `Memory: current state is ${emotion}.`,
  ].join(" ");
  return { energy, action, caution, nudge, why };
}
