import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { UserProfile } from "../../types/user";

interface MemoryPanelProps {
  atmanState: UserProfile["atman"] | undefined;
  hasBirthData: boolean;
}

/**
 * "The Inner Record" — what Atman remembers about the user, with earned
 * marks (badges) and a completion meter for the spiritual profile.
 */
export const MemoryPanel: React.FC<MemoryPanelProps> = ({
  atmanState,
  hasBirthData,
}) => {
  const navigate = useNavigate();

  const stats = useMemo(
    () => [
      {
        label: "State",
        value: atmanState?.emotionalState
          ? atmanState.emotionalState.replace(/_/g, " ")
          : "Learning",
        detail: "Sets the tone of guidance",
      },
      {
        label: "Patterns",
        value: String(atmanState?.knownPatterns?.length ?? 0),
        detail: "Repeated themes noticed",
      },
      {
        label: "People",
        value: String(atmanState?.keyRelationships?.length ?? 0),
        detail: "Relationships remembered",
      },
      {
        label: "Practices",
        value: String(atmanState?.routines?.length ?? 0),
        detail: "Daily anchors saved",
      },
    ],
    [atmanState],
  );

  const badges = useMemo(() => {
    const earned: { id: string; emoji: string; label: string }[] = [];
    if (hasBirthData)
      earned.push({ id: "chart", emoji: "🌟", label: "Chart Generated" });
    if (atmanState?.emotionalState)
      earned.push({ id: "aware", emoji: "🧘", label: "Self-Aware" });
    if (atmanState?.keyRelationships?.length)
      earned.push({ id: "connected", emoji: "💫", label: "Connected" });
    if (atmanState?.routines?.length)
      earned.push({ id: "disciplined", emoji: "🔥", label: "Disciplined" });
    if ((atmanState?.meditationStreak ?? 0) >= 7)
      earned.push({ id: "streak7", emoji: "⚡", label: "7-Day Streak" });
    if ((atmanState?.meditationStreak ?? 0) >= 30)
      earned.push({ id: "streak30", emoji: "👑", label: "30-Day Streak" });
    return earned;
  }, [atmanState, hasBirthData]);

  const completion = useMemo(() => {
    let done = 0;
    const total = 4;
    if (hasBirthData) done++;
    if (atmanState?.routines?.length) done++;
    if (atmanState?.keyRelationships?.length) done++;
    if (atmanState?.emotionalState && atmanState.emotionalState !== "stable")
      done++;
    return Math.round((done / total) * 100);
  }, [atmanState, hasBirthData]);

  return (
    <section className="glass rounded-3xl p-6 animate-reveal-progressive">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-gold/80 text-[0.6rem] font-bold uppercase tracking-[0.35em] mb-1.5">
            The Inner Record
          </p>
          <h3 className="font-display text-xl italic text-white/90">
            What AstroYou remembers
          </h3>
        </div>
        <button
          onClick={() => navigate("/settings")}
          className="shrink-0 text-[0.65rem] font-bold uppercase tracking-[0.15em] text-white/40 hover:text-gold transition-colors"
        >
          Manage
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-px bg-white/8 border border-white/8 rounded-xl overflow-hidden">
        {stats.map((item) => (
          <div key={item.label} className="bg-[#08080f] p-4">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.25em] text-white/30">
              {item.label}
            </p>
            <p className="mt-1 font-display text-2xl capitalize text-white/90 leading-none">
              {item.value}
            </p>
            <p className="mt-1.5 text-[0.65rem] text-white/30">{item.detail}</p>
          </div>
        ))}
      </div>

      {/* Completion meter */}
      <div className="mt-5 flex items-center gap-3">
        <div className="flex-1 h-px bg-white/10 relative">
          <div
            className="absolute inset-y-0 left-0 -my-px h-[3px] bg-linear-to-r from-gold/40 to-gold rounded-full transition-all duration-700"
            style={{ width: `${completion}%` }}
          />
        </div>
        <span className="text-[0.6rem] text-white/30 uppercase tracking-[0.25em]">
          {completion}% attuned
        </span>
      </div>

      {badges.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {badges.map((b) => (
            <span
              key={b.id}
              title={b.label}
              className="px-2.5 py-1 rounded-full border border-white/10 bg-white/3 text-[0.65rem] inline-flex items-center gap-1.5"
            >
              <span>{b.emoji}</span>
              <span className="text-white/45">{b.label}</span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
};
