import { useMemo, useState } from "react";
import { Brain, ChevronDown, Loader2, Trash2, X } from "lucide-react";
import {
  AtmanMemoryControls,
  adviceKey,
  emotionalHistoryKey,
  type MemoryGroup,
  type MemoryItemRef,
} from "../../lib/atman";
import { useMemoryRecord } from "../../hooks/useMemoryRecord";
import type { AtmanEmotion } from "../../types/user";

type GroupId = MemoryGroup | "summaries";

interface MemoryItemView {
  key: string;
  text: string;
  meta?: string;
  ref?: MemoryItemRef;
  chatId?: string;
}

interface MemoryGroupView {
  id: GroupId;
  title: string;
  hint: string;
  items: MemoryItemView[];
}

const FEELING_WORDS: Record<AtmanEmotion, string> = {
  stable: "steady",
  anxious: "anxious",
  chaotic: "scattered",
  depressive: "low",
  energetic: "energised",
  spiritual: "spiritually open",
  reactive: "on edge",
};

const RELATION_WORDS: Record<string, string> = {
  partner: "partner",
  parent: "parent",
  child: "child",
  boss: "boss",
  friend: "friend",
};

const PREVIEW_COUNT = 5;

function formatDate(value: unknown): string | undefined {
  if (!value) return undefined;
  let date: Date;
  if (value instanceof Date) date = value;
  else if (typeof value === "object" && value && "toDate" in value) {
    date = (value as { toDate: () => Date }).toDate();
  } else date = new Date(value as string | number);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function MemoryManager({ compact }: { compact?: boolean }) {
  const {
    uid,
    atman,
    hasMood,
    memoryPaused,
    summaries,
    reloadSummaries,
    loading,
    error,
  } = useMemoryRecord();
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});

  const groups = useMemo<MemoryGroupView[]>(() => {
    if (!atman) {
      return summaries.length ? [summaryGroup(summaries)] : [];
    }
    const feelings: MemoryItemView[] = [];
    if (hasMood && atman.emotionalState) {
      feelings.push({
        key: "current",
        text: `Lately you've seemed ${FEELING_WORDS[atman.emotionalState] ?? atman.emotionalState}`,
        meta: formatDate(atman.lastEmotionalUpdate),
        ref: { group: "feelings", kind: "current" },
      });
    }
    [...(atman.emotionalHistory || [])].reverse().forEach((entry) => {
      const key = emotionalHistoryKey(entry);
      feelings.push({
        key: `h-${key}`,
        text: `Felt ${FEELING_WORDS[entry.state] ?? entry.state}`,
        meta: formatDate(entry.date),
        ref: { group: "feelings", kind: "history", key },
      });
    });

    return [
      {
        id: "feelings",
        title: "How you've been feeling",
        hint: "Moods picked up from your conversations",
        items: feelings,
      },
      {
        id: "patterns",
        title: "Patterns",
        hint: "Themes that keep coming up",
        items: (atman.knownPatterns || []).map((p) => ({
          key: p.id,
          text: p.pattern,
          meta: p.frequency > 1 ? `Mentioned ${p.frequency} times` : undefined,
          ref: { group: "patterns", id: p.id },
        })),
      },
      {
        id: "events",
        title: "Life events",
        hint: "Things happening in your life",
        items: (atman.lifeEvents || atman.activeEvents || []).map((e) => ({
          key: e.id,
          text: e.title,
          meta: e.category,
          ref: { group: "events", id: e.id },
        })),
      },
      {
        id: "people",
        title: "People",
        hint: "People you've mentioned",
        items: (atman.keyRelationships || []).map((r) => ({
          key: r.id,
          text: r.name,
          meta: [RELATION_WORDS[r.relation] ?? r.relation, r.notes]
            .filter(Boolean)
            .join(" · "),
          ref: { group: "people", id: r.id },
        })),
      },
      {
        id: "routines",
        title: "Routines",
        hint: "Practices saved to your Dharma list",
        items: (atman.routines || []).map((r) => ({
          key: r.id,
          text: r.title,
          meta: r.frequency,
          ref: { group: "routines", id: r.id },
        })),
      },
      {
        id: "advice",
        title: "Advice given",
        hint: "Guidance AstroYou offered you",
        items: [...(atman.savedAdvice || [])].reverse().map((a) => {
          const key = adviceKey(a);
          return {
            key,
            text: a.advice,
            meta: [a.context, formatDate(a.date)].filter(Boolean).join(" · "),
            ref: { group: "advice", key },
          };
        }),
      },
      {
        id: "karmicThreads",
        title: "Karmic threads",
        hint: "Connections noticed across parts of your life",
        items: (atman.karmicThreads || []).map((text) => ({
          key: text,
          text,
          ref: { group: "karmicThreads", text },
        })),
      },
      {
        id: "contradictions",
        title: "Shifts noticed",
        hint: "Old patterns you seem to have moved past",
        items: (atman.contradictedPatterns || []).map((text) => ({
          key: text,
          text,
          ref: { group: "contradictions", text },
        })),
      },
      {
        id: "notes",
        title: "Notes from conversations",
        hint: "Short excerpts kept as evidence for the above",
        items: [...(atman.memoryLedger || [])]
          .reverse()
          .filter((entry) => entry.messageExcerpt && entry.surface !== "system")
          .map((entry) => ({
            key: entry.id,
            text: entry.messageExcerpt as string,
            meta: formatDate(entry.createdAt),
            ref: { group: "notes", id: entry.id },
          })),
      },
      summaryGroup(summaries),
    ];
  }, [atman, hasMood, summaries]);

  if (!uid) {
    return (
      <p className="text-xs text-white/60">
        Sign in to see and manage what AstroYou remembers about you.
      </p>
    );
  }

  const run = async (busyKey: string, action: () => Promise<void>) => {
    setBusy(busyKey);
    setActionError(null);
    try {
      await action();
    } catch (err) {
      console.error("[MemoryManager] action failed:", err);
      setActionError(
        busyKey === "pause"
          ? "We couldn't change the memory pause setting. Check your connection and try again."
          : busyKey === "everything"
            ? "We couldn't finish deleting your memories. Check your connection and try again — anything still listed is still saved."
            : busyKey.endsWith(":all")
              ? "We couldn't clear this section. Check your connection and try again — anything still listed is still saved."
              : "We couldn't delete that note. Check your connection and try again.",
      );
    } finally {
      setBusy(null);
    }
  };

  const deleteItem = (group: MemoryGroupView, item: MemoryItemView) =>
    run(`${group.id}:${item.key}`, async () => {
      if (group.id === "summaries" && item.chatId) {
        await AtmanMemoryControls.deleteChatSummary(uid, item.chatId);
        await reloadSummaries();
      } else if (item.ref) {
        await AtmanMemoryControls.forgetItem(uid, item.ref);
      }
    });

  const clearAll = (group: MemoryGroupView) => {
    if (
      !window.confirm(
        `Clear everything under "${group.title}"? This can't be undone.`,
      )
    )
      return;
    void run(`${group.id}:all`, async () => {
      if (group.id === "summaries") {
        await AtmanMemoryControls.clearAllChatSummaries(uid);
        await reloadSummaries();
      } else {
        await AtmanMemoryControls.clearGroup(uid, group.id);
      }
    });
  };

  const forgetEverything = () => {
    if (
      !window.confirm(
        "Forget everything AstroYou has learned about you — feelings, patterns, people, events, routines, advice and conversation summaries? Your chats and birth chart stay. This can't be undone.",
      )
    )
      return;
    void run("everything", async () => {
      await AtmanMemoryControls.forgetEverything(uid);
      await reloadSummaries();
    });
  };

  const togglePause = () =>
    run("pause", () => AtmanMemoryControls.setMemoryPaused(uid, !memoryPaused));

  const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);
  const pad = compact ? "p-3" : "p-4";

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {/* Pause + forget everything */}
      <div className={`rounded-2xl bg-white/5 border border-white/10 ${pad}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-white/80">Pause memory</p>
            <p className="text-xs text-white/60 mt-0.5">
              {memoryPaused
                ? "Paused — new conversations won't be added to memory."
                : "On — AstroYou notes feelings, patterns, people and events from your chats."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={memoryPaused}
            aria-label="Pause memory"
            onClick={() => void togglePause()}
            disabled={busy !== null}
            className={`relative shrink-0 h-6 w-11 rounded-full border transition-colors disabled:opacity-50 ${
              memoryPaused
                ? "bg-gold/80 border-gold"
                : "bg-white/10 border-white/15"
            }`}
          >
            <span
              className={`absolute top-0.5 rounded-full bg-white transition-all ${
                memoryPaused ? "left-[1.375rem]" : "left-0.5"
              }`}
              style={{ height: "1.125rem", width: "1.125rem" }}
            />
          </button>
        </div>
        <button
          type="button"
          onClick={forgetEverything}
          disabled={busy !== null || totalItems === 0}
          className="mt-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-300/70 hover:text-red-300 disabled:opacity-30"
        >
          {busy === "everything" ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Trash2 size={12} />
          )}
          Forget everything
        </button>
      </div>

      {(error || actionError) && (
        <p role="alert" className="text-xs text-red-300/80">
          {actionError || error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-white/60">
          <Loader2 size={12} className="animate-spin" /> Loading memory…
        </div>
      ) : totalItems === 0 ? (
        <div className="flex items-center gap-2 text-xs text-white/60">
          <Brain size={14} className="text-gold/60" />
          Nothing remembered yet.
        </div>
      ) : (
        groups
          .filter((group) => group.items.length > 0)
          .map((group) => {
            const isOpen = expanded[group.id] ?? !compact;
            const visible = showAll[group.id]
              ? group.items
              : group.items.slice(0, PREVIEW_COUNT);
            return (
              <section
                key={group.id}
                className={`rounded-2xl bg-white/5 border border-white/10 ${pad}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((s) => ({ ...s, [group.id]: !isOpen }))
                    }
                    aria-expanded={isOpen}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <ChevronDown
                      size={14}
                      className={`shrink-0 text-white/40 transition-transform ${isOpen ? "" : "-rotate-90"}`}
                    />
                    <span className="text-white/60 text-xs uppercase tracking-widest font-bold truncate">
                      {group.title}
                    </span>
                    <span className="text-xs text-white/55">
                      ({group.items.length})
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => clearAll(group)}
                    disabled={busy !== null}
                    className="shrink-0 min-h-11 text-[0.75rem] font-bold uppercase tracking-widest text-white/60 hover:text-red-300 disabled:opacity-30"
                  >
                    {busy === `${group.id}:all` ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      "Clear all"
                    )}
                  </button>
                </div>
                {isOpen && (
                  <>
                    {!compact && (
                      <p className="mt-1 text-xs text-white/55">{group.hint}</p>
                    )}
                    <ul className="mt-2 space-y-1.5">
                      {visible.map((item) => {
                        const itemBusy = busy === `${group.id}:${item.key}`;
                        return (
                          <li
                            key={item.key}
                            className="flex items-start justify-between gap-2 rounded-xl bg-white/[0.03] px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="text-sm text-white/80 break-words">
                                {item.text}
                              </p>
                              {item.meta && (
                                <p className="text-[0.7rem] text-white/55 mt-0.5">
                                  {item.meta}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => void deleteItem(group, item)}
                              disabled={busy !== null}
                              aria-label={`Forget: ${item.text.slice(0, 60)}`}
                              title="Forget this"
                              className="shrink-0 p-1.5 rounded-lg text-white/55 hover:text-red-300 disabled:opacity-30"
                            >
                              {itemBusy ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <X size={12} />
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    {group.items.length > PREVIEW_COUNT && (
                      <button
                        type="button"
                        onClick={() =>
                          setShowAll((s) => ({
                            ...s,
                            [group.id]: !s[group.id],
                          }))
                        }
                        className="mt-2 text-xs text-gold/70 hover:text-gold"
                      >
                        {showAll[group.id]
                          ? "Show less"
                          : `Show all ${group.items.length}`}
                      </button>
                    )}
                  </>
                )}
              </section>
            );
          })
      )}
    </div>
  );
}

function summaryGroup(
  summaries: Array<{
    chatId: string;
    title: string;
    summary: string;
    updatedAt: number | null;
  }>,
): MemoryGroupView {
  return {
    id: "summaries",
    title: "Conversation summaries",
    hint: "Short recaps used to pick up where you left off",
    items: summaries.map((s) => ({
      key: s.chatId,
      text: s.summary,
      meta: [s.title, formatDate(s.updatedAt)].filter(Boolean).join(" · "),
      chatId: s.chatId,
    })),
  };
}
