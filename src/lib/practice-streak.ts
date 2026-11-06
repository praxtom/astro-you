import { doc, runTransaction } from "firebase/firestore";
import { db } from "./firebase";
import { DATE_KEY_RE } from "./local-date";
import { viewerDateKey } from "./viewer-timezone";

/**
 * Daily practice streak (breathing / meditation).
 *
 * Stored on the user doc next to the rest of Atman:
 *   atman.meditationStreak  — consecutive local days with at least one session
 *   atman.lastPracticeDate  — the viewer's local day of the last session (YYYY-MM-DD)
 *
 * Rules: a second session on the same day leaves the streak unchanged, a
 * session on the day after `lastPracticeDate` extends it, and anything else
 * (a skipped day, missing/corrupt data) restarts it at 1.
 */

/** The calendar day before a YYYY-MM-DD key (pure date arithmetic, DST-safe). */
export function previousDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  return prev.toISOString().slice(0, 10);
}

/** Pure streak transition — exported so it can be unit-tested without Firestore. */
export function nextPracticeStreak(
  currentStreak: unknown,
  lastPracticeDate: unknown,
  today: string,
): number {
  const streak =
    typeof currentStreak === "number" && Number.isFinite(currentStreak)
      ? Math.max(0, Math.floor(currentStreak))
      : 0;
  if (
    typeof lastPracticeDate !== "string" ||
    !DATE_KEY_RE.test(lastPracticeDate)
  ) {
    return 1;
  }
  if (lastPracticeDate === today) return Math.max(1, streak);
  if (lastPracticeDate === previousDateKey(today)) return streak + 1;
  return 1;
}

/**
 * Record a completed practice session for a signed-in user. Guests are a
 * no-op (pass a null uid). Never throws — a streak write must not break the
 * calm moment that triggered it. Returns the new streak, or null on skip/failure.
 */
export async function recordPracticeSession(
  uid: string | null | undefined,
): Promise<number | null> {
  if (!uid) return null;
  const today = viewerDateKey();
  try {
    return await runTransaction(db, async (tx) => {
      const ref = doc(db, "users", uid);
      const snap = await tx.get(ref);
      if (!snap.exists()) return null;
      const atman = (snap.data().atman ?? {}) as {
        meditationStreak?: unknown;
        lastPracticeDate?: unknown;
      };
      const streak = nextPracticeStreak(
        atman.meditationStreak,
        atman.lastPracticeDate,
        today,
      );
      tx.update(ref, {
        "atman.meditationStreak": streak,
        "atman.lastPracticeDate": today,
      });
      return streak;
    });
  } catch (error) {
    console.error("[PracticeStreak] Failed to record session:", error);
    return null;
  }
}
