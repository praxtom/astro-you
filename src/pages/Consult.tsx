import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { db } from "../lib/firebase";
import {
  PERSONAS,
  getPersonaById,
  type AstrologerPersona,
} from "../lib/personas";
import {
  MessageSquare,
  Globe,
  Search,
  Star,
  Wallet,
} from "lucide-react";
import Header from "../components/layout/Header";
import { PersonaPortrait } from "../components/consult/PersonaPortrait";
import { TrustProofStrip } from "../components/trust/TrustProofStrip";
import { useSubscription, useTrustSummary } from "../hooks";
import {
  getPersonaTrustDisplay,
  type PublicTrustSummary,
} from "../lib/trust-summary";

const SPECIALTIES = [
  "All",
  "Spiritual",
  "Career",
  "Business",
  "Love",
  "Health",
  "Family",
  "Traditional",
];

export default function Consult() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { credits, tier } = useSubscription();
  const { summary: trustSummary } = useTrustSummary();
  const [filter, setFilter] = useState("All");
  const [languageFilter, setLanguageFilter] = useState("All languages");
  const [search, setSearch] = useState("");
  const [history, setHistory] = useState<any[]>([]);

  const languages = useMemo(
    () => [
      "All languages",
      ...Array.from(new Set(PERSONAS.flatMap((persona) => persona.languages))),
    ],
    [],
  );

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

  const visiblePersonas = useMemo(() => {
    const query = search.trim().toLowerCase();
    return PERSONAS.filter((persona) => {
      const matchesFilter =
        filter === "All" ||
        persona.specialty.toLowerCase().includes(filter.toLowerCase());
      const matchesLanguage =
        languageFilter === "All languages" ||
        persona.languages.includes(languageFilter);
      const matchesSearch =
        !query ||
        [
          persona.name,
          persona.title,
          persona.specialty,
          persona.bio,
          ...persona.bestFor,
          ...persona.methods,
          ...persona.languages,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      return matchesFilter && matchesLanguage && matchesSearch;
    });
  }, [filter, languageFilter, search]);

  return (
    <div className="min-h-screen bg-[#030308] text-white">
      <Header />
      <main className="platform-main">
        <section className="grid grid-cols-1 lg:grid-cols-[1fr_20rem] gap-4 items-start mb-4">
          <div>
            <p className="platform-eyebrow mb-2">AI Astrologer Desk</p>
            <h1 className="type-page-title max-w-3xl">
              Focused readings from chart-aware AI astrologers.
            </h1>
            <p className="platform-copy mt-3 max-w-2xl">
              Choose by concern, language, and reading style. Each AI astrologer
              uses your birth profile, dasha context, transit timing, and saved
              guidance history.
            </p>
          </div>

          <aside className="platform-panel p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="type-meta uppercase text-white/35">
                  Available credits
                </p>
                <p className="type-kpi text-white mt-1">
                  {user ? credits : "--"}
                </p>
              </div>
              <Wallet className="text-gold" size={24} />
            </div>
            <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="type-body-sm text-white/45">Plan</span>
                <span className="type-body-sm text-gold capitalize">{tier}</span>
              </div>
              <button
                onClick={() => navigate(user ? "/pricing" : "/onboarding")}
                className="platform-button-primary min-w-28"
              >
                {user ? "Buy credits" : "Start free"}
              </button>
            </div>
          </aside>
        </section>

        <TrustProofStrip className="mb-4" />

        <section className="platform-panel p-2.5 mb-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <label className="relative flex-1">
              <Search
                size={17}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search career, love, remedies, timing..."
                className="platform-field py-2.5 pl-11 pr-4 text-sm placeholder:text-white/25"
              />
            </label>
            <label className="relative min-w-[11rem]">
              <Globe
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
              />
              <select
                value={languageFilter}
                onChange={(event) => setLanguageFilter(event.target.value)}
                className="platform-field appearance-none py-2.5 pl-9 pr-4 text-sm text-white/65"
              >
                {languages.map((language) => (
                  <option key={language} value={language} className="bg-[#111118]">
                    {language}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
              {SPECIALTIES.map((specialty) => (
                <button
                  key={specialty}
                  onClick={() => setFilter(specialty)}
                  className={`rounded-xl px-3 py-2.5 text-xs font-bold uppercase whitespace-nowrap transition-all ${
                    filter === specialty
                      ? "bg-gold text-black"
                      : "border border-white/10 text-white/45 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {specialty}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {visiblePersonas.map((persona) => (
            <PersonaCard
              key={persona.id}
              persona={persona}
              trustSummary={trustSummary}
              onConsult={() => navigate(`/consult/${persona.id}/profile`)}
            />
          ))}

          {visiblePersonas.length === 0 && (
            <div className="platform-panel md:col-span-2 xl:col-span-3 p-4 text-center">
              <p className="text-white/70">No guide matches that search.</p>
              <button
                onClick={() => {
                  setSearch("");
                  setFilter("All");
                  setLanguageFilter("All languages");
                }}
                className="platform-button-secondary mt-4"
              >
                Clear filters
              </button>
            </div>
          )}
        </section>

        {history.length > 0 && (
          <section className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="type-section-title">Past Consultations</h2>
              <span className="type-meta text-white/35">
                {history.length} recent
              </span>
            </div>
            <div className="platform-panel divide-y divide-white/10">
              {history.map((item) => {
                const persona = getPersonaById(item.personaId);
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 p-4"
                  >
                    {persona ? (
                      <PersonaPortrait persona={persona} size="sm" />
                    ) : (
                      <div className="h-10 w-10 rounded-xl bg-white/10" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="type-body-sm text-white/90">
                        {persona?.name || item.personaName || "Consultation"}
                      </p>
                      <p className="type-meta text-white/40">
                        {Math.ceil((item.duration || 0) / 60)} min ·{" "}
                        {item.cost || 0} credits
                      </p>
                    </div>
                    <span className="type-meta text-white/30">
                      {item.createdAt?.toDate?.()?.toLocaleDateString() || ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function PersonaCard({
  persona,
  trustSummary,
  onConsult,
}: {
  persona: AstrologerPersona;
  trustSummary: PublicTrustSummary | null;
  onConsult: () => void;
}) {
  const trustDisplay = getPersonaTrustDisplay(trustSummary, persona.id);

  return (
    <article className="platform-panel p-3 flex flex-col">
      <div className="flex items-start gap-3">
        <PersonaPortrait persona={persona} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="type-card-title text-white">
                {persona.name}
              </h3>
              <p className="type-meta text-white/40">{persona.title}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="type-price text-gold">{persona.pricePerMin}</p>
              <p className="type-meta text-white/30 uppercase">credits/min</p>
            </div>
          </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 type-meta">
            <span className="inline-flex items-center gap-1 text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              Chart-aware session
            </span>
          </div>
        </div>
      </div>

      <p className="mt-3 type-body-sm text-white/50 line-clamp-2">
        {persona.bio}
      </p>
      <div className="mt-3 flex min-h-5 items-center gap-2 type-meta">
        {trustDisplay.hasApprovedReviews ? (
          <>
            <span className="inline-flex items-center gap-1 text-gold">
              <Star size={13} className="fill-current" />
              {trustDisplay.ratingLabel}
            </span>
            <span className="text-white/40">{trustDisplay.reviewLabel}</span>
          </>
        ) : (
          <span className="text-white/35">Collecting reviewed feedback</span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-1.5">
        {persona.bestFor.slice(0, 2).map((item) => (
          <p key={item} className="type-meta text-white/45 truncate">
            {item}
          </p>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 type-meta text-white/35">
        {persona.languages.map((language) => (
          <span key={language} className="rounded-full border border-white/10 px-2 py-1">
            {language}
          </span>
        ))}
      </div>
      <button
        onClick={onConsult}
        className="platform-button-secondary mt-4 w-full border-gold/25 text-gold/90 hover:bg-gold/10"
      >
        <MessageSquare size={16} />
        View profile
      </button>
    </article>
  );
}
