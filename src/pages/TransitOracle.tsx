import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Compass,
  Calendar as CalendarIcon,
  Sparkles,
  Eye,
  Table2,
} from "lucide-react";
import { PageShell } from "../components/layout/PageShell";
import { AskJyotishBridge } from "../components/layout/AskJyotishBridge";
import TransitOverlay from "../components/astrology/TransitOverlay";
import TransitPredictions from "../components/astrology/TransitPredictions";
import TransitPositionsTable from "../components/astrology/TransitPositionsTable";
import BirthProfileRequired from "../components/BirthProfileRequired";
import { StatusNotice } from "../components/ui/StatusNotice";
import { GlossaryTerm } from "../components/ui/GlossaryTerm";
import { useTransit } from "../hooks/useTransit";
import { useUserProfile } from "../hooks/useUserProfile";
import { useSubscription } from "../hooks/useSubscription";
import { useRequestBirthData } from "../hooks/useRequestBirthData";
import { useAuth } from "../lib/useAuth";
import AuthModal from "../components/AuthModal";
import { viewerDateKey } from "../lib/viewer-timezone";
import {
  FEATURE_CREDIT_COST,
  chargeConfirmationKey,
  chargeWindowKey,
  creditLabel,
  hasConfirmedCharge,
  rememberChargeConfirmation,
} from "../lib/feature-pricing";
import { PLANETS } from "../lib/astrology";

const TRANSIT_COST = FEATURE_CREDIT_COST.transit;

const SIGN_NAMES: Record<string, string> = {
  Ari: "Aries",
  Tau: "Taurus",
  Gem: "Gemini",
  Can: "Cancer",
  Leo: "Leo",
  Vir: "Virgo",
  Lib: "Libra",
  Sco: "Scorpio",
  Sag: "Sagittarius",
  Cap: "Capricorn",
  Aqu: "Aquarius",
  Pis: "Pisces",
};

function extractPositions(data: any): any[] {
  if (!data) return [];
  const chartData = data?.chart_data || data;
  const subjectData = data?.subject_data || data?.positions?.subject_data;

  let positions: any[];

  if (subjectData?.transit_subject) {
    const subj = subjectData.transit_subject;
    const names = [
      ...(subj.planets_names_list || []),
      ...(subj.axial_cusps_names_list || []),
    ];
    positions = names
      .map((n: string) => subj[n.toLowerCase()])
      .filter((p: any) => p && p.name && !p.name.includes("Ascendant"));
  } else {
    const all = chartData?.planetary_positions || chartData?.positions || [];
    positions = Array.isArray(all)
      ? all.filter(
          (p: any) =>
            p.name?.toLowerCase().includes("_transit") ||
            (!p.name?.toLowerCase().includes("_natal") &&
              !p.name?.includes("Ascendant")),
        )
      : [];
  }

  const mainPlanets = [
    "Sun",
    "Moon",
    "Mercury",
    "Venus",
    "Mars",
    "Jupiter",
    "Saturn",
    "Uranus",
    "Neptune",
    "Pluto",
    "Rahu",
    "Ketu",
  ];
  const mainSet = new Set(mainPlanets.flatMap((m) => [m, `${m}_transit`]));
  const filtered = positions.filter((p: any) => {
    const clean = (p.name || "").replace("_transit", "").replace("_natal", "");
    return mainSet.has(p.name) || mainPlanets.includes(clean);
  });

  return (filtered.length > 0 ? filtered : positions).slice(0, 12);
}

export default function TransitOracle() {
  const [currentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"visual" | "table">("visual");
  const [transitDate] = useState(() => viewerDateKey());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user } = useAuth();
  const { credits } = useSubscription();
  const { birthData: profileBirthData, loading: profileLoading } =
    useUserProfile();
  const birthData = useRequestBirthData(profileBirthData);
  const hasBirthData = Boolean(birthData?.dob && birthData.tob);

  // Each chart's transits for a date cost credits once (transit.ts). Say so
  // up front and ask once per date per session before the first charge.
  const [, setConfirmNonce] = useState(0);
  const chargeKey =
    user && hasBirthData
      ? chargeConfirmationKey(
          user.uid,
          "transit",
          chargeWindowKey("transit", transitDate),
          birthData,
        )
      : null;
  const needsChargeConfirm = chargeKey ? !hasConfirmedCharge(chargeKey) : false;
  const confirmCharge = () => {
    if (!chargeKey) return;
    rememberChargeConfirmation(chargeKey);
    setConfirmNonce((n) => n + 1);
  };

  const {
    data,
    predictions,
    aiSummary,
    loading: transitLoading,
    error,
    errorKind,
    needsProfile: transitNeedsProfile,
    retry,
  } = useTransit(birthData, transitDate, {
    enabled: !profileLoading && !needsChargeConfirm,
  });
  const loading = profileLoading || transitLoading;
  const needsProfile = !profileLoading && (!hasBirthData || transitNeedsProfile);

  // Format date for display
  const formattedDate = currentDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <PageShell wide>
      <div>
        {/* Title Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-4 gap-4">
          <div className="max-w-2xl">
            <h1 className="type-page-title mb-3">
              Today's planets &amp; you{" "}
              <span className="text-gold italic">(Gochar)</span>
            </h1>
            <p className="text-base text-white/65 leading-relaxed max-w-xl">
              The planets keep moving. Where they are today, laid over where
              they were when you were born, shows which parts of your life are
              busy right now and what to lean into.
            </p>
          </div>

          <div className="glass p-4 rounded-2xl border border-white/10 flex flex-col gap-1.5 min-w-55">
            <div className="flex items-center gap-2 text-gold">
              <CalendarIcon size={16} aria-hidden="true" />
              <span className="text-xs uppercase font-bold tracking-widest">
                Today
              </span>
            </div>
            <div className="text-lg font-display tracking-wide">
              {formattedDate}
            </div>
            <div className="mt-1 text-xs text-white/60">
              Today's reading · {creditLabel(TRANSIT_COST)}, once per day
            </div>
          </div>
        </div>

        {needsProfile && !loading ? (
          <BirthProfileRequired
            title="Add your birth details"
            description="Transits are read against your birth chart. Create your birth profile to see where today's planets fall in your houses."
          />
        ) : needsChargeConfirm ? (
          <div
            role="region"
            aria-label="Unlock today's transits"
            className="max-w-2xl rounded-2xl border border-gold/20 bg-gold/5 p-5 md:p-6"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-gold/80">
              Today's transits · {creditLabel(TRANSIT_COST)}
            </p>
            <p className="mt-2 text-base leading-relaxed text-white/80">
              Today's planets read over your birth chart, with a written
              summary, cost {creditLabel(TRANSIT_COST)}. Opening them again
              today is free.
            </p>
            <p className="mt-1 text-sm text-white/55">
              You have {creditLabel(credits)}.
            </p>
            <div className="mt-4">
              {credits >= TRANSIT_COST ? (
                <button
                  type="button"
                  onClick={confirmCharge}
                  className="min-h-11 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-black transition hover:bg-gold/90"
                >
                  Open for {creditLabel(TRANSIT_COST)}
                </button>
              ) : (
                <Link
                  to="/wallet"
                  className="inline-flex min-h-11 items-center rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-black transition hover:bg-gold/90"
                >
                  Top up credits
                </Link>
              )}
            </div>
          </div>
        ) : errorKind === "credits" ? (
          <StatusNotice
            tone="info"
            size="section"
            className="max-w-2xl"
            message={error}
            action={{ label: "Top up credits", to: "/wallet" }}
          />
        ) : errorKind === "auth" ? (
          <StatusNotice
            tone="info"
            size="section"
            className="max-w-2xl"
            title="Sign in to see your transits"
            message="Transits are read over your own birth chart, so they need your AstroYou account."
            action={{ label: "Sign in", onClick: () => setShowAuthModal(true) }}
          />
        ) : (
        <>
        {/* View Mode Toggle */}
        <div className="flex gap-2 mb-4" role="group" aria-label="Chart view">
          <button
            type="button"
            aria-pressed={viewMode === "visual"}
            onClick={() => setViewMode("visual")}
            className={`flex min-h-11 items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border transition-all duration-300 ${
              viewMode === "visual"
                ? "bg-gold/10 border-gold/50 text-gold"
                : "bg-white/5 border-white/10 text-white/60 hover:text-white/80 hover:border-white/20"
            }`}
          >
            <Eye size={14} aria-hidden="true" />
            Visual
          </button>
          <button
            type="button"
            aria-pressed={viewMode === "table"}
            onClick={() => setViewMode("table")}
            className={`flex min-h-11 items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border transition-all duration-300 ${
              viewMode === "table"
                ? "bg-gold/10 border-gold/50 text-gold"
                : "bg-white/5 border-white/10 text-white/60 hover:text-white/80 hover:border-white/20"
            }`}
          >
            <Table2 size={14} aria-hidden="true" />
            Table
          </button>
        </div>

        {/* Current Transit Positions (visual cards, shown only in visual mode) */}
        {viewMode === "visual" && !loading && data && (
          <TransitPositionsTable data={data} />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 items-start">
          {/* Left Column: Visual Chart or Data Table */}
          <div className="lg:col-span-5 space-y-4">
            {viewMode === "table" ? (
              /* ── Full Data Table View ── */
              <div className="glass rounded-2xl p-4 overflow-x-auto border border-white/10">
                <h2 className="text-xs font-black uppercase tracking-[0.3em] text-gold/80 mb-2">
                  Where each planet is today
                </h2>
                <p className="mb-5 text-xs leading-relaxed text-white/60">
                  Degree is the planet's spot inside its sign (0–30°).
                  Backward (R, retrograde) planets tend to bring their themes
                  back for review; speed is degrees moved per day.
                </p>
                {loading ? (
                  <div className="flex items-center justify-center py-6">
                    <Compass
                      className="animate-spin-slow text-gold opacity-20"
                      size={48}
                    />
                  </div>
                ) : error ? (
                  <StatusNotice size="section" message={error} onRetry={retry} />
                ) : (
                  (() => {
                    const positions = extractPositions(data);
                    if (positions.length === 0) {
                      return (
                        <p className="text-white/60 text-sm text-center py-6">
                          No transit positions were returned for today.
                        </p>
                      );
                    }
                    return (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-white/55 text-xs uppercase tracking-widest border-b border-white/10">
                            <th className="text-left py-3 px-2">Planet</th>
                            <th className="text-left py-3 px-2">Sign</th>
                            <th className="text-right py-3 px-2">Degree</th>
                            <th className="text-center py-3 px-2">Motion</th>
                            <th className="text-right py-3 px-2">°/day</th>
                          </tr>
                        </thead>
                        <tbody>
                          {positions.map((p: any, i: number) => {
                            const cleanName = (p.name || "")
                              .replace("_transit", "")
                              .replace("_natal", "");
                            const planetInfo = (PLANETS as any)[cleanName];
                            const signFull =
                              SIGN_NAMES[p.sign] || p.sign || "—";
                            const deg =
                              typeof p.degree === "number"
                                ? p.degree
                                : typeof p.abs_pos === "number"
                                  ? p.abs_pos % 30
                                  : null;
                            const retro = p.is_retrograde || p.retrograde;

                            return (
                              <tr
                                key={i}
                                className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                              >
                                <td className="py-2.5 px-2 text-white/90 font-medium">
                                  <span
                                    className="mr-2"
                                    style={{
                                      color: planetInfo?.color || "#FFD700",
                                    }}
                                  >
                                    {planetInfo?.symbol || ""}
                                  </span>
                                  {cleanName}
                                </td>
                                <td className="py-2.5 px-2 text-white/70">
                                  {signFull}
                                </td>
                                <td className="py-2.5 px-2 text-white/60 text-right font-mono">
                                  {deg !== null ? `${deg.toFixed(2)}°` : "—"}
                                </td>
                                <td className="py-2.5 px-2 text-center">
                                  {retro ? (
                                    <span className="text-red-400 text-xs font-bold">
                                      Backward (R)
                                    </span>
                                  ) : (
                                    <span className="text-emerald-400 text-xs">
                                      Forward
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-2 text-white/55 text-right font-mono text-xs">
                                  {typeof p.speed === "number"
                                    ? p.speed.toFixed(4)
                                    : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    );
                  })()
                )}
              </div>
            ) : (
              /* ── Visual Chart View (original) ── */
              <div className="glass rounded-[2rem] border border-white/10 p-2 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Compass size={100} className="text-white" />
                </div>

                <div className="relative z-10">
                  <div className="flex items-center ml-4 mt-4 justify-between">
                    <div>
                      <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white/70 mb-1">
                        Today's planets in your houses
                      </h2>
                      <p className="text-xs text-white/60">
                        Each house is one area of life, counted from your{" "}
                        <GlossaryTerm k="lagna">Lagna</GlossaryTerm> (rising
                        sign). A planet in a house puts that area in focus.
                      </p>
                    </div>
                  </div>

                  <div className=" mx-auto">
                    {loading ? (
                      <div className="aspect-square flex items-center justify-center">
                        <Compass
                          className="animate-spin-slow text-gold opacity-20"
                          size={100}
                        />
                      </div>
                    ) : error ? (
                      <div className="aspect-square flex items-center justify-center text-center p-6">
                        <StatusNotice
                          size="section"
                          message={error}
                          onRetry={retry}
                        />
                      </div>
                    ) : (
                      <TransitOverlay
                        data={data}
                        className="scale-90 mx-auto"
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Educational Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="glass p-4 rounded-2xl border border-white/5 space-y-2">
                <h3 className="text-sm font-semibold text-white/85">
                  What a house means
                </h3>
                <p className="text-sm text-white/65 leading-relaxed">
                  A planet moving through a house brings its themes to that
                  part of life, from self in the 1st to career in the 10th.
                </p>
              </div>
              <div className="glass p-4 rounded-2xl border border-white/5 space-y-2">
                <h3 className="text-sm font-semibold text-white/85">
                  What an aspect means
                </h3>
                <p className="text-sm text-white/65 leading-relaxed">
                  An angle between a planet today and one in your birth chart.
                  The closer to exact (the smaller the orb, in degrees), the
                  more you feel it; each one passes in days to weeks.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Interpretation */}
          <div className="lg:col-span-5 space-y-4">
            {/* Gemini Summary Section */}
            <div className="flex flex-col gap-4">
              <h2 className="text-sm font-black uppercase tracking-[0.3em] text-gold/80 mb-2 px-2 flex items-center gap-2">
                <Sparkles size={14} className="text-gold" aria-hidden="true" />{" "}
                What today means for you
              </h2>

              <div className="glass p-4 rounded-2xl border border-gold/20 bg-gold/5 relative overflow-hidden group">
                {/* Background Decoration */}

                <div className="relative z-10">
                  <AnimatePresence mode="wait">
                    {loading ? (
                      <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col gap-3"
                      >
                        <div className="h-4 w-3/4 bg-gold/10 rounded-full animate-pulse" />
                        <div className="h-4 w-1/2 bg-gold/10 rounded-full animate-pulse" />
                      </motion.div>
                    ) : aiSummary ? (
                      <motion.div
                        key="summary"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                      >
                        <p className="max-w-[65ch] text-base leading-relaxed text-white/85">
                          {aiSummary}
                        </p>
                        <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                          <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center">
                            <Sparkles size={12} className="text-gold" />
                          </div>
                          <span className="text-xs font-black uppercase tracking-[0.2em] text-gold/80">
                            Transit reading
                          </span>
                        </div>
                      </motion.div>
                    ) : error ? (
                      <motion.p
                        key="error"
                        role="alert"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-sm text-white/70"
                      >
                        The summary couldn't be loaded because today's transits
                        failed to load. Use Try again above to reload them.
                      </motion.p>
                    ) : (
                      <motion.p
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-sm text-white/60"
                      >
                        No written summary is available for today's transits.
                        The positions and analysis on this page are still
                        current.
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="mb-2 px-2">
                <h2 className="text-sm font-black uppercase tracking-[0.3em] text-white/60">
                  Planet by planet
                </h2>
                <p className="mt-1 text-xs text-white/55">
                  Each active link between today's sky and your chart, and how
                  it may show up.
                </p>
              </div>

              {/* Its own scroll area only beside the chart on wide screens;
                  on a phone a nested scroller traps the page scroll. */}
              <div className="lg:overflow-y-auto lg:max-h-[755px] lg:pr-2 custom-scrollbar">
                <TransitPredictions
                  predictions={predictions || []}
                  fallbackAspects={data?.chart_data?.aspects}
                  loading={loading}
                  error={error}
                  onRetry={retry}
                />
              </div>
            </div>
          </div>
        </div>

        </>
        )}

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => setShowAuthModal(false)}
        />

        <AskJyotishBridge
          eyebrow="Take this further"
          question="What do today's transits over my chart mean for the decisions in front of me right now?"
        />
      </div>
    </PageShell>
  );
}
