import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Heart, ArrowRight, Loader2, Lock } from "lucide-react";
import LocationInput from "../components/LocationInput";

interface PersonForm {
  name: string;
  dob: string;
  tob: string;
  pob: string;
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
}

const emptyPerson = (): PersonForm => ({ name: "", dob: "", tob: "12:00", pob: "" });

export default function FreeMatching() {
  const [person1, setPerson1] = useState<PersonForm>(emptyPerson());
  const [person2, setPerson2] = useState<PersonForm>(emptyPerson());
  const [result, setResult] = useState<MatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // SEO
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Free Kundali Matching Online | Guna Milan Calculator — AstroYou";
    let meta = document.querySelector('meta[name="description"]');
    const prevDesc = meta?.getAttribute("content") || "";
    if (meta) {
      meta.setAttribute(
        "content",
        "Check Kundali matching and Guna Milan score for free. See compatibility score and Ashtakoot analysis — no signup required."
      );
    }
    return () => {
      document.title = prevTitle;
      if (meta) meta.setAttribute("content", prevDesc);
    };
  }, []);

  const handleCheck = async () => {
    if (!person1.dob || !person1.pob || !person2.dob || !person2.pob) {
      setError("Please enter date of birth and place of birth for both persons.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const compatRes = await fetch("/.netlify/functions/compatibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maleData: person1, femaleData: person2 }),
      });

      if (!compatRes.ok) throw new Error("Compatibility API failed");

      const compatData = await compatRes.json();

      // Normalize the response into our MatchResult shape
      const gunas: GunaResult[] = compatData.gunas || compatData.ashtakoot || [];
      const overallScore =
        compatData.overallScore ??
        compatData.totalScore ??
        (gunas.length > 0 ? gunas.reduce((s: number, g: GunaResult) => s + (g.score || 0), 0) : 0);
      const maxScore = compatData.maxScore ?? 36;

      setResult({ overallScore, maxScore, gunas });
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  const PersonFormBlock = ({
    label,
    person,
    onChange,
  }: {
    label: string;
    person: PersonForm;
    onChange: (p: PersonForm) => void;
  }) => (
    <div className="space-y-4">
      <h3 className="text-sm font-bold uppercase tracking-widest text-white/50">{label}</h3>
      <div>
        <label className="block text-sm text-white/60 mb-1.5">Name (optional)</label>
        <input
          type="text"
          value={person.name}
          onChange={(e) => onChange({ ...person, name: e.target.value })}
          placeholder="Name"
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-transparent transition-all"
        />
      </div>
      <div>
        <label className="block text-sm text-white/60 mb-1.5">
          Date of Birth <span className="text-amber-400">*</span>
        </label>
        <input
          type="date"
          value={person.dob}
          onChange={(e) => onChange({ ...person, dob: e.target.value })}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-transparent transition-all [color-scheme:dark]"
        />
      </div>
      <div>
        <label className="block text-sm text-white/60 mb-1.5">Time of Birth</label>
        <input
          type="time"
          value={person.tob}
          onChange={(e) => onChange({ ...person, tob: e.target.value })}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-transparent transition-all [color-scheme:dark]"
        />
      </div>
      <div>
        <label className="block text-sm text-white/60 mb-1.5">
          Place of Birth <span className="text-amber-400">*</span>
        </label>
        <LocationInput
          value={person.pob}
          onChange={(value) => onChange({ ...person, pob: value })}
          placeholder="Search for birth city..."
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-transparent transition-all"
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#030308] text-white">
      {/* Cosmic background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-pink-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 px-4 py-12 sm:py-20">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/60 text-sm mb-6">
            <Heart className="w-3.5 h-3.5 text-pink-400" />
            100% Free — No Signup Required
          </div>
          <h1 className="text-4xl sm:text-5xl font-display font-semibold bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent mb-3">
            Free Kundali Matching
          </h1>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            Check Ashtakoot Guna Milan compatibility score between two birth charts instantly.
          </p>
        </motion.div>

        {!result ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="max-w-3xl mx-auto"
          >
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6 sm:p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <PersonFormBlock label="Person 1" person={person1} onChange={setPerson1} />
                <PersonFormBlock label="Person 2" person={person2} onChange={setPerson2} />
              </div>

              {error && <p className="text-red-400 text-sm text-center mt-5">{error}</p>}

              <button
                onClick={handleCheck}
                disabled={loading}
                className="w-full mt-8 py-3.5 rounded-xl bg-gradient-to-r from-pink-500 to-amber-500 text-black font-semibold text-lg hover:from-pink-400 hover:to-amber-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
              <h2 className="text-xl font-display text-white/70">What is Kundali Matching?</h2>
              <p className="text-white/40 text-sm max-w-md mx-auto leading-relaxed">
                Kundali Matching (Guna Milan) is a Vedic compatibility analysis that compares two birth charts across 8 categories (Ashtakoot) totaling 36 points. A score of 18+ is considered favorable for marriage.
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
              <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Overall Compatibility</p>
              <div className="text-6xl font-display font-bold bg-gradient-to-b from-amber-400 to-pink-400 bg-clip-text text-transparent">
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

            {/* Guna breakdown: show 3, blur the rest */}
            {result.gunas.length > 0 && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 mb-8">
                <h3 className="text-lg font-display text-white/80 mb-4">Ashtakoot Analysis</h3>
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
                        <span className="text-sm text-white/70">{guna.name || `Guna ${i + 1}`}</span>
                        <div className="flex items-center gap-3">
                          <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-400 rounded-full"
                              style={{ width: `${((guna.score || 0) / (guna.maxScore || 1)) * 100}%` }}
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
                  <div className="flex items-center justify-center gap-2 mt-4 text-amber-400/80 text-sm">
                    <Lock className="w-4 h-4" />
                    {result.gunas.length - 3} more gunas hidden
                  </div>
                )}
              </div>
            )}

            {/* CTA */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 mb-8 text-center">
              <Sparkles className="w-6 h-6 text-amber-400 mx-auto mb-3" />
              <p className="text-white/70 mb-1">
                See all <span className="text-amber-400 font-medium">36 points</span> + AI-powered compatibility analysis
              </p>
              <p className="text-white/40 text-sm">
                Get detailed insights on each guna, Mangal Dosha check, and personalized relationship guidance.
              </p>
            </div>

            <Link
              to="/onboarding"
              className="block w-full py-4 rounded-xl bg-gradient-to-r from-pink-500 to-amber-500 text-black font-semibold text-lg text-center hover:from-pink-400 hover:to-amber-400 transition-all"
            >
              <span className="flex items-center justify-center gap-2">
                See All 36 Points + AI Analysis — Create Free Account
                <ArrowRight className="w-5 h-5" />
              </span>
            </Link>
            <p className="text-center text-white/30 text-sm mt-3">
              Free account — unlock full compatibility report
            </p>

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
