import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { db } from "../lib/firebase";
import {
  PERSONAS,
  getPersonaById,
  getPersonaAccent,
  type AstrologerPersona,
} from "../lib/personas";
import {
  ArrowUpRight,
  Globe,
  Loader2,
  Search,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Header from "../components/layout/Header";
import { NightSky } from "../components/layout/NightSky";
import { PersonaPortrait } from "../components/consult/PersonaPortrait";
import { TrustProofStrip } from "../components/trust/TrustProofStrip";
import { useSubscription, useTrustSummary, useUserProfile } from "../hooks";
import { useConsciousness } from "../hooks/useConsciousness";
import { getPlatformLanguage } from "../lib/languages";
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

/** Pick guides that fit the user's current inner weather, with the reason why. */
function recommendGuides(
  emotionalState?: string,
): { id: string; reason: string }[] {
  switch (emotionalState) {
    case "anxious":
      return [
        {
          id: "guru-vidyanath",
          reason: "Your rhythm reads anxious — steadying, practice-led counsel",
        },
        {
          id: "dr-shanti",
          reason: "Wellbeing timing for body and mind",
        },
      ];
    case "chaotic":
    case "reactive":
      return [
        {
          id: "tara-kapoor",
          reason: "Sees the pattern beneath turbulent weeks",
        },
        {
          id: "guru-vidyanath",
          reason: "Slow, grounding guidance for a loud mind",
        },
      ];
    case "energetic":
      return [
        {
          id: "arjun-sharma",
          reason: "High momentum — aim it at the right career window",
        },
        {
          id: "ishaan-rao",
          reason: "Business timing while the energy is with you",
        },
      ];
    default:
      return [
        {
          id: "tara-kapoor",
          reason: "Reads the whole chart for recurring life patterns",
        },
        {
          id: "guru-vidyanath",
          reason: "A steady place to begin",
        },
      ];
  }
}

export default function Consult() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { credits, tier } = useSubscription();
  const { profile } = useUserProfile();
  const { atmanState } = useConsciousness();
  const { summary: trustSummary } = useTrustSummary();
  const [filter, setFilter] = useState("All");
  const [languageFilter, setLanguageFilter] = useState("All languages");
  const [search, setSearch] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [openSitting, setOpenSitting] = useState<any | null>(null);

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
        limit(6),
      );
      const snap = await getDocs(q);
      setHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    };
    fetchHistory();
  }, [user]);

  /** Begin directly in the guide's chat, in the user's preferred language. */
  const beginSession = (persona: AstrologerPersona) => {
    if (!user) {
      navigate("/onboarding");
      return;
    }
    const preferred = profile?.language
      ? getPlatformLanguage(profile.language).label
      : "";
    const language = persona.languages.includes(preferred)
      ? preferred
      : persona.languages[0] || "English";
    navigate(
      `/consult/${persona.id}/chat?lang=${encodeURIComponent(language)}`,
    );
  };

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

  const attuned = useMemo(() => {
    if (!user) return [];
    return recommendGuides(atmanState?.emotionalState)
      .map(({ id, reason }) => {
        const persona = getPersonaById(id);
        return persona ? { persona, reason } : null;
      })
      .filter(Boolean) as { persona: AstrologerPersona; reason: string }[];
  }, [user, atmanState?.emotionalState]);

  return (
    <div className="min-h-screen bg-bg-app text-white selection:bg-gold/30">
      <NightSky />
      <Header />

      <main className="container mx-auto pt-28 px-6 pb-16 relative z-10 max-w-6xl">
        {/* ── Masthead ── */}
        <div className="flex items-baseline gap-4 animate-reveal-progressive">
          <p className="text-gold/80 text-[0.65rem] font-bold uppercase tracking-[0.4em]">
            The Circle
          </p>
          <span className="hidden sm:block flex-1 h-px bg-linear-to-r from-gold/25 to-transparent" />
          {user && (
            <button
              onClick={() => navigate("/pricing")}
              className="text-[0.65rem] uppercase tracking-[0.25em] text-white/35 hover:text-gold transition-colors"
            >
              {credits} credits · {tier} — top up
            </button>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-x-12 gap-y-6 items-end animate-reveal-progressive">
          <div>
            <h1 className="font-display leading-[1.05]">
              <span className="block text-2xl md:text-3xl text-white/55 italic">
                Eight guides.
              </span>
              <span className="block text-5xl md:text-6xl text-gold italic mt-1 h-light">
                One chart — yours.
              </span>
            </h1>
          </div>
          <div className="lg:pb-2">
            <p className="text-sm text-white/45 leading-relaxed max-w-md">
              Every guide in the Circle already knows your birth chart, your
              dasha timing, and what you've shared before — no queues, no meters
              running at ₹50 a minute. Choose the voice that fits the question.
            </p>
          </div>
        </div>

        <div className="mt-8">
          <TrustProofStrip />
        </div>

        {/* ── Attuned to you now ── */}
        {attuned.length > 0 && (
          <section className="mt-10 animate-reveal-progressive">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.35em] text-white/25 mb-4">
              Attuned to you now
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {attuned.map(({ persona, reason }) => (
                <button
                  key={persona.id}
                  onClick={() => beginSession(persona)}
                  className="group flex items-center gap-4 text-left rounded-2xl border border-gold/15 bg-gold/3 hover:bg-gold/8 hover:border-gold/30 transition-all p-4"
                >
                  <PersonaPortrait persona={persona} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="font-display italic text-lg text-white/90 leading-tight">
                      {persona.name}
                    </p>
                    <p className="text-xs text-white/40 mt-0.5">{reason}</p>
                  </div>
                  <ArrowUpRight
                    size={15}
                    className="shrink-0 text-gold/0 group-hover:text-gold transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Finding band ── */}
        <section className="mt-10 border-y border-white/8 animate-reveal-progressive">
          <div className="flex flex-col lg:flex-row lg:items-center divide-y lg:divide-y-0 lg:divide-x divide-white/8">
            <label className="relative flex items-center gap-3 px-1 py-3 lg:flex-1">
              <Search size={15} className="text-white/30 shrink-0 ml-1" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Career, love, remedies, timing…"
                className="w-full bg-transparent outline-none text-sm text-white/80 placeholder:text-white/25"
              />
            </label>
            <label className="relative flex items-center gap-2 px-1 lg:px-4 py-3">
              <Globe
                size={14}
                className="text-white/30 shrink-0 ml-1 lg:ml-0"
              />
              <select
                value={languageFilter}
                onChange={(event) => setLanguageFilter(event.target.value)}
                className="bg-transparent outline-none text-sm text-white/55 cursor-pointer"
              >
                {languages.map((language) => (
                  <option
                    key={language}
                    value={language}
                    className="bg-[#111118]"
                  >
                    {language}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-1.5 overflow-x-auto px-1 lg:px-4 py-3 scrollbar-none">
              {SPECIALTIES.map((specialty) => (
                <button
                  key={specialty}
                  onClick={() => setFilter(specialty)}
                  className={`rounded-full px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.15em] whitespace-nowrap transition-all ${
                    filter === specialty
                      ? "bg-gold text-black"
                      : "text-white/35 hover:text-white"
                  }`}
                >
                  {specialty}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── The guides ── */}
        <section className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {visiblePersonas.map((persona) => (
            <GuideCard
              key={persona.id}
              persona={persona}
              trustSummary={trustSummary}
              onBegin={() => beginSession(persona)}
              onDossier={() => navigate(`/consult/${persona.id}/profile`)}
            />
          ))}

          {visiblePersonas.length === 0 && (
            <div className="md:col-span-2 xl:col-span-3 py-16 text-center">
              <p className="font-display italic text-2xl text-white/50">
                No guide matches that search.
              </p>
              <button
                onClick={() => {
                  setSearch("");
                  setFilter("All");
                  setLanguageFilter("All languages");
                }}
                className="mt-5 px-5 py-2.5 rounded-xl border border-gold/30 text-gold text-[0.65rem] font-bold uppercase tracking-[0.2em] hover:bg-gold hover:text-black transition-colors"
              >
                Clear filters
              </button>
            </div>
          )}
        </section>

        {/* ── Past sittings ── */}
        {history.length > 0 && (
          <section className="mt-14 animate-reveal-progressive">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.35em] text-white/25 mb-4">
              Past sittings
            </p>
            <div className="border-t border-white/8">
              {history.map((item) => {
                const persona = getPersonaById(item.personaId);
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 py-3.5 border-b border-white/8"
                  >
                    <button
                      onClick={() => setOpenSitting(item)}
                      className="group flex items-center gap-4 min-w-0 flex-1 text-left"
                      title="Read this sitting again"
                    >
                      {persona ? (
                        <PersonaPortrait persona={persona} size="sm" />
                      ) : (
                        <div className="h-10 w-10 rounded-xl bg-white/10" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white/85 group-hover:text-gold transition-colors">
                          {persona?.name || item.personaName || "Consultation"}
                        </p>
                        <p className="text-xs text-white/35 mt-0.5">
                          {Math.ceil((item.duration || 0) / 60)} min ·{" "}
                          {item.cost || 0} credits · read again
                        </p>
                      </div>
                    </button>
                    {persona && (
                      <button
                        onClick={() => beginSession(persona)}
                        className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-white/30 hover:text-gold transition-colors"
                      >
                        Sit again
                      </button>
                    )}
                    <span className="text-xs text-white/25 w-20 text-right">
                      {item.createdAt?.toDate?.()?.toLocaleDateString() || ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {openSitting && (
        <TranscriptDrawer
          item={openSitting}
          userId={user?.uid || ""}
          onClose={() => setOpenSitting(null)}
          onSitAgain={(persona) => {
            setOpenSitting(null);
            beginSession(persona);
          }}
        />
      )}

      <footer className="container mx-auto max-w-6xl px-6 py-8 border-t border-white/5 relative z-10">
        <p className="text-[0.6rem] uppercase tracking-[0.35em] text-white/20">
          Guidance billed by the minute · charged only when the session closes
        </p>
      </footer>
    </div>
  );
}

function GuideCard({
  persona,
  trustSummary,
  onBegin,
  onDossier,
}: {
  persona: AstrologerPersona;
  trustSummary: PublicTrustSummary | null;
  onBegin: () => void;
  onDossier: () => void;
}) {
  const trustDisplay = getPersonaTrustDisplay(trustSummary, persona.id);
  const accent = getPersonaAccent(persona.id);

  return (
    <article
      className="group relative flex flex-col rounded-3xl border border-white/8 bg-white/3 p-5 transition-all duration-300 hover:bg-white/4 hover:border-white/15"
      style={{ ["--accent" as string]: accent }}
    >
      {/* accent breath on hover */}
      <div
        className="absolute inset-x-0 top-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `linear-gradient(to right, transparent, ${accent}66, transparent)`,
        }}
      />

      <div className="flex items-start gap-4">
        <PersonaPortrait persona={persona} size="lg" />
        <div className="min-w-0 flex-1 pt-1">
          <h3 className="font-display italic text-2xl text-white/95 leading-tight">
            {persona.name}
          </h3>
          <p
            className="text-[0.6rem] font-bold uppercase tracking-[0.25em] mt-1.5"
            style={{ color: accent }}
          >
            {persona.title}
          </p>
          <p className="mt-2 text-[0.65rem] uppercase tracking-[0.15em] text-white/30">
            {persona.languages.join(" · ")}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-display text-2xl text-gold leading-none">
            {persona.pricePerMin}
          </p>
          <p className="text-[0.55rem] uppercase tracking-[0.2em] text-white/30 mt-1">
            cr / min
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm text-white/55 leading-relaxed line-clamp-2">
        {persona.bio}
      </p>

      <div className="mt-3 flex items-center gap-3 text-xs min-h-5">
        <span className="inline-flex items-center gap-1.5 text-emerald-300/90">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Available now
        </span>
        {trustDisplay.hasApprovedReviews ? (
          <>
            <span className="inline-flex items-center gap-1 text-gold">
              <Star size={12} className="fill-current" />
              {trustDisplay.ratingLabel}
            </span>
            <span className="text-white/35">{trustDisplay.reviewLabel}</span>
          </>
        ) : (
          <span className="text-white/25 italic">New to the Circle</span>
        )}
      </div>

      <div className="mt-auto pt-5 flex items-center gap-3">
        <button
          onClick={onBegin}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gold text-black text-[0.65rem] font-bold uppercase tracking-[0.2em] hover:bg-gold/90 transition-colors"
        >
          <Sparkles size={13} />
          Begin session
        </button>
        <button
          onClick={onDossier}
          className="px-4 py-2.5 rounded-xl border border-white/10 text-white/45 text-[0.65rem] font-bold uppercase tracking-[0.2em] hover:text-white hover:border-white/25 transition-colors"
        >
          Dossier
        </button>
      </div>
    </article>
  );
}

interface TranscriptMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

/** A past sitting, reopened: the conversation as it was, plus "sit again". */
function TranscriptDrawer({
  item,
  userId,
  onClose,
  onSitAgain,
}: {
  item: any;
  userId: string;
  onClose: () => void;
  onSitAgain: (persona: AstrologerPersona) => void;
}) {
  const persona = getPersonaById(item.personaId);
  const accent = persona ? getPersonaAccent(persona.id) : "#ffcd6a";
  const [transcript, setTranscript] = useState<TranscriptMessage[] | null>(
    null,
  );

  useEffect(() => {
    if (!userId || !item?.id) return;
    let cancelled = false;
    const load = async () => {
      try {
        const { collection, query, orderBy, getDocs } =
          await import("firebase/firestore");
        const snap = await getDocs(
          query(
            collection(
              db,
              "users",
              userId,
              "consultations",
              item.id,
              "messages",
            ),
            orderBy("timestamp", "asc"),
          ),
        );
        if (cancelled) return;
        setTranscript(
          snap.docs.map(
            (d) => ({ id: d.id, ...d.data() }) as TranscriptMessage,
          ),
        );
      } catch {
        if (!cancelled) setTranscript([]);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [userId, item?.id]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 cursor-default"
        aria-label="Close transcript"
      />
      <aside className="relative h-full w-full max-w-lg bg-[#06060c]/97 backdrop-blur-2xl border-l border-white/10 flex flex-col animate-in slide-in-from-right duration-300">
        <header className="flex items-center gap-4 p-5 border-b border-white/5">
          {persona && <PersonaPortrait persona={persona} size="md" />}
          <div className="min-w-0 flex-1">
            <p className="font-display italic text-xl text-white/95 leading-tight">
              {persona?.name || item.personaName || "Consultation"}
            </p>
            <p className="text-xs text-white/35 mt-0.5">
              {item.createdAt?.toDate?.()?.toLocaleDateString() || ""} ·{" "}
              {Math.ceil((item.duration || 0) / 60)} min · {item.cost || 0}{" "}
              credits
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-white/30 hover:text-gold transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {transcript === null ? (
            <div className="flex items-center justify-center gap-3 py-16 text-white/35">
              <Loader2 size={15} className="animate-spin" />
              <span className="text-xs uppercase tracking-[0.25em]">
                Opening the sitting…
              </span>
            </div>
          ) : transcript.length === 0 ? (
            <p className="py-16 text-center font-display italic text-white/35">
              No transcript was kept for this sitting.
            </p>
          ) : (
            transcript.map((msg) => (
              <div
                key={msg.id}
                className={msg.role === "user" ? "ml-8" : "mr-4"}
              >
                {msg.role === "user" ? (
                  <div className="px-4 py-2.5 rounded-2xl rounded-tr-md bg-gold/8 border border-gold/15 text-white/80 text-sm whitespace-pre-wrap">
                    {msg.content}
                  </div>
                ) : (
                  <div
                    className="pl-4 border-l text-white/75 text-sm"
                    style={{ borderColor: `${accent}55` }}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {persona && (
          <footer className="p-5 border-t border-white/5">
            <button
              onClick={() => onSitAgain(persona)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gold text-black text-[0.65rem] font-bold uppercase tracking-[0.2em] hover:bg-gold/90 transition-colors"
            >
              <Sparkles size={13} />
              Sit with {persona.name.split(" ")[0]} again
            </button>
          </footer>
        )}
      </aside>
    </div>
  );
}
