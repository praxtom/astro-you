import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  Search,
  UserPlus,
  Users,
  X,
  Check,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import Header from "../components/layout/Header";

interface Friend {
  id: string;
  friendUid: string;
  friendName: string;
  friendUsername: string;
  status: "pending" | "accepted";
  createdAt: any;
}

export default function Friends() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([]);

  // Subscribe to friends list
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "friends"));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Friend);
      setFriends(all.filter((f) => f.status === "accepted"));
      setPendingRequests(all.filter((f) => f.status === "pending"));
    });
    return () => unsub();
  }, [user]);

  const searchUsers = async () => {
    if (!searchQuery.trim() || searchQuery.length < 3) return;
    setSearching(true);
    try {
      const q = query(
        collection(db, "users"),
        where("profile.username", "==", searchQuery.trim().toLowerCase()),
      );
      const snap = await getDocs(q);
      setSearchResults(
        snap.docs.map((d) => ({ uid: d.id, ...d.data().profile })),
      );
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  };

  const sendRequest = async (
    targetUid: string,
    targetName: string,
    targetUsername: string,
  ) => {
    if (!user) return;
    await addDoc(collection(db, "users", user.uid, "friends"), {
      friendUid: targetUid,
      friendName: targetName,
      friendUsername: targetUsername,
      status: "pending",
      createdAt: serverTimestamp(),
    });
    // Also add reverse entry for the target user
    await addDoc(collection(db, "users", targetUid, "friends"), {
      friendUid: user.uid,
      friendName: "You",
      friendUsername: "",
      status: "pending",
      createdAt: serverTimestamp(),
    });
  };

  const removeFriend = async (friendDocId: string) => {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "friends", friendDocId));
  };

  if (!user) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-[#030308] text-white">
      <Header />
      <main className="container mx-auto pt-24 px-6 pb-16 max-w-2xl">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 text-white/40 hover:text-white mb-6 text-sm"
        >
          <ArrowLeft size={16} /> Dashboard
        </button>
        <h1 className="text-3xl font-display mb-8 flex items-center gap-3">
          <Users size={28} className="text-gold" /> Friends
        </h1>

        {/* Search */}
        <div className="flex gap-2 mb-8">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchUsers()}
            placeholder="Search by username..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold/50"
          />
          <button
            onClick={searchUsers}
            disabled={searching}
            className="px-4 py-3 rounded-xl bg-gold text-black font-bold"
          >
            {searching ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Search size={16} />
            )}
          </button>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mb-8 space-y-2">
            <h2 className="text-xs text-white/40 uppercase tracking-widest mb-2">
              Search Results
            </h2>
            {searchResults.map((u) => (
              <div
                key={u.uid}
                className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10"
              >
                <div>
                  <p className="text-sm text-white/90">{u.name}</p>
                  <p className="text-xs text-white/40">@{u.username}</p>
                </div>
                <button
                  onClick={() => sendRequest(u.uid, u.name, u.username)}
                  className="p-2 rounded-lg bg-gold/10 text-gold hover:bg-gold/20"
                >
                  <UserPlus size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xs text-white/40 uppercase tracking-widest mb-3">
              Pending
            </h2>
            <div className="space-y-2">
              {pendingRequests.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-amber-500/5 border border-amber-500/20"
                >
                  <p className="text-sm text-white/70">
                    {f.friendName} (@{f.friendUsername})
                  </p>
                  <span className="text-xs text-amber-400">Pending</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Friends List */}
        <h2 className="text-xs text-white/40 uppercase tracking-widest mb-3">
          Your Friends ({friends.length})
        </h2>
        {friends.length === 0 ? (
          <p className="text-white/30 text-sm text-center py-8">
            No friends yet. Search by username to connect!
          </p>
        ) : (
          <div className="space-y-2">
            {friends.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center text-lg">
                    {f.friendName?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <p className="text-sm text-white/90">{f.friendName}</p>
                    <p className="text-xs text-white/40">@{f.friendUsername}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/u/${f.friendUsername}`)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 text-white/40 text-xs hover:text-gold"
                  >
                    View
                  </button>
                  <button
                    onClick={() =>
                      navigate(`/compatibility?partner=${f.friendUsername}`)
                    }
                    className="px-3 py-1.5 rounded-lg bg-gold/10 text-gold text-xs hover:bg-gold/20"
                  >
                    Compare
                  </button>
                  <button
                    onClick={() => removeFriend(f.id)}
                    className="p-1.5 rounded-lg text-white/20 hover:text-red-400"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
