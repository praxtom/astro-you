import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { StatusNotice } from "../ui/StatusNotice";
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
  const [loadFailed, setLoadFailed] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, "users", userId, "chats"),
      orderBy("lastUpdatedAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setChats(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setLoadFailed(false);
        setIsLoading(false);
      },
      (err) => {
        // Without this the panel sat on its loading line forever.
        console.error("Could not load conversations:", err);
        setLoadFailed(true);
        setIsLoading(false);
      },
    );

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
      <div className="p-4 text-xs text-white/55" role="status">
        Loading conversations…
      </div>
    );

  if (loadFailed)
    return (
      <StatusNotice
        size="section"
        className="m-3"
        message="Your past conversations could not be loaded. Refresh the page to try again."
      />
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
