import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import AuthModal from "../components/AuthModal";
import { postJson } from "../lib/apiFetch";
import {
  Heart,
  Sparkles,
  ChevronRight,
  User,
  Speech,
  Zap,
  Clock,
  ShieldCheck,
  Target,
  BookOpen,
  Star,
  Share2,
  Download,
  Users,
  UserPlus,
  X,
} from "lucide-react";
import { PageShell } from "../components/layout/PageShell";
import {
  AskJyotishBridge,
  COMPATIBILITY_CONTEXT_KEY,
} from "../components/layout/AskJyotishBridge";
import { InnerCircleManager } from "../components/sadhana/InnerCircleManager";
import { useConsciousness, useUserProfile } from "../hooks";
import type { KeyRelationship } from "../types/user";
import { useAuth } from "../lib/useAuth";
import LocationInput from "../components/LocationInput";
import { viewerDateKey } from "../lib/viewer-timezone";
import { GlossaryTerm } from "../components/ui/GlossaryTerm";

interface LoveInfluence {
  sign: string;
  house: number | string;
  expression?: string;
  emotional_needs?: string;
  passion_style?: string;
  gift_giving_style?: string;
  comfort_style?: string;
  conflict_approach?: string;
}

interface MatchResult {
  overall_score: number;
  compatibility_score: number;
  report_title?: string;
  compatibility?: {
    overall_score: number;
    breakdown: Record<string, number>;
    interpretation: string;
  };
  synastry: {
    emotional_connection?: number;
    communication_style?: number;
    physical_attraction?: number;
    long_term_potential?: number;
    key_aspects?: string[];
    subjects_summary?: any;
  };
  composite: {
    relationship_purpose: string;
    strengths: string[];
    challenges: string[];
    sun_sign?: string;
    moon_sign?: string;
    venus_sign?: string;
  };
  love_languages?: {
    person1?: {
      primary_love_language?: string;
      secondary_love_language?: string;
      receiving_style?: string;
      venus_influence?: LoveInfluence;
      moon_influence?: LoveInfluence;
      mars_influence?: LoveInfluence;
      compatibility_tips?: string[];
      romantic_tendencies?: string[];
    };
    person2?: {
      primary_love_language?: string;
      secondary_love_language?: string;
      receiving_style?: string;
      venus_influence?: LoveInfluence;
      moon_influence?: LoveInfluence;
      mars_influence?: LoveInfluence;
      compatibility_tips?: string[];
      romantic_tendencies?: string[];
    };
  };
  dynamics?: {
    relationship_type?: { type: string; interpretation: string };
    power_dynamics?: { balance: string; interpretation: string };
    emotional_connection?: { strength: string; interpretation: string };
    communication_style?: { style: string; interpretation: string };
    long_term_potential?: { potential: string; interpretation: string };
  };
  sections?: {
    title: string;
    interpretations: { factor: string; text: string }[];
  }[];
  interpretations?: {
    title: string;
    text: string;
  }[];
  aiNarrative?: string;
  vedicMatching?: {
    total_score?: number;
    score?: number;
    gunas?: {
      name: string;
      score?: number;
      obtained?: number;
      max_score?: number;
      maximum?: number;
      description?: string;
      interpretation?: string;
    }[];
    aspects?: {
      name: string;
      score?: number;
      obtained?: number;
      max_score?: number;
      maximum?: number;
      description?: string;
      interpretation?: string;
    }[];
    kutas?: {
      name: string;
      score?: number;
      obtained?: number;
      max?: number;
      max_score?: number;
      maximum?: number;
      description?: string;
      interpretation?: string;
    }[];
    manglik_male?: boolean | { is_manglik: boolean; description?: string };
    manglik_female?: boolean | { is_manglik: boolean; description?: string };
    groom_manglik?: boolean | { is_manglik: boolean; description?: string };
    bride_manglik?: boolean | { is_manglik: boolean; description?: string };
    // Server-mapped onto the people as entered (groom/bride slots are chosen
    // by gender server-side, so they no longer imply entry order).
    personA_manglik?: boolean | { is_manglik: boolean; description?: string };
    personB_manglik?: boolean | { is_manglik: boolean; description?: string };
  };
  /** True when genders didn't give a groom/bride pair and entry order was used. */
  orientationAssumed?: boolean;
  personA?: { name?: string };
  personB?: { name?: string };
}

// Max points lookup for the compatibility breakdown (Sums to 100)
const BREAKDOWN_MAX_POINTS: Record<string, number> = {
  sun_moon: 15,
  mercury: 10,
  attraction: 10,
  saturn: 10,
  elements: 10,
  aspects: 40,
  house_overlays: 5,
};

const normalizeScore = (value: number, key: string) => {
  const max = BREAKDOWN_MAX_POINTS[key] || 10; // Fallback to 10 if unknown
  return Math.round((value / max) * 100);
};

type ManglikField = NonNullable<MatchResult["vedicMatching"]>["manglik_male"];

function readManglik(data: ManglikField): boolean | null {
  if (data === undefined || data === null) return null;
  return typeof data === "object" ? Boolean(data.is_manglik) : data === true;
}

/** Score at or above which we offer to share the number itself. */
const SHAREABLE_SCORE = 70;

/**
 * Compact, plain-text summary of a match for the chat (≤1500 chars).
 * The chat client forwards it; the server injects it as context so the guide
 * answers about THIS match instead of asking the user to repeat it.
 */
function buildCompatibilitySummary(
  result: MatchResult,
  seekerName: string,
  partnerName: string,
): string {
  const partnerFirst = partnerName.trim().split(/\s+/)[0] || "Partner";
  const seekerFirst = seekerName.trim().split(/\s+/)[0] || "Seeker";
  const lines: string[] = [
    `Compatibility match just run between ${seekerFirst} (the user) and ${partnerFirst}.`,
  ];
  const synastry = result.overall_score || result.compatibility_score;
  if (typeof synastry === "number" && synastry > 0) {
    lines.push(`Synastry harmony index: ${synastry}%.`);
  }
  const vm = result.vedicMatching;
  if (vm) {
    const guna = vm.total_score ?? vm.score;
    if (typeof guna === "number") {
      lines.push(`Guna Milan: ${guna}/36 (${getGunaQuality(guna).label}).`);
    }
    const a = readManglik(
      vm.personA_manglik ?? vm.manglik_male ?? vm.groom_manglik,
    );
    const b = readManglik(
      vm.personB_manglik ?? vm.manglik_female ?? vm.bride_manglik,
    );
    const fmt = (v: boolean | null) =>
      v === null ? "unknown" : v ? "Manglik" : "not Manglik";
    if (a !== null || b !== null) {
      lines.push(
        `Manglik: ${seekerFirst} ${fmt(a)}; ${partnerFirst} ${fmt(b)}.`,
      );
    }
  }
  const strengths = (result.composite?.strengths || []).slice(0, 3);
  const frictions = (result.composite?.challenges || []).slice(0, 3);
  if (strengths.length) lines.push(`Top strengths: ${strengths.join("; ")}.`);
  if (frictions.length) lines.push(`Main frictions: ${frictions.join("; ")}.`);
  if (result.composite?.relationship_purpose) {
    lines.push(`Composite theme: ${result.composite.relationship_purpose}.`);
  }
  return lines.join("\n").slice(0, 1500);
}

/** Credits a compatibility match costs (server: feature-credits.ts). */
const COMPATIBILITY_CREDIT_COST = 5;

export default function Compatibility() {
  const { user } = useAuth();
  const { birthData, loading: profileLoading } = useUserProfile();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [needsCredits, setNeedsCredits] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [partnerData, setPartnerData] = useState<{
    name: string;
    dob: string;
    tob: string;
    pob: string;
    gender: "" | "male" | "female" | "other";
  }>({
    name: "",
    dob: "",
    tob: "",
    pob: "",
    gender: "",
  });

  const [seekerCoords, setSeekerCoords] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [partnerCoords, setPartnerCoords] = useState<{
    lat: number;
    lon: number;
  } | null>(null);

  const [isMatching, setIsMatching] = useState(false);
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  // Set when the seeker's birth time is unknown and noon was used: the Moon
  // can change nakshatra within a day, and Ashtakoot is Moon-based.
  const [timeAssumed, setTimeAssumed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { atmanState, refreshAtman } = useConsciousness();
  const [circleOpen, setCircleOpen] = useState(false);
  const [circleDraft, setCircleDraft] = useState<
    Partial<Omit<KeyRelationship, "id">> | undefined
  >(undefined);

  const openCircle = (draft?: Partial<Omit<KeyRelationship, "id">>) => {
    setCircleDraft(draft);
    setCircleOpen(true);
  };

  const partnerAlreadyInCircle = Boolean(
    partnerData.name.trim() &&
    atmanState?.keyRelationships?.some(
      (rel) =>
        rel.name.trim().toLowerCase() === partnerData.name.trim().toLowerCase(),
    ),
  );

  // Auto-set seeker coords from birthData if available
  useEffect(() => {
    if (birthData?.coordinates?.lat && birthData?.coordinates?.lng) {
      setSeekerCoords({
        lat: Number(birthData.coordinates.lat),
        lon: Number(birthData.coordinates.lng),
      });
    }
  }, [birthData]);

  // Close the Inner Circle dialog on Escape.
  useEffect(() => {
    if (!circleOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCircleOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [circleOpen]);

  const handleMatch = async () => {
    setNeedsCredits(false);
    setNeedsProfile(false);
    if (!user) {
      setError(null);
      setShowAuthModal(true);
      return;
    }
    if (!birthData?.dob) {
      setError(null);
      setNeedsProfile(true);
      return;
    }

    // No birth-place fallback. This used to default to "Mumbai, India", which
    // silently cast the user's own chart in the wrong city — a confidently
    // wrong reading is worse than refusing to run.
    if (!birthData.pob) {
      setError(
        "Add your birth place in Settings before running a compatibility " +
          "match. An accurate chart needs the birth location, and guessing " +
          "it would produce a confidently wrong reading.",
      );
      return;
    }

    setIsMatching(true);
    setError(null);

    try {
      const response = await postJson("/api/compatibility", {
        localDate: viewerDateKey(),
        personA: {
          name: birthData.name || "Seeker",
          dob: birthData.dob,
          tob: birthData.tob || "12:00",
          pob: birthData.pob,
          // Gender picks the groom/bride slot for Ashtakoot server-side.
          gender: birthData.gender || undefined,
          lat: seekerCoords?.lat,
          lng: seekerCoords?.lon,
        },
        personB: {
          ...partnerData,
          gender: partnerData.gender || undefined,
          lat: partnerCoords?.lat,
          lng: partnerCoords?.lon,
        },
      });

      if (response.status === 401 || response.status === 403) {
        setShowAuthModal(true);
        return;
      }
      if (response.status === 402) {
        setNeedsCredits(true);
        setError(
          `A compatibility match costs ${COMPATIBILITY_CREDIT_COST} credits and your balance is too low. Top up your wallet to continue.`,
        );
        return;
      }
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || data.error) {
        if (response.status === 400 && typeof data?.error === "string") {
          // Input validation messages from the server are written for users.
          throw new UserFacingError(data.error);
        }
        throw new Error(
          `Compatibility failed: ${response.status} ${data?.error ?? ""}`,
        );
      }
      setTimeAssumed(!birthData.tob);
      setMatchResult(data);
    } catch (err: any) {
      console.error("Compatibility match failed:", err);
      setError(
        err instanceof UserFacingError
          ? err.message
          : "We couldn't calculate this match. Check your connection and try again.",
      );
    } finally {
      setIsMatching(false);
    }
  };

  const downloadCompatibilityReport = async () => {
    if (!user || !matchResult) return;
    setIsDownloadingReport(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/pdf-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          reportType: "compatibility",
          birthData,
          compatibilityData: matchResult,
          person1Name: birthData?.name || "Seeker",
          person2Name: partnerData.name || "Partner",
        }),
      });
      const errorPayload = response.ok
        ? null
        : await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 402) {
          throw new UserFacingError(
            "Your balance is too low for this PDF report. Top up your wallet to continue.",
          );
        }
        throw new Error(
          `Compatibility report failed: ${response.status} ${errorPayload?.error ?? ""}`,
        );
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      // UTC is fine here: this is only a download filename.
      anchor.download = `astroyou-compatibility-report-${new Date().toISOString().split("T")[0]}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Compatibility report error:", err);
      setError(
        err instanceof UserFacingError
          ? err.message
          : "We couldn't generate the PDF report. Check your connection and try again.",
      );
    } finally {
      setIsDownloadingReport(false);
    }
  };

  return (
    <PageShell wide>
      <div>
        <header className="max-w-4xl mx-auto text-center mb-6">
          <div className="flex items-center justify-center gap-2 text-gold/60 mb-2 font-display tracking-[0.2em] uppercase text-sm">
            <Heart size={16} className="text-gold" />
            Relationship Insights
          </div>
          <h1 className="type-page-title mb-3">
            Celestial <span className="text-gold italic">Synchronicity</span>
          </h1>
          <p className="text-white/60 font-sans text-base font-light max-w-2xl mx-auto italic">
            A professional-grade synthesis of Synastry and Composite dynamics to
            reveal the soul-level blueprint of your connection.
          </p>
          {user && (
            <button
              onClick={() => openCircle()}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/60 transition hover:border-gold/30 hover:text-gold"
            >
              <Users size={14} />
              Your Inner Circle
              {atmanState?.keyRelationships?.length ? (
                <span className="text-white/35">
                  ({atmanState.keyRelationships.length})
                </span>
              ) : null}
            </button>
          )}
        </header>

        {!matchResult ? (
          <div className="max-w-2xl mx-auto glass p-4 rounded-2xl border-white/5 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 text-white/5 pointer-events-none">
              <Sparkles size={120} />
            </div>

            <h2 className="text-xl font-bold mb-3 flex items-center gap-3 relative z-10">
              <div className="p-2 rounded-lg bg-gold/10">
                <User size={20} className="text-gold" />
              </div>
              Partner Details
            </h2>

            <div className="space-y-3 relative z-10">
              <div className="space-y-1.5">
                <label
                  htmlFor="partner-name"
                  className="text-xs uppercase tracking-widest text-white/60 font-black ml-1"
                >
                  Full Name
                </label>
                <input
                  id="partner-name"
                  type="text"
                  value={partnerData.name}
                  onChange={(e) =>
                    setPartnerData({ ...partnerData, name: e.target.value })
                  }
                  placeholder="Partner's Name"
                  className="platform-field text-white placeholder:text-white/40"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="partner-dob"
                    className="text-xs uppercase tracking-widest text-white/60 font-black ml-1"
                  >
                    Date of Birth
                  </label>
                  <input
                    id="partner-dob"
                    type="date"
                    value={partnerData.dob}
                    onChange={(e) =>
                      setPartnerData({ ...partnerData, dob: e.target.value })
                    }
                    className="platform-field text-white [color-scheme:dark]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="partner-tob"
                    className="text-xs uppercase tracking-widest text-white/60 font-black ml-1"
                  >
                    Time of Birth
                  </label>
                  <input
                    id="partner-tob"
                    type="time"
                    value={partnerData.tob}
                    onChange={(e) =>
                      setPartnerData({ ...partnerData, tob: e.target.value })
                    }
                    className="platform-field text-white [color-scheme:dark]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="partner-gender"
                  className="text-xs uppercase tracking-widest text-white/60 font-black ml-1"
                >
                  Gender
                </label>
                <select
                  id="partner-gender"
                  value={partnerData.gender}
                  onChange={(e) =>
                    setPartnerData({
                      ...partnerData,
                      gender: e.target.value as typeof partnerData.gender,
                    })
                  }
                  className="platform-field text-white [color-scheme:dark]"
                >
                  <option value="">Prefer not to say</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="partner-pob"
                  className="text-xs uppercase tracking-widest text-white/60 font-black ml-1"
                >
                  Place of Birth
                </label>
                <LocationInput
                  inputId="partner-pob"
                  size="field"
                  value={partnerData.pob}
                  onChange={(val) =>
                    setPartnerData({ ...partnerData, pob: val })
                  }
                  onSelect={(suggestion) =>
                    setPartnerCoords({
                      lat: Number(suggestion.lat),
                      lon: Number(suggestion.lon),
                    })
                  }
                  placeholder="City of Birth"
                  className="w-full"
                />
              </div>

              {!profileLoading && !user && (
                <p className="text-sm text-white/60">
                  Sign in to run a match. Your own birth chart is the other
                  half of the comparison.
                </p>
              )}

              {needsProfile && (
                <div role="alert" className="p-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white/75">
                  Add your own birth details first — a match compares your
                  chart with your partner's.{" "}
                  <Link to="/onboarding" className="font-bold text-gold underline-offset-4 hover:underline">
                    Create your birth profile
                  </Link>
                </div>
              )}

              {error && (
                <div role="alert" className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-sm animate-shake">
                  {error}
                  {needsCredits && (
                    <>
                      {" "}
                      <Link to="/wallet" className="font-bold text-gold underline-offset-4 hover:underline">
                        Open wallet
                      </Link>
                    </>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={handleMatch}
                disabled={
                  isMatching ||
                  profileLoading ||
                  !partnerData.name.trim() ||
                  !partnerData.dob ||
                  !partnerData.tob ||
                  !partnerData.pob
                }
                className="w-full py-3 mt-2 bg-white text-black font-display font-bold rounded-xl hover:bg-gold hover:text-black transition-all active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.1)] disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white via-gold/20 to-white opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                {isMatching ? (
                  <span className="flex items-center justify-center gap-3 relative z-10">
                    <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                    Synthesizing Charts...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2 relative z-10">
                    {user
                      ? `Calculate Compatibility · ${COMPATIBILITY_CREDIT_COST} credits`
                      : "Sign in to calculate"}
                    <ChevronRight
                      size={18}
                      className="group-hover:translate-x-1 transition-transform"
                    />
                  </span>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            {/* Master Score Display */}
            <div className="text-center relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gold/5 blur-[120px] rounded-full pointer-events-none" />

              <div className="relative inline-block">
                <svg className="w-64 h-64 md:w-80 md:h-80 transform -rotate-90">
                  <circle
                    cx="50%"
                    cy="50%"
                    r="45%"
                    className="stroke-white/5"
                    strokeWidth="4"
                    fill="transparent"
                  />
                  <circle
                    cx="50%"
                    cy="50%"
                    r="45%"
                    className="stroke-gold"
                    strokeWidth="4"
                    fill="transparent"
                    strokeDasharray="283"
                    strokeDashoffset={
                      283 - (283 * matchResult.overall_score) / 100
                    }
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-7xl md:text-8xl font-display font-bold text-white tracking-tighter">
                    {matchResult.overall_score}%
                  </div>
                  <div className="text-gold/40 uppercase tracking-[0.4em] text-[10px] font-black mt-2">
                    Harmony Index
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  const score =
                    matchResult.overall_score ||
                    matchResult.compatibility_score ||
                    0;
                  // A low number shared out of context reads like a verdict
                  // on the relationship, so only strong scores carry it.
                  const text =
                    score >= SHAREABLE_SCORE
                      ? `Our compatibility score: ${score}%! ✨ Check yours on AstroYou`
                      : "We just explored our compatibility on AstroYou ✨ Check yours";
                  const url = `${window.location.origin}/free-kundali-matching`;
                  if (navigator.share) {
                    navigator.share({
                      title: "AstroYou Compatibility",
                      text,
                      url,
                    });
                  } else {
                    window.open(
                      `https://wa.me/?text=${encodeURIComponent(text + "\n" + url)}`,
                      "_blank",
                    );
                  }
                }}
                className="mt-4 p-2 rounded-xl border border-white/10 text-white/40 hover:text-gold hover:border-gold/30 transition-all inline-flex items-center gap-1.5"
                title="Share result"
              >
                <Share2 size={16} />
                <span className="text-xs uppercase tracking-widest">Share</span>
              </button>
              {user && partnerData.name.trim() && !partnerAlreadyInCircle && (
                <button
                  onClick={() =>
                    openCircle({
                      name: partnerData.name.trim(),
                      relation: "partner",
                      dynamic: "supportive",
                    })
                  }
                  className="mt-3 ml-2 p-2 rounded-xl border border-white/10 text-white/60 hover:text-gold hover:border-gold/30 transition-all inline-flex items-center gap-1.5"
                >
                  <UserPlus size={16} />
                  <span className="text-xs uppercase tracking-widest">
                    Save {partnerData.name.trim().split(/\s+/)[0]} to your
                    circle
                  </span>
                </button>
              )}
              {user && (
                <button
                  onClick={downloadCompatibilityReport}
                  disabled={isDownloadingReport}
                  className="mt-3 p-2 rounded-xl border border-gold/20 text-gold hover:bg-gold/10 transition-all inline-flex items-center gap-1.5 disabled:opacity-50"
                  title="Download paid report"
                >
                  <Download size={16} />
                  <span className="text-xs uppercase tracking-widest">
                    {isDownloadingReport ? "Generating" : "PDF Report"}
                  </span>
                </button>
              )}
            </div>

            {/* Overall Recommendation based on Guna Milan */}
            {matchResult.vedicMatching &&
              (() => {
                const score =
                  matchResult.vedicMatching.total_score ??
                  matchResult.vedicMatching.score ??
                  0;
                const { color } = getGunaQuality(score);
                return (
                  <p
                    className={`text-sm font-medium mt-2 text-center ${color}`}
                  >
                    {score >= 32
                      ? "Strong long-term compatibility"
                      : score >= 24
                        ? "Good compatibility overall"
                        : score >= 18
                          ? "Workable, with some friction to navigate"
                          : "Needs care — worth talking through together or with a guide"}
                  </p>
                );
              })()}

            {/* AI Narrative Interpretation */}
            {matchResult.aiNarrative && (
              <div className="mb-6 p-5 rounded-2xl bg-gradient-to-br from-gold/5 to-purple-500/5 border border-gold/10">
                <h3 className="font-display text-sm uppercase tracking-[0.3em] text-gold/60 mb-4">
                  Jyotish's Insight
                </h3>
                <p className="text-sm md:text-base font-sans font-light leading-relaxed text-white/80 whitespace-pre-line">
                  {matchResult.aiNarrative}
                </p>
              </div>
            )}

            {/* Synastry Scores Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              <ScoreMetric
                label="Emotional"
                value={
                  matchResult.synastry?.emotional_connection ||
                  normalizeScore(
                    matchResult.compatibility?.breakdown?.sun_moon || 0,
                    "sun_moon",
                  )
                }
                icon={<Heart size={18} />}
              />
              <ScoreMetric
                label="Communication"
                value={
                  matchResult.synastry?.communication_style ||
                  normalizeScore(
                    matchResult.compatibility?.breakdown?.mercury || 0,
                    "mercury",
                  )
                }
                icon={<Speech size={18} />}
              />
              <ScoreMetric
                label="Physical"
                value={
                  matchResult.synastry?.physical_attraction ||
                  normalizeScore(
                    matchResult.compatibility?.breakdown?.attraction || 0,
                    "attraction",
                  )
                }
                icon={<Zap size={18} />}
              />
              <ScoreMetric
                label="Long Term"
                value={
                  matchResult.synastry?.long_term_potential ||
                  normalizeScore(
                    matchResult.compatibility?.breakdown?.saturn || 0,
                    "saturn",
                  )
                }
                icon={<Clock size={18} />}
              />
            </div>

            {/* Vedic Guna Milan Section */}
            {matchResult.vedicMatching && (
              <VedicGunaMilan
                vedicMatching={matchResult.vedicMatching}
                personA={matchResult.personA}
                personB={matchResult.personB}
              />
            )}
            {timeAssumed && (
              <p className="text-xs text-white/50 text-center -mt-2">
                Your birth time isn&rsquo;t saved, so we used 12:00 noon. The
                Moon can change nakshatra within a day, which can move the
                Guna score. Add your birth time in Settings for an exact match.
              </p>
            )}
            {matchResult.vedicMatching && matchResult.orientationAssumed && (
              <p className="text-xs text-white/40 text-center -mt-2">
                Traditional Ashtakoot matching assumes a bride and groom; we
                used the order you entered.
              </p>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Dynamics and Growth Kit */}
              <div className="lg:col-span-1 space-y-6">
                <section className="glass p-5 md:p-6 rounded-[2rem] border-white/5">
                  <h3 className="text-sm font-black uppercase tracking-widest text-gold/60 mb-5 flex items-center gap-2">
                    Relationship Dynamics
                  </h3>
                  <div className="space-y-5">
                    <DynamicItem
                      label="Power Balance"
                      value={matchResult.dynamics?.power_dynamics?.balance}
                      interpretation={
                        matchResult.dynamics?.power_dynamics?.interpretation
                      }
                    />
                    <DynamicItem
                      label="Emotional Bond"
                      value={
                        matchResult.dynamics?.emotional_connection?.strength
                      }
                      interpretation={
                        matchResult.dynamics?.emotional_connection
                          ?.interpretation
                      }
                    />
                    <DynamicItem
                      label="Communication"
                      value={matchResult.dynamics?.communication_style?.style}
                      interpretation={
                        matchResult.dynamics?.communication_style
                          ?.interpretation
                      }
                    />
                    <DynamicItem
                      label="Future Outlook"
                      value={
                        matchResult.dynamics?.long_term_potential?.potential
                      }
                      interpretation={
                        matchResult.dynamics?.long_term_potential
                          ?.interpretation
                      }
                    />
                  </div>
                </section>

                {/* Growth Kit (Compatibility Tips) */}
                {(matchResult.love_languages?.person1?.compatibility_tips ||
                  matchResult.love_languages?.person2?.compatibility_tips) && (
                  <section className="glass p-5 md:p-6 rounded-[2rem] border border-gold/10 bg-gold/[0.02]">
                    <h3 className="text-sm font-black uppercase tracking-widest text-gold mb-5 flex items-center gap-2">
                      Connection Kit
                    </h3>
                    <ul className="space-y-3">
                      {[
                        ...(matchResult.love_languages.person1
                          ?.compatibility_tips || []),
                        ...(matchResult.love_languages.person2
                          ?.compatibility_tips || []),
                      ]
                        .slice(0, 6)
                        .map((tip, i) => (
                          <li
                            key={i}
                            className="flex gap-4 text-xs text-white/70 font-light italic leading-relaxed group/tip"
                          >
                            <span className="text-gold group-hover/tip:scale-125 transition-transform shrink-0">
                              ✦
                            </span>
                            {tip}
                          </li>
                        ))}
                    </ul>
                  </section>
                )}
              </div>

              {/* Middle Column: Love Blueprints and Synastry Aspects */}
              <div className="lg:col-span-2 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <LoveLanguageCard
                    label={birthData?.name || "Member 1"}
                    lang={matchResult.love_languages?.person1}
                    isUser={true}
                  />
                  <LoveLanguageCard
                    label={partnerData.name || "Member 2"}
                    lang={matchResult.love_languages?.person2}
                    isUser={false}
                  />
                </div>

                <section className="glass p-5 md:p-6 rounded-[2rem] border-white/5">
                  <h3 className="text-sm font-black uppercase tracking-widest text-white/40 mb-5 flex items-center gap-2">
                    Celestial Aspects
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    {(matchResult.sections?.[0]?.interpretations || []).map(
                      (aspect, i) => (
                        <div
                          key={i}
                          className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 group hover:border-gold/20 hover:bg-white/[0.04] transition-all"
                        >
                          <div className="text-[10px] text-gold/60 font-black uppercase tracking-widest mb-2 group-hover:text-gold transition-colors">
                            {aspect.factor}
                          </div>
                          <div className="text-sm text-white/60 font-light leading-relaxed font-sans">
                            {aspect.text}
                          </div>
                        </div>
                      ),
                    )}
                    {!matchResult.sections?.[0]?.interpretations &&
                      matchResult.synastry?.key_aspects &&
                      matchResult.synastry.key_aspects.map((aspect, i) => {
                        const [title, desc] = aspect.split(": ");
                        return (
                          <div
                            key={i}
                            className="bg-white/5 border border-white/10 rounded-2xl p-4 transition-all"
                          >
                            <div className="text-[10px] text-gold/80 font-bold uppercase mb-1">
                              {title.replace(/_/g, " ")}
                            </div>
                            <div className="text-sm text-white/60 font-light">
                              {desc}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </section>

                {/* Composite Insights */}
                <section className="glass p-5 md:p-6 rounded-[2rem] border-white/5 relative overflow-hidden shadow-2xl">
                  <div className="absolute top-0 right-0 p-6 text-white/5 pointer-events-none">
                    <Heart size={150} />
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-gold/40 mb-5">
                      Composite Soul
                    </h3>
                    <div className="text-3xl font-display italic text-white mb-6 leading-tight">
                      "
                      {matchResult.composite?.relationship_purpose ||
                        "Building a shared legacy of growth"}
                      "
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-white/5">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-emerald-400 font-black mb-4 flex items-center gap-2">
                          <ShieldCheck size={12} /> Synergy Points
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {matchResult.composite?.strengths?.map((s, i) => (
                            <span
                              key={i}
                              className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs text-emerald-400 font-medium"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-orange-400 font-black mb-4 flex items-center gap-2">
                          <Target size={12} /> Growth Hedges
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {matchResult.composite?.challenges?.map((c, i) => (
                            <span
                              key={i}
                              className="px-4 py-2 bg-orange-500/10 border border-orange-500/20 rounded-full text-xs text-orange-400 font-medium"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Cosmic Wisdom Interpretations (Generic) */}
                {matchResult.interpretations &&
                  matchResult.interpretations.length > 0 && (
                    <section className="space-y-6 pt-6">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 rounded-2xl bg-gold/10">
                          <BookOpen size={24} className="text-gold" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-display font-bold">
                            Cosmic Wisdom
                          </h3>
                          <p className="text-sm text-white/40 font-light">
                            Deep synthesis of your shared path
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {matchResult.interpretations.map((item, i) => (
                          <div
                            key={i}
                            className="glass p-5 md:p-6 rounded-[2rem] border-white/5 group hover:border-gold/20 transition-all"
                          >
                            <h4 className="text-lg font-display font-medium text-gold mb-4 group-hover:translate-x-1 transition-transform inline-flex items-center gap-2">
                              <Sparkles size={16} className="text-gold/40" />
                              {item.title}
                            </h4>
                            <p className="text-white/60 font-sans font-light leading-relaxed italic">
                              {item.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
              </div>
            </div>

            <div className="mx-auto max-w-2xl">
              <AskJyotishBridge
                eyebrow="Understand this match"
                question="We just ran our compatibility. What are the real strengths and friction points between us, and how do we work with them?"
                context={{
                  storageKey: COMPATIBILITY_CONTEXT_KEY,
                  summary: buildCompatibilitySummary(
                    matchResult,
                    birthData?.name || "Seeker",
                    partnerData.name || "Partner",
                  ),
                }}
              />
            </div>

            <div className="text-center pt-8">
              <button
                onClick={() => setMatchResult(null)}
                className="min-h-11 text-white/60 hover:text-white flex items-center gap-2 mx-auto transition-colors font-sans text-xs tracking-widest uppercase"
              >
                Reset Analysis
              </button>
            </div>
          </div>
        )}
      </div>

      {circleOpen && user && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCircleOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Your Inner Circle"
            className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-[2rem] border border-white/10 bg-[#0B0B12] p-6"
          >
            <button
              onClick={() => setCircleOpen(false)}
              type="button"
              autoFocus
              className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center text-white/60 hover:text-white"
              aria-label="Close"
            >
              <X size={20} />
            </button>
            <p className="mb-5 pr-8 text-xs leading-relaxed text-white/60">
              The people you add here give your readings and chats context about
              who matters in your life. You can edit or remove them any time.
            </p>
            <InnerCircleManager
              userId={user.uid}
              keyRelationships={atmanState?.keyRelationships || []}
              onRefresh={() => {
                setCircleDraft(undefined);
                void refreshAtman();
              }}
              initialDraft={circleDraft}
            />
          </div>
        </div>
      )}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => setShowAuthModal(false)}
        title="Sign in to check compatibility"
        message={`A match compares your birth chart with your partner's and costs ${COMPATIBILITY_CREDIT_COST} credits.`}
      />
    </PageShell>
  );
}

/** An error whose message is already written for the user. */
class UserFacingError extends Error {}

function ScoreMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="glass p-5 rounded-3xl border border-white/5 text-center group hover:border-gold/20 transition-all">
      <div className="flex items-center justify-center gap-2 text-white/30 mb-4 group-hover:text-gold/60 transition-colors">
        {icon}
        <span className="text-[10px] uppercase tracking-widest font-black">
          {label}
        </span>
      </div>
      <div className="text-3xl font-display font-medium mb-1">{value}%</div>
      <div className="w-full h-1 bg-white/5 rounded-full mt-3 overflow-hidden">
        <div
          className="h-full bg-gold transition-all duration-1000"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function DynamicItem({
  label,
  value,
  interpretation,
}: {
  label: string;
  value: string | undefined;
  interpretation?: string;
}) {
  return (
    <div className="group/item">
      <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2 group-hover/item:text-gold/40 transition-colors font-black">
        {label}
      </div>
      <div className="text-sm font-sans font-light text-white/90 mb-1">
        {value || "N/A"}
      </div>
      {interpretation && (
        <div className="text-[11px] font-sans font-light italic text-white/40 leading-relaxed">
          {interpretation}
        </div>
      )}
    </div>
  );
}

function LoveLanguageCard({
  label,
  lang,
  isUser,
}: {
  label: string;
  lang: any;
  isUser: boolean;
}) {
  return (
    <div className="glass p-5 md:p-6 rounded-[2rem] border border-white/5 relative overflow-hidden group/card shadow-2xl">
      <div
        className={`absolute top-0 right-0 p-6 text-white/5 pointer-events-none group-hover/card:text-gold/5 transition-colors`}
      >
        <User size={120} />
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-5">
          <div
            className={`w-2 h-2 rounded-full ${
              isUser ? "bg-gold" : "bg-gold/40"
            }`}
          />
          <span className="text-xs uppercase tracking-[0.2em] font-black text-white/60">
            {label}'s Love Blueprint
          </span>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-gold/40 font-black mb-3">
                Primary Mode
              </div>
              <div className="text-xl font-display text-white">
                {lang?.primary_love_language || lang?.primary || "N/A"}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-gold/40 font-black mb-3">
                Secondary
              </div>
              <div className="text-xl font-display text-white/60">
                {lang?.secondary_love_language || lang?.secondary || "N/A"}
              </div>
            </div>
          </div>

          {/* Deep Influences */}
          <div className="pt-6 border-t border-white/5 space-y-5">
            <InfluenceItem
              icon="Venus"
              sign={lang?.venus_influence?.sign}
              text={lang?.venus_influence?.expression}
            />
            <InfluenceItem
              icon="Moon"
              sign={lang?.moon_influence?.sign}
              text={lang?.moon_influence?.emotional_needs}
            />
            <InfluenceItem
              icon="Mars"
              sign={lang?.mars_influence?.sign}
              text={lang?.mars_influence?.passion_style}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function InfluenceItem({
  icon,
  sign,
  text,
}: {
  icon: string;
  sign?: string;
  text?: string;
}) {
  if (!sign && !text) return null;
  return (
    <div className="flex gap-4 group/inf">
      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs font-black text-gold/60 group-hover/inf:bg-gold/10 group-hover/inf:text-gold transition-all shrink-0">
        {icon[0]}
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-widest font-black text-white/40 mb-1">
          {icon} in {sign}
        </div>
        <div className="text-xs text-white/60 font-light italic leading-relaxed">
          {text}
        </div>
      </div>
    </div>
  );
}

function getGunaQuality(score: number): { label: string; color: string } {
  if (score >= 32) return { label: "Excellent", color: "text-yellow-400" };
  if (score >= 24) return { label: "Good", color: "text-emerald-400" };
  if (score >= 18) return { label: "Acceptable", color: "text-yellow-500" };
  return { label: "Needs care", color: "text-amber-300" };
}

function VedicGunaMilan({
  vedicMatching,
  personA,
  personB,
}: {
  vedicMatching: NonNullable<MatchResult["vedicMatching"]>;
  personA?: { name?: string };
  personB?: { name?: string };
}) {
  const totalScore = vedicMatching.total_score ?? vedicMatching.score ?? 0;
  // The API spec's example names this list `kutas`; older shapes used
  // `gunas` or `aspects`.
  const gunaItems =
    vedicMatching.gunas ?? vedicMatching.aspects ?? vedicMatching.kutas ?? [];
  const quality = getGunaQuality(totalScore);

  return (
    <section className="bg-white/5 border border-white/10 rounded-[2rem] p-5 md:p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-6 text-white/5 pointer-events-none">
        <Star size={140} />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-gold/10">
            <Star size={22} className="text-gold" />
          </div>
          <div>
            <h3 className="text-xl font-display font-bold text-gold">
              Vedic compatibility (
              <GlossaryTerm k="guna-milan">Guna Milan</GlossaryTerm>)
            </h3>
            <p className="text-xs text-white/40 font-light">
              Traditional 36-point score
            </p>
          </div>
        </div>

        <p className="mb-5 text-xs leading-relaxed text-white/45">
          A traditional 36-point Vedic score. It was designed for marriage
          matching and assigns the two charts traditional roles, so read it as
          one lens among several rather than a verdict.
        </p>

        {/* Total Score */}
        <div className="flex items-baseline gap-4 mb-6">
          <div className="text-5xl md:text-6xl font-display font-bold tracking-tight text-white">
            {totalScore}
            <span className="text-white/30 text-3xl md:text-4xl"> / 36</span>
          </div>
          <span
            className={`text-sm font-black uppercase tracking-widest ${quality.color}`}
          >
            {quality.label}
          </span>
        </div>

        {/* Guna Matrix Table */}
        {gunaItems.length > 0 && (
          <div className="overflow-x-auto mt-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-3 text-white/40 text-xs uppercase tracking-widest">
                    Guna
                  </th>
                  <th className="text-center py-2 px-3 text-white/40 text-xs uppercase tracking-widest">
                    Score
                  </th>
                  <th className="text-left py-2 px-3 text-white/40 text-xs uppercase tracking-widest w-1/3">
                    Match
                  </th>
                  <th className="text-left py-2 px-3 text-white/40 text-xs uppercase tracking-widest hidden md:table-cell">
                    Interpretation
                  </th>
                </tr>
              </thead>
              <tbody>
                {gunaItems.map((g: any, i: number) => {
                  const obtained = g.score ?? g.obtained ?? 0;
                  const max = g.max_score ?? g.maximum ?? g.max ?? 1;
                  const pct = (obtained / max) * 100;
                  return (
                    <tr key={i} className="border-b border-white/5">
                      <td className="py-3 px-3 text-white/90 font-medium">
                        {g.name || g.guna || `Guna ${i + 1}`}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`font-mono font-bold ${pct >= 75 ? "text-emerald-400" : pct >= 50 ? "text-amber-400" : "text-white/55"}`}
                        >
                          {obtained}/{max}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="w-full bg-white/10 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${pct >= 75 ? "bg-emerald-400" : pct >= 50 ? "bg-amber-400" : "bg-white/30"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3 px-3 text-white/40 text-xs hidden md:table-cell">
                        {g.description || g.interpretation || ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/20">
                  <td className="py-3 px-3 text-gold font-bold">Total</td>
                  <td className="py-3 px-3 text-center text-gold font-bold font-mono">
                    {totalScore}/36
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Remedies for Low Scores */}
        {totalScore < 18 && (
          <div className="mt-6 p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20">
            <h4 className="text-amber-400 text-sm font-bold uppercase tracking-widest mb-3">
              Needs care — worth talking through
            </h4>
            <p className="mb-3 text-xs leading-relaxed text-white/50">
              A lower Guna score points to areas that may take more patience and
              conversation. It's one traditional lens, not a verdict on the
              relationship. If you'd like, tradition suggests:
            </p>
            <ul className="space-y-2 text-sm text-white/60">
              <li>
                Perform Navagraha Puja to strengthen weak planetary combinations
              </li>
              <li>
                Both partners should chant their respective planet mantras daily
              </li>
              <li>
                Consult a qualified Vedic astrologer for personalized remedies
              </li>
              {totalScore < 12 && (
                <li className="text-amber-400">
                  A fuller reading (including Nadi) can add nuance the score
                  alone can't
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Manglik Status */}
        {(() => {
          // The *_male / groom_* field names are the upstream API's shape, not
          // ours — the gendered vocabulary stops at that boundary.
          const manglikEntries = [
            {
              label: personA?.name || "Person 1",
              data:
                vedicMatching.personA_manglik ??
                vedicMatching.manglik_male ??
                vedicMatching.groom_manglik,
            },
            {
              label: personB?.name || "Person 2",
              data:
                vedicMatching.personB_manglik ??
                vedicMatching.manglik_female ??
                vedicMatching.bride_manglik,
            },
          ].filter(({ data }) => data !== undefined && data !== null);

          if (manglikEntries.length === 0) return null;

          const statuses = manglikEntries.map(({ label, data }) => ({
            label,
            isManglik: readManglik(data) === true,
          }));
          const bothManglik =
            statuses.length === 2 && statuses.every((e) => e.isManglik);
          const oneManglik =
            statuses.length === 2 &&
            statuses.filter((e) => e.isManglik).length === 1;

          // We deliberately do not show the upstream API's raw dosha
          // `description` — it can carry fear-based phrasing. These are our
          // own calm explanations (same tone as glossary.ts).
          return (
            <>
              <div className="grid grid-cols-2 gap-4 mt-6">
                {statuses.map(({ label, isManglik }) => (
                  <div
                    key={label}
                    className="p-4 rounded-xl bg-white/5 border border-white/10"
                  >
                    <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">
                      {label}
                    </p>
                    <p
                      className={`text-sm font-medium ${isManglik ? "text-amber-300" : "text-white/80"}`}
                    >
                      {isManglik ? (
                        <GlossaryTerm k="manglik">Manglik</GlossaryTerm>
                      ) : (
                        "Not Manglik"
                      )}
                    </p>
                    <p className="text-xs text-white/40 mt-1 leading-relaxed">
                      {isManglik
                        ? "Mars sits in a placement tradition links with friction in partnership. Many practitioners read it as tension to manage rather than a verdict."
                        : "Mars isn't in a traditional Manglik placement in this chart."}
                    </p>
                  </div>
                ))}
              </div>
              {bothManglik && (
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 mt-3">
                  <p className="text-xs text-white/60 leading-relaxed">
                    Traditionally, when both partners are Manglik the effect is
                    considered balanced. It's one factor among many.
                  </p>
                </div>
              )}
              {oneManglik && (
                <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 mt-3">
                  <p className="text-xs text-white/60 leading-relaxed">
                    Needs care — worth talking through. When only one partner is
                    Manglik, tradition suggests paying attention to how you each
                    handle conflict and pace. It's one factor among many, not a
                    prediction.
                  </p>
                </div>
              )}
            </>
          );
        })()}
      </div>
    </section>
  );
}
