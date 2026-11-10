import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { NotebookPen } from "lucide-react";
import type { UserProfile } from "../../types/user";
import { TILE_ACTION_CLASS, TileHead } from "./WeatherTiles";

interface MemoryPanelProps {
  atmanState: UserProfile["atman"] | undefined;
  /** One line about a recent change (SoulInsightCard), shown first. */
  insight?: React.ReactNode;
}

const MOOD_WORDS: Record<string, string> = {
  stable: "Steady",
  spiritual: "Reflective",
  anxious: "Worried",
  chaotic: "Unsettled",
  reactive: "On edge",
};

/** Patterns arrive as strings (older records) or weighted objects. */
function patternText(p: unknown): string {
  if (typeof p === "string") return p;
  if (p && typeof p === "object" && "pattern" in p) {
    const v = (p as { pattern?: unknown }).pattern;
    return typeof v === "string" ? v : "";
  }
  return "";
}

/** "Riya and Mom" / "Riya, Mom and 2 others". */
function listNames(names: string[]): string {
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} other${
    names.length - 2 === 1 ? "" : "s"
  }`;
}

/**
 * What the guide keeps about the user, shown as real examples rather than
 * counts: each row says what is remembered and how it is used, with a
 * plain empty state that says how it fills up.
 */
export const MemoryPanel: React.FC<MemoryPanelProps> = ({
  atmanState,
  insight,
}) => {
  const navigate = useNavigate();

  const rows = useMemo(() => {
    const state = atmanState?.emotionalState;
    const patterns = (atmanState?.knownPatterns ?? [])
      .filter(
        (p) => !(p && typeof p === "object" && "archived" in p && p.archived),
      )
      .map(patternText)
      .filter(Boolean);
    const people = (atmanState?.keyRelationships ?? [])
      .map((r) => r?.name?.trim())
      .filter((n): n is string => Boolean(n));
    const practices = (atmanState?.routines ?? [])
      .filter((r) => r?.status !== "paused")
      .map((r) => r?.title?.trim())
      .filter((t): t is string => Boolean(t));

    return [
      {
        label: "How you've been",
        value: state ? (MOOD_WORDS[state] ?? state.replace(/_/g, " ")) : null,
        use: "Sets the tone of answers: calmer and simpler when things feel heavy.",
        empty: "Not sure yet. It updates as you talk with your guide.",
      },
      {
        label: "Patterns noticed",
        value: patterns.length
          ? `“${patterns[0]}”${patterns.length > 1 ? ` and ${patterns.length - 1} more` : ""}`
          : null,
        use: "Your guide connects new questions to these.",
        empty: "None yet. Repeated themes from your chats appear here.",
      },
      {
        label: "People in your life",
        value: people.length ? listNames(people) : null,
        use: "Used when you ask about relationships.",
        empty: "None yet. Mention someone in chat and they'll be remembered.",
      },
      {
        label: "Your practices",
        value: practices.length ? listNames(practices) : null,
        use: "Your guide checks in on these.",
        empty: "None yet. Accept a practice your guide suggests to add one.",
      },
    ];
  }, [atmanState]);

  return (
    <section>
      <TileHead
        icon={<NotebookPen />}
        action={
          <button
            type="button"
            onClick={() => navigate("/settings#memory")}
            className={TILE_ACTION_CLASS}
          >
            Review and edit
          </button>
        }
      >
        What your guide remembers
      </TileHead>
      <p className="-mt-1 text-[0.9rem] leading-relaxed text-white/60">
        Notes from your conversations, so answers fit your life. You can edit or
        delete any of them.
      </p>

      {insight && <div className="mt-4">{insight}</div>}

      <dl className="mt-4 grid grid-cols-1 gap-x-8 md:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="border-t border-white/8 py-3.5">
            <dt className="text-[0.8rem] font-semibold text-white/55">
              {row.label}
            </dt>
            {row.value ? (
              <>
                <dd className="mt-1 text-[0.98rem] text-white/85">
                  {row.value}
                </dd>
                <dd className="mt-0.5 text-[0.82rem] text-white/50">
                  {row.use}
                </dd>
              </>
            ) : (
              <dd className="mt-1 text-[0.9rem] text-white/55">{row.empty}</dd>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
};
