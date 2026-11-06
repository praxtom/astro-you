import { useCallback, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/useAuth";
import { AtmanMemoryControls, normalizeAtmanData } from "../lib/atman";
import type { AtmanData } from "../types/user";

export interface ChatSummaryRecord {
  chatId: string;
  title: string;
  summary: string;
  updatedAt: number | null;
}

/**
 * Live view of everything AstroYou remembers for the signed-in user, plus the
 * memoryPaused flag and per-chat summaries. Unlike useConsciousness this does
 * not default a missing mood to "stable" — we only show what is stored.
 */
export function useMemoryRecord() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [atman, setAtman] = useState<AtmanData | null>(null);
  const [hasMood, setHasMood] = useState(false);
  const [memoryPaused, setMemoryPaused] = useState(false);
  const [summaries, setSummaries] = useState<ChatSummaryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setAtman(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        const data = snap.exists() ? snap.data() : {};
        const raw = data.atman as Partial<AtmanData> | undefined;
        setAtman(normalizeAtmanData(raw) || null);
        setHasMood(
          Boolean(raw?.emotionalState || raw?.transient?.emotionalState),
        );
        setMemoryPaused(data.memoryPaused === true);
        setLoading(false);
      },
      (err) => {
        console.error("[useMemoryRecord] subscription failed:", err);
        setError("Could not load your memory.");
        setLoading(false);
      },
    );
    return () => unsub();
  }, [uid]);

  const reloadSummaries = useCallback(async () => {
    if (!uid) {
      setSummaries([]);
      return;
    }
    try {
      setSummaries(await AtmanMemoryControls.listChatSummaries(uid));
    } catch (err) {
      console.error("[useMemoryRecord] summaries failed:", err);
    }
  }, [uid]);

  useEffect(() => {
    void reloadSummaries();
  }, [reloadSummaries]);

  return {
    uid,
    atman,
    hasMood,
    memoryPaused,
    summaries,
    reloadSummaries,
    loading,
    error,
  };
}
