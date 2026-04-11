import { useParams, useNavigate } from "react-router-dom";
import { getPersonaById } from "../lib/personas";
import { Star, MessageSquare, Globe, ArrowLeft } from "lucide-react";
import Header from "../components/layout/Header";

export default function ConsultProfile() {
  const { personaId } = useParams();
  const navigate = useNavigate();
  const persona = getPersonaById(personaId || "");
  if (!persona) {
    navigate("/consult");
    return null;
  }

  const sampleQuestions: Record<string, string[]> = {
    "guru-vidyanath": [
      "What is my spiritual path?",
      "How can I deepen my meditation?",
      "What karma am I working through?",
    ],
    "arjun-sharma": [
      "Should I change jobs this year?",
      "Is this a good time to invest?",
      "When will my career peak?",
    ],
    "meera-devi": [
      "Is my partner compatible?",
      "When should I get married?",
      "How to heal from heartbreak?",
    ],
    "pandit-raghunath": [
      "Do I have Manglik dosha?",
      "What remedies for Sade Sati?",
      "Best muhurat for new business?",
    ],
    "dr-shanti": [
      "What health issues should I watch?",
      "Best diet for my constitution?",
      "When to schedule surgery?",
    ],
    "nanda-ji": [
      "Good time to buy property?",
      "Best school for my child?",
      "When to plan a family trip?",
    ],
  };

  return (
    <div className="min-h-screen bg-[#030308] text-white">
      <Header />
      <main className="container mx-auto pt-24 px-6 pb-16 max-w-2xl">
        <button
          onClick={() => navigate("/consult")}
          className="flex items-center gap-2 text-white/40 hover:text-white mb-8 text-sm"
        >
          <ArrowLeft size={16} /> All Experts
        </button>

        <div className="text-center mb-8">
          <span className="text-6xl mb-4 block">{persona.avatar}</span>
          <h1 className="text-3xl font-display">{persona.name}</h1>
          <p className="text-white/40">{persona.title}</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <Star size={14} className="text-amber-400 fill-amber-400" />
            <span className="text-sm text-white/60">
              {persona.rating} · {persona.totalConsultations.toLocaleString()}{" "}
              consultations
            </span>
          </div>
        </div>

        <div className="glass rounded-[2rem] p-6 mb-6">
          <p className="text-white/70 leading-relaxed">{persona.bio}</p>
          <div className="flex items-center gap-2 mt-4">
            <Globe size={14} className="text-white/40" />
            {persona.languages.map((l) => (
              <span
                key={l}
                className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/50"
              >
                {l}
              </span>
            ))}
          </div>
        </div>

        <div className="glass rounded-[2rem] p-6 mb-6">
          <h2 className="text-gold text-sm font-bold uppercase tracking-widest mb-4">
            Sample Questions
          </h2>
          <div className="space-y-2">
            {(sampleQuestions[persona.id] || []).map((q, i) => (
              <p key={i} className="text-white/60 text-sm italic">
                "{q}"
              </p>
            ))}
          </div>
        </div>

        <div className="text-center">
          <div className="mb-4">
            <span className="text-3xl font-bold text-gold">
              ₹{persona.pricePerMin}
            </span>
            <span className="text-white/40">/min</span>
          </div>
          <button
            onClick={() => navigate(`/consult/${persona.id}`)}
            className="px-8 py-4 rounded-xl bg-gold text-black font-bold uppercase tracking-widest flex items-center gap-3 mx-auto"
          >
            <MessageSquare size={20} />
            Start Consultation
          </button>
          <p className="text-xs text-white/30 mt-3">
            First 3 minutes free for new users
          </p>
        </div>
      </main>
    </div>
  );
}
