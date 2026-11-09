import { useState } from "react";
import { postJson } from "../lib/apiFetch";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Heart, ArrowRight, Loader2, Lock } from "lucide-react";
import LocationInput from "../components/LocationInput";
import SEO from "../components/SEO";
import {
  captureAcquisitionSource,
  trackAcquisitionEvent,
} from "../lib/acquisition";
import { siteUrl } from "../lib/site-url";

interface PersonForm {
  name: string;
  dob: string;
  tob: string;
  pob: string;
  /** Picks the Ashtakoot groom/bride slot server-side ("" = not given). */
  gender: "" | "male" | "female" | "other";
}

interface GunaResult {
  name: string;
  score: number;
  maxScore: number;
  description?: string;
}

interface MatchResult {
  overallScore: number;
  maxScore: number;
  gunas: GunaResult[];
  orientationAssumed: boolean;
}

const emptyPerson = (): PersonForm => ({
  name: "",
  dob: "",
  tob: "12:00",
  pob: "",
  gender: "",
});

const num = (...values: unknown[]): number | undefined => {
  for (const v of values) {
    const n = typeof v === "string" ? Number(v) : v;
    if (typeof n === "number" && Number.isFinite(n)) return n;
  }
  return undefined;
};

/**
 * Map /api/compatibility's response onto this page. Guna Milan lives under
 * `vedicMatching` (upstream /vedic/kundli-matching: total_score, max_score,
 * kutas[{name, score, max}]); the same aliases Compatibility.tsx accepts
 * (gunas/aspects, obtained, max_score/maximum) are tolerated too.
 */
const normalizeMatchResponse = (data: any): MatchResult | null => {
  const vm = data?.vedicMatching;
  if (!vm || typeof vm !== "object") return null;
  const rawItems = vm.kutas ?? vm.gunas ?? vm.aspects ?? vm.ashtakoot ?? [];
  const gunas: GunaResult[] = (Array.isArray(rawItems) ? rawItems : [])
    .map((g: any, i: number) => ({
      name:
        (typeof g?.name === "string" && g.name) ||
        (typeof g?.kuta === "string" && g.kuta) ||
        `Guna ${i + 1}`,
      score: num(g?.score, g?.obtained, g?.points) ?? 0,
      maxScore: num(g?.max, g?.max_score, g?.maximum, g?.max_points) ?? 0,
      description:
        typeof g?.description === "string" ? g.description : undefined,
    }));
  const total =
    num(vm.total_score, vm.score, vm.total_points) ??
    (gunas.length ? gunas.reduce((sum, g) => sum + g.score, 0) : undefined);
  if (total === undefined) return null;
  return {
    overallScore: total,
    maxScore: num(vm.max_score, vm.maximum_score) ?? 36,
    gunas,
    orientationAssumed: data?.orientationAssumed === true,
  };
};

const PersonFormBlock = ({
  label,
  idPrefix,
  person,
  onChange,
}: {
  label: string;
  idPrefix: string;
  person: PersonForm;
  onChange: (p: PersonForm) => void;
}) => (
  <div className="space-y-3 sm:space-y-4">
    <h2 className="text-sm font-bold uppercase tracking-widest text-white/50">
      {label}
    </h2>
    <div>
      <label htmlFor={`${idPrefix}-name`} className="block text-sm text-white/60 mb-1.5">
        Name (optional)
      </label>
      <input
        id={`${idPrefix}-name`}
        type="text"
        value={person.name}
        onChange={(e) => onChange({ ...person, name: e.target.value })}
        placeholder="Name"
        className="platform-field placeholder:text-white/40"
      />
    </div>
    <div>
      <label htmlFor={`${idPrefix}-dob`} className="block text-sm text-white/60 mb-1.5">
        Date of Birth <span className="text-gold">*</span>
      </label>
      <input
        id={`${idPrefix}-dob`}
        type="date"
        value={person.dob}
        onChange={(e) => onChange({ ...person, dob: e.target.value })}
        className="platform-field [color-scheme:dark]"
      />
    </div>
    <div>
      <label htmlFor={`${idPrefix}-tob`} className="block text-sm text-white/60 mb-1.5">
        Time of Birth
      </label>
      <input
        id={`${idPrefix}-tob`}
        type="time"
        value={person.tob}
        onChange={(e) => onChange({ ...person, tob: e.target.value })}
        className="platform-field [color-scheme:dark]"
      />
    </div>
    <div>
      <label htmlFor={`${idPrefix}-gender`} className="block text-sm text-white/60 mb-1.5">Gender</label>
      <select
        id={`${idPrefix}-gender`}
        value={person.gender}
        onChange={(e) =>
          onChange({
            ...person,
            gender: e.target.value as PersonForm["gender"],
          })
        }
        className="platform-field [color-scheme:dark]"
      >
        <option value="">Prefer not to say</option>
        <option value="female">Female</option>
        <option value="male">Male</option>
        <option value="other">Other</option>
      </select>
    </div>
    <div>
      <label htmlFor={`${idPrefix}-pob`} className="block text-sm text-white/60 mb-1.5">
        Place of Birth <span className="text-gold">*</span>
      </label>
      <LocationInput
        inputId={`${idPrefix}-pob`}
        value={person.pob}
        onChange={(value) => onChange({ ...person, pob: value })}
        placeholder="Search for birth city..."
        size="field"
      />
    </div>
  </div>
);

export default function FreeMatching() {
  const [person1, setPerson1] = useState<PersonForm>(emptyPerson());
  const [person2, setPerson2] = useState<PersonForm>(emptyPerson());
  const [result, setResult] = useState<MatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Free and account-free: mode "guna_milan" asks the server for the
  // Ashtakoot score only — no credits, no narrative, budgeted per IP.

  const toPayload = (p: PersonForm) => ({
    name: p.name,
    dob: p.dob,
    tob: p.tob,
    pob: p.pob,
    ...(p.gender ? { gender: p.gender } : {}),
  });

  const handleCheck = async () => {
    if (!person1.dob || !person1.pob || !person2.dob || !person2.pob) {
      setError(
        "Please enter date of birth and place of birth for both persons.",
      );
      return;
    }
    setError("");
    setLoading(true);

    try {
      const compatRes = await postJson("/api/compatibility", {
        personA: toPayload(person1),
        personB: toPayload(person2),
        mode: "guna_milan",
      });
      const compatData = await compatRes.json().catch(() => null);

      if (!compatRes.ok) {
        setError(
          (typeof compatData?.error === "string" && compatData.error) ||
            "We couldn't match these two charts just now. Check both birth dates, times and places, then try again in a minute.",
        );
        return;
      }

      const normalized = normalizeMatchResponse(compatData);
      if (!normalized) {
        setError(
          "We couldn't calculate the Guna Milan score for these charts. Please check the birth details and try again.",
        );
        return;
      }

      setResult(normalized);
      trackAcquisitionEvent("seo_tool_complete", {
        tool: "free_kundali_matching",
        score: normalized.overallScore,
      });
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const rememberSource = (target: string) => {
    captureAcquisitionSource({
      source: "free-kundali-matching",
      medium: "seo_tool",
      campaign: "free_tool_funnel",
    });
    trackAcquisitionEvent("seo_cta_click", {
      tool: "free_kundali_matching",
      target,
    });
  };

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Free Kundali Matching",
    applicationCategory: "LifestyleApplication",
    url: siteUrl("/free-kundali-matching"),
    offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
  };

  return (
    <div>
      <SEO
        title="Free Kundali Matching Online | Guna Milan Calculator"
        description="Check Kundali matching and Guna Milan score for free. See compatibility score and Ashtakoot analysis with no signup required."
        url={siteUrl("/free-kundali-matching")}
        canonical={siteUrl("/free-kundali-matching")}
        structuredData={structuredData}
      />

      <div className="relative z-10 px-4 pt-28 pb-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8 sm:mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/60 text-sm mb-4 sm:mb-6">
            <Heart className="w-3.5 h-3.5 text-gold" />
            100% Free — No Signup Required
          </div>
          <h1 className="type-page-title mb-3">
            Free Kundali Matching
          </h1>
          <p className="text-white/60 text-base sm:text-lg max-w-xl mx-auto">
            Check Ashtakoot Guna Milan compatibility score between two birth
            charts instantly.
          </p>
        </motion.div>

        {!result ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="max-w-3xl mx-auto"
          >
            <div className="sm:rounded-2xl sm:border sm:border-white/10 sm:bg-white/[0.03] sm:backdrop-blur-sm sm:p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                <PersonFormBlock
                  label="Person 1"
                  idPrefix="fm-p1"
                  person={person1}
                  onChange={setPerson1}
                />
                <PersonFormBlock
                  label="Person 2"
                  idPrefix="fm-p2"
                  person={person2}
                  onChange={setPerson2}
                />
              </div>

              {error && (
                <p className="text-red-400 text-sm text-center mt-5">{error}</p>
              )}

              <button
                onClick={handleCheck}
                disabled={loading}
                className="w-full mt-6 sm:mt-8 min-h-12 py-3 rounded-xl bg-gold text-black font-semibold text-base hover:bg-gold/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Checking Compatibility...
                  </>
                ) : (
                  <>
                    <Heart className="w-5 h-5" />
                    Check Compatibility
                  </>
                )}
              </button>
            </div>

            {/* SEO content */}
            <div className="mt-12 text-center space-y-4">
              <h2 className="text-xl font-display text-white/70">
                What is Kundali Matching?
              </h2>
              <p className="text-white/40 text-sm max-w-md mx-auto leading-relaxed">
                Kundali Matching (Guna Milan) is a Vedic compatibility analysis
                that compares two birth charts across 8 categories (Ashtakoot)
                totaling 36 points. A score of 18+ is considered favorable for
                marriage.
              </p>
            </div>
          </motion.div>
        ) : (
          /* Results */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl mx-auto"
          >
            {/* Names */}
            <p className="text-center text-white/40 mb-6">
              {person1.name || "Person 1"} & {person2.name || "Person 2"}
            </p>

            {/* Overall Score */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center mb-8">
              <p className="text-white/40 text-xs uppercase tracking-wider mb-2">
                Overall Compatibility
              </p>
              <div className="text-6xl font-display font-bold text-gold">
                {result.overallScore}/{result.maxScore}
              </div>
              <p className="text-white/50 text-sm mt-2">
                {result.overallScore >= 25
                  ? "Excellent match!"
                  : result.overallScore >= 18
                    ? "Good compatibility"
                    : result.overallScore >= 12
                      ? "Average compatibility"
                      : "Needs careful consideration"}
              </p>
            </div>

            {result.orientationAssumed && (
              <p className="text-xs text-white/40 text-center -mt-4 mb-8">
                Traditional Ashtakoot matching assumes a bride and groom; we
                used the order you entered.
              </p>
            )}

            {/* Guna breakdown: show 3, blur the rest */}
            {result.gunas.length > 0 && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 mb-8">
                <h3 className="text-lg font-display text-white/80 mb-4">
                  Ashtakoot Analysis
                </h3>
                <div className="space-y-3">
                  {result.gunas.map((guna, i) => {
                    const isLocked = i >= 3;
                    return (
                      <div
                        key={i}
                        className={`flex items-center justify-between py-2 border-b border-white/5 last:border-0 ${
                          isLocked ? "blur-[4px] select-none" : ""
                        }`}
                      >
                        <span className="text-sm text-white/70">
                          {guna.name || `Guna ${i + 1}`}
                        </span>
                        <div className="flex items-center gap-3">
                          <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gold rounded-full"
                              style={{
                                width: `${((guna.score || 0) / (guna.maxScore || 1)) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm text-white/50 w-10 text-right">
                            {guna.score}/{guna.maxScore}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {result.gunas.length > 3 && (
                  <div className="flex items-center justify-center gap-2 mt-4 text-gold/80 text-sm">
                    <Lock className="w-4 h-4" />
                    {result.gunas.length - 3} more gunas hidden
                  </div>
                )}
              </div>
            )}

            {/* CTA */}
            <div className="rounded-xl border border-gold/20 bg-gold/5 p-6 mb-8 text-center">
              <Sparkles className="w-6 h-6 text-gold mx-auto mb-3" />
              <p className="text-white/70 mb-1">
                See all{" "}
                <span className="text-gold font-medium">36 points</span> +
                the full compatibility analysis
              </p>
              <p className="text-white/40 text-sm">
                Get detailed insights on each guna, Mangal Dosha check, and
                personalized relationship guidance.
              </p>
            </div>

            <Link
              to="/onboarding"
              onClick={() => rememberSource("/onboarding")}
              className="block w-full min-h-12 py-3 rounded-xl bg-gold text-black font-semibold text-base text-center hover:bg-gold/90 transition-all"
            >
              <span className="flex items-center justify-center gap-2">
                See All 36 Points + Full Analysis — Create Free Account
                <ArrowRight className="w-5 h-5" />
              </span>
            </Link>
            <p className="text-center text-white/30 text-sm mt-3">
              Free account — unlock full compatibility report
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <Link
                to="/synthesis"
                onClick={() => rememberSource("/synthesis")}
                className="rounded-xl border border-white/10 px-4 py-3 text-center text-sm text-white/60 hover:border-gold/30 hover:text-gold"
              >
                Ask Jyotish about this match
              </Link>
              <Link
                to="/consult/meera-devi/profile"
                onClick={() => rememberSource("/consult/meera-devi/profile")}
                className="rounded-xl border border-white/10 px-4 py-3 text-center text-sm text-white/60 hover:border-gold/30 hover:text-gold"
              >
                Talk to relationship guide
              </Link>
            </div>

            <button
              onClick={() => setResult(null)}
              className="block mx-auto mt-8 text-white/40 hover:text-white/60 text-sm underline underline-offset-4 transition-colors"
            >
              Check another match
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
