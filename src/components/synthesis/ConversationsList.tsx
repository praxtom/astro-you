import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { ConversationListView } from "./ConversationsListView";

interface ConversationsListProps {
  userId: string;
  currentId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function ConversationsList({
  userId,
  currentId,
  onSelect,
  onDelete,
}: ConversationsListProps) {
  const [chats, setChats] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, "users", userId, "chats"),
      orderBy("lastUpdatedAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setChats(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const handleDeleteClick = (chatId: string) => {
    setConfirmingDelete(chatId);
  };

  const handleConfirmDelete = (chatId: string) => {
    onDelete(chatId);
    setConfirmingDelete(null);
  };

  const handleCancelDelete = () => {
    setConfirmingDelete(null);
  };

  if (isLoading)
    return (
      <div
        className="p-4 text-xs uppercase tracking-widest opacity-20"
        role="status"
        aria-live="polite"
      >
        Aligning…
      </div>
    );

  return (
    <ConversationListView
      chats={chats}
      currentId={currentId}
      searchQuery={searchQuery}
      searchOpen={searchOpen}
      collapsed={collapsed}
      confirmingDelete={confirmingDelete}
      onSearchChange={setSearchQuery}
      onToggleSearch={() => {
        setSearchOpen((open) => !open);
        if (searchOpen) setSearchQuery("");
      }}
      onToggleCollapsed={() => setCollapsed((value) => !value)}
      onSelect={onSelect}
      onDeleteClick={handleDeleteClick}
      onConfirmDelete={handleConfirmDelete}
      onCancelDelete={handleCancelDelete}
    />
  );
}
