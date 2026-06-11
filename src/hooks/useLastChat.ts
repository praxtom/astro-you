import { useState, useEffect } from "react";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/useAuth";

export interface LastChat {
  chatId: string;
  title: string;
}

/**
 * Most recently updated chat for the signed-in user.
 * Fails silently — callers fall back to "start a conversation" UI.
 */
export function useLastChat() {
  const { user } = useAuth();
  const [lastChat, setLastChat] = useState<LastChat | null>(null);

  useEffect(() => {
    if (!user) {
      setLastChat(null);
      return;
    }
    let cancelled = false;

    const fetchLastChat = async () => {
      try {
        const chatsRef = collection(db, "users", user.uid, "chats");
        const q = query(chatsRef, orderBy("updatedAt", "desc"), limit(1));
        const snap = await getDocs(q);
        if (cancelled || snap.empty) return;
        const doc = snap.docs[0];
        setLastChat({ chatId: doc.id, title: doc.data().title || "Untitled" });
      } catch {
        // Silently fail — UI falls back to "Start a conversation"
      }
    };

    fetchLastChat();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return lastChat;
}
