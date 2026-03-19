import { useState, useEffect, useMemo } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";

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

  const handleDeleteClick = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    setConfirmingDelete(chatId);
  };

  const handleConfirmDelete = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    onDelete(chatId);
    setConfirmingDelete(null);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmingDelete(null);
  };

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats;
    const lowerQuery = searchQuery.toLowerCase();
    return chats.filter((chat) =>
      (chat.title || "Untitled Synthesis").toLowerCase().includes(lowerQuery)
    );
  }, [chats, searchQuery]);

  if (isLoading)
    return (
      <div className="p-4 text-xs uppercase tracking-widest opacity-20">
        Aligning...
      </div>
    );

  return (
    <div className="flex flex-col">
      {/* Search Input */}
      <div className="px-3 py-2 border-b border-white/5">
        <div className="relative">
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search conversations"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 pl-8 text-xs text-white/80 placeholder:text-white/30 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-all"
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              aria-label="Clear search"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Conversations List */}
      {filteredChats.length === 0 ? (
        <div className="p-4 text-xs tracking-widest opacity-20 italic">
          {searchQuery ? "No matching conversations." : "No past conversation."}
        </div>
      ) : (
        <div className="flex flex-col py-2" role="list">
          {filteredChats.map((chat) => (
            <div
              key={chat.id}
              role="listitem"
              className={`group flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-all border-l-2 cursor-pointer ${
                currentId === chat.id
                  ? "border-gold bg-gold/5"
                  : "border-transparent"
              }`}
              onClick={() => onSelect(chat.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-white/80 truncate mb-1">
                  {chat.title || "Untitled Synthesis"}
                </div>
                <div className="text-xs text-white/30 truncate">
                  {chat.lastUpdatedAt?.toDate?.().toLocaleDateString() ||
                    "Recent"}
                </div>
              </div>

              {confirmingDelete === chat.id ? (
                <div className="flex items-center gap-1 animate-in fade-in duration-200">
                  <span className="text-xs text-red-400 mr-1">Delete?</span>
                  <button
                    onClick={(e) => handleConfirmDelete(e, chat.id)}
                    className="p-1 rounded hover:bg-red-500/30 text-red-400 transition-all"
                    aria-label="Confirm delete"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                  <button
                    onClick={handleCancelDelete}
                    className="p-1 rounded hover:bg-white/10 text-white/50 transition-all"
                    aria-label="Cancel delete"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => handleDeleteClick(e, chat.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-all"
                  aria-label="Delete conversation"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
