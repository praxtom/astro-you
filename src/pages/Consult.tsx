import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { db } from "../lib/firebase";
import {
  PERSONAS,
  getPersonaById,
  type AstrologerPersona,
} from "../lib/personas";
import { Star, MessageSquare } from "lucide-react";
import Header from "../components/layout/Header";

const SPECIALTIES = [
  "All",
  "Spiritual",
  "Career",
  "Love",
  "Health",
  "Family",
  "Traditional",
];

export default function Consult() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filter, setFilter] = useState("All");
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchHistory = async () => {
      const { collection, query, orderBy, limit, getDocs } =
        await import("firebase/firestore");
      const q = query(
        collection(db, "users", user.uid, "consultations"),
        orderBy("createdAt", "desc"),
        limit(10),
      );
      const snap = await getDocs(q);
      setHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    };
    fetchHistory();
  }, [user]);

  const filtered =
    filter === "All"
      ? PERSONAS
      : PERSONAS.filter((p) =>
          p.specialty.toLowerCase().includes(filter.toLowerCase()),
        );

  return (
    <div className="min-h-screen bg-[#030308] text-white">
      <Header />
      <main className="container mx-auto pt-24 px-6 pb-12">
        <h1 className="text-3xl md:text-4xl font-display mb-2">
          Consult an Expert
        </h1>
        <p className="text-white/50 mb-8">
          AI-powered Vedic astrologers. Always online. From ₹5/min.
        </p>

        {/* Filter pills */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {SPECIALTIES.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all
                                ${filter === s ? "bg-gold/10 border-gold/50 text-gold border" : "bg-white/5 border-white/10 text-white/40 border hover:border-white/30"}`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Persona grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((persona) => (
            <PersonaCard
              key={persona.id}
              persona={persona}
              onConsult={() => navigate(`/consult/${persona.id}/profile`)}
            />
          ))}
        </div>

        {/* Past consultations */}
        {history.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-display mb-4 text-white/80">
              Past Consultations
            </h2>
            <div className="space-y-3">
              {history.map((h) => {
                const p = getPersonaById(h.personaId);
                return (
                  <div
                    key={h.id}
                    className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10"
                  >
                    <span className="text-2xl">{p?.avatar || "🔮"}</span>
                    <div className="flex-1">
                      <p className="text-sm text-white/90">
                        {p?.name || h.personaName}
                      </p>
                      <p className="text-xs text-white/40">
                        {Math.ceil(h.duration / 60)} min &middot; ₹{h.cost}
                      </p>
                    </div>
                    <span className="text-xs text-white/30">
                      {h.createdAt?.toDate?.()?.toLocaleDateString() || ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function PersonaCard({
  persona,
  onConsult,
}: {
  persona: AstrologerPersona;
  onConsult: () => void;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 hover:border-gold/20 transition-all group">
      <div className="flex items-start gap-4 mb-4">
        <div className="text-4xl">{persona.avatar}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-semibold">{persona.name}</h3>
            <span
              className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"
              title="Online"
            />
          </div>
          <p className="text-white/40 text-xs">{persona.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <Star size={12} className="text-amber-400 fill-amber-400" />
            <span className="text-xs text-white/60">
              {persona.rating} ({persona.totalConsultations.toLocaleString()})
            </span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-gold font-bold">₹{persona.pricePerMin}</span>
          <span className="text-white/30 text-xs">/min</span>
        </div>
      </div>
      <p className="text-white/50 text-sm mb-4 line-clamp-2">{persona.bio}</p>
      <div className="flex items-center gap-2 mb-4">
        {persona.languages.map((l) => (
          <span
            key={l}
            className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40"
          >
            {l}
          </span>
        ))}
      </div>
      <button
        onClick={onConsult}
        className="w-full py-3 rounded-xl bg-gold text-black font-bold text-sm uppercase tracking-widest hover:bg-gold/90 transition-colors flex items-center justify-center gap-2"
      >
        <MessageSquare size={16} />
        Start Consultation
      </button>
    </div>
  );
}
