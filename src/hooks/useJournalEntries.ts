import { useCallback, useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";

export interface JournalEntry {
  id: string;
  text: string;
  createdAt: Date | null;
}

/** Longest entry the Firestore rule accepts. */
export const JOURNAL_ENTRY_MAX_CHARS = 4000;
const RECENT_ENTRIES = 20;

/**
 * The user's own journal: users/{uid}/journal. Entries are private writing,
 * saved as written. They are separate from Atman memory, which only ever
 * stores what the user explicitly accepts.
 */
export function useJournalEntries(userId: string | undefined) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, "users", userId, "journal"),
      orderBy("createdAt", "desc"),
      limit(RECENT_ENTRIES),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setEntries(
          snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              text: typeof data.text === "string" ? data.text : "",
              createdAt:
                data.createdAt && typeof data.createdAt.toDate === "function"
                  ? data.createdAt.toDate()
                  : null,
            };
          }),
        );
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error("[Journal] Could not load entries:", err);
        setError("Your saved entries could not be loaded.");
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [userId]);

  const saveEntry = useCallback(
    async (text: string): Promise<boolean> => {
      const trimmed = text.trim().slice(0, JOURNAL_ENTRY_MAX_CHARS);
      if (!userId || !trimmed) return false;
      try {
        await addDoc(collection(db, "users", userId, "journal"), {
          text: trimmed,
          createdAt: serverTimestamp(),
        });
        setError(null);
        return true;
      } catch (err) {
        console.error("[Journal] Could not save entry:", err);
        setError("Your entry could not be saved. Please try again.");
        return false;
      }
    },
    [userId],
  );

  const deleteEntry = useCallback(
    async (entryId: string) => {
      if (!userId) return;
      try {
        await deleteDoc(doc(db, "users", userId, "journal", entryId));
      } catch (err) {
        console.error("[Journal] Could not delete entry:", err);
        setError("That entry could not be deleted. Please try again.");
      }
    },
    [userId],
  );

  return { entries, loading, error, saveEntry, deleteEntry };
}
