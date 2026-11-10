import { useState, useEffect } from "react";
import { postJson } from "../lib/apiFetch";
import { useUserProfile } from "../hooks";
import { useRequestBirthData } from "../hooks/useRequestBirthData";
import { Loader2, Gauge, Calendar } from "lucide-react";
import { StatusNotice } from "../components/ui/StatusNotice";
import { PageShell } from "../components/layout/PageShell";
import BirthProfileRequired from "../components/BirthProfileRequired";

function txt(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Classical Parashari minimum Shadbala, in rupas (1 rupa = 60 virupas). The
 * same table the astrology API documents for /vedic/shadbala.
 */
const REQUIRED_RUPAS: Record<string, number> = {
  sun: 6.5,
  moon: 6,
  mars: 5,
  mercury: 7,
  jupiter: 6.5,
  venus: 5.5,
  saturn: 5,
};

type StrengthBand = "strong" | "moderate" | "weak";

interface PlanetStrength {
  name: string;
  /** Total strength in rupas, when known. */
  rupas: number | null;
  /** Strength as a multiple of what the planet needs (1 = exactly enough). */
  ratio: number | null;
  /** Bar fill, 0–100. */
  barPct: number;
  band: StrengthBand;
}

interface ShadbalaView {
  planets: PlanetStrength[];
  /** "required": read against each planet's classical minimum.
   *  "relative": no minimum available, compared with the strongest planet. */
  mode: "required" | "relative";
  /** Where the "needs this much" line sits on the bar, 0–100. */
  requiredMarkPct: number | null;
}

/**
 * /vedic/shadbala returns `{ shadbala: { Sun: {...}, Moon: {...} }, summary }`.
 * The spec documents two per-planet shapes:
 *   { total_strength (virupas), required_strength (virupas), percentage, ... }
 *   { total: { total_virupas, total_rupas, percentage_of_required, strength_status }, ... }
 * Older array shapes are accepted too.
 */
function readShadbala(raw: any): ShadbalaView {
  const source = raw?.shadbala ?? raw?.planets ?? raw?.strengths ?? raw;
  const entries: Array<[string, any]> = Array.isArray(source)
    ? source.map((p: any) => [txt(p?.planet) || txt(p?.name), p])
    : source && typeof source === "object"
      ? Object.entries(source)
      : [];

  const parsed = entries
    .filter(([name, p]) => name && p && typeof p === "object")
    .map(([name, p]) => {
      const total = p.total && typeof p.total === "object" ? p.total : null;
      const virupas =
        num(total?.total_virupas) ??
        num(p.total_virupas) ??
        num(p.total_strength) ??
        (total ? null : num(p.total)) ??
        num(p.shadbala) ??
        num(p.strength) ??
        num(p.score);
      const rupas =
        num(total?.total_rupas) ??
        num(p.total_rupas) ??
        (virupas !== null ? virupas / 60 : null);
      const requiredVirupas =
        num(p.required_strength) ??
        num(p.required_virupas) ??
        (num(p.required_rupas) !== null ? num(p.required_rupas)! * 60 : null) ??
        (REQUIRED_RUPAS[name.toLowerCase()] !== undefined
          ? REQUIRED_RUPAS[name.toLowerCase()] * 60
          : null);
      const percent =
        num(total?.percentage_of_required) ??
        num(p.percentage_of_required) ??
        num(p.percentage);
      const ratio =
        percent !== null
          ? percent / 100
          : virupas !== null && requiredVirupas
            ? virupas / requiredVirupas
            : null;
      return { name, rupas, virupas, ratio };
    });

  if (parsed.length > 0 && parsed.every((p) => p.ratio !== null)) {
    // Scale so the strongest planet nearly fills the bar but the "needs" line
    // never sits at the very end.
    const scale = Math.max(1.25, ...parsed.map((p) => p.ratio!)) * 1.05;
    return {
      mode: "required",
      requiredMarkPct: (1 / scale) * 100,
      planets: parsed.map((p) => ({
        name: p.name,
        rupas: p.rupas,
        ratio: p.ratio,
        barPct: Math.min(100, (p.ratio! / scale) * 100),
        band: p.ratio! >= 1 ? "strong" : p.ratio! >= 0.75 ? "moderate" : "weak",
      })),
    };
  }

  const scored = parsed.filter((p) => p.virupas !== null);
  const max = Math.max(0, ...scored.map((p) => p.virupas!));
  return {
    mode: "relative",
    requiredMarkPct: null,
    planets:
      max > 0
        ? scored.map((p) => {
            const share = p.virupas! / max;
            return {
              name: p.name,
              rupas: p.rupas,
              ratio: null,
              barPct: share * 100,
              band: share >= 0.85 ? "strong" : share >= 0.65 ? "moderate" : "weak",
            };
          })
        : [],
  };
}

const BAND_LABEL: Record<StrengthBand, string> = {
  strong: "Strong",
  moderate: "Moderate",
  weak: "Needs support",
};

const BAND_BAR: Record<StrengthBand, string> = {
  strong: "bg-emerald-400",
  moderate: "bg-amber-400",
  weak: "bg-red-400",
};

/** "1.3× the strength it needs" above the minimum, "62% of …" below it. */
function describeRatio(ratio: number) {
  return ratio >= 1
    ? `${ratio.toFixed(ratio >= 10 ? 0 : 1)}× the strength it needs`
    : `${Math.round(ratio * 100)}% of the strength it needs`;
}

async function fetchChart(
  birthData: unknown,
  chartType: string,
  signal: AbortSignal,
): Promise<any> {
  const res = await postJson(
    "/api/kundali",
    { birthData, chartType },
    { signal },
  );
  if (!res.ok) throw new Error(`${chartType} failed: ${res.status}`);
  const json = await res.json();
  return json?.data ?? null;
}

export default function AdvancedVedic() {
  const { birthData, loading: profileLoading } = useUserProfile();
  const requestBirthData = useRequestBirthData(birthData);
  const [shadbala, setShadbala] = useState<any>(null);
  const [varshaphal, setVarshaphal] = useState<any>(null);
  const [shadbalaError, setShadbalaError] = useState(false);
  const [varshaphalError, setVarshaphalError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const retry = () => setAttempt((n) => n + 1);

  useEffect(() => {
    if (profileLoading) return;
    if (!requestBirthData?.dob) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setShadbalaError(false);
    setVarshaphalError(false);
    Promise.allSettled([
      fetchChart(requestBirthData, "SHADBALA", controller.signal),
      fetchChart(requestBirthData, "VARSHAPHAL", controller.signal),
    ]).then(([shadRes, varshRes]) => {
      if (controller.signal.aborted) return;
      if (shadRes.status === "fulfilled") setShadbala(shadRes.value);
      else {
        console.error("Shadbala failed:", shadRes.reason);
        setShadbala(null);
        setShadbalaError(true);
      }
      if (varshRes.status === "fulfilled") setVarshaphal(varshRes.value);
      else {
        console.error("Varshaphal failed:", varshRes.reason);
        setVarshaphal(null);
        setVarshaphalError(true);
      }
      setLoading(false);
    });

    return () => controller.abort();
  }, [requestBirthData, profileLoading, attempt]);

  const strength = readShadbala(shadbala);
  const planets = strength.planets;
  const strongestName =
    strength.mode === "relative"
      ? planets.reduce<PlanetStrength | null>(
          (best, p) => (!best || p.barPct > best.barPct ? p : best),
          null,
        )?.name
      : undefined;
  const varshaText =
    txt(varshaphal?.predictions) ||
    txt(varshaphal?.interpretation) ||
    txt(varshaphal?.summary);
  const muntha = txt(varshaphal?.muntha) || txt(varshaphal?.muntha?.sign);
  const keyPeriods: any[] = Array.isArray(varshaphal?.key_periods)
    ? varshaphal.key_periods
    : [];
  const hasVarshaphal = Boolean(
    txt(varshaphal?.year_lord) || varshaText || muntha || keyPeriods.length,
  );

  return (
    <PageShell>
      <h1 className="type-page-title mb-2">Advanced Vedic Analysis</h1>
      <p className="text-white/60 mb-8">
        Which of your planets are strongest, and what your current birthday
        year holds
      </p>

      {profileLoading ? (
        <div
          className="flex items-center justify-center py-20"
          role="status"
          aria-label="Loading"
        >
          <Loader2 size={32} className="animate-spin text-white/50" />
        </div>
      ) : !requestBirthData?.dob ? (
        <BirthProfileRequired
          title="Create your birth profile to unlock advanced Vedic analysis."
          description="Shadbala strength and yearly Varshaphal need your birth date, time, and place so the results are calculated for your chart."
        />
      ) : loading ? (
        <div
          className="flex items-center justify-center py-20"
          role="status"
          aria-label="Loading"
        >
          <Loader2 size={32} className="animate-spin text-white/50" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Shadbala */}
          <div className="glass rounded-[2rem] p-6">
            <div className="flex items-center gap-2 mb-4">
              <Gauge size={18} className="text-gold" />
              <h2 className="text-gold text-sm font-bold uppercase tracking-widest">
                Planet strength (Shadbala)
              </h2>
            </div>
            <p className="mb-4 text-sm leading-relaxed text-white/60">
              A strong planet delivers its themes easily in your life; a weaker
              one asks for more effort there.{" "}
              {strength.mode === "required"
                ? "Each planet needs a set amount of strength to give its results fully. The line on each bar marks that amount."
                : "Each bar is compared with the strongest planet in your chart."}
            </p>
            {shadbalaError ? (
              <StatusNotice
                size="section"
                message="Planetary strength couldn't be calculated. Check your connection and try again."
                onRetry={retry}
              />
            ) : planets.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-white/55 text-xs uppercase tracking-widest border-b border-white/10">
                      <th className="text-left py-2 px-2">Planet</th>
                      <th className="text-left py-2 px-2 w-3/5">
                        {strength.mode === "required"
                          ? "Strength vs. what it needs"
                          : "Strength"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {planets.map((p) => {
                      const detail =
                        p.ratio !== null
                          ? describeRatio(p.ratio)
                          : p.name === strongestName
                            ? "Strongest in your chart"
                            : `${Math.round(p.barPct)}% of your strongest`;
                      return (
                        <tr key={p.name} className="border-b border-white/5">
                          <td className="py-2.5 px-2 align-top text-white/90">
                            {p.name}
                          </td>
                          <td className="py-2.5 px-2">
                            <div
                              className="relative h-2 bg-white/10 rounded-full overflow-hidden"
                              role="img"
                              aria-label={`${p.name}: ${detail}, ${BAND_LABEL[p.band].toLowerCase()}`}
                            >
                              <div
                                className={`h-full rounded-full ${BAND_BAR[p.band]}`}
                                style={{ width: `${p.barPct}%` }}
                              />
                              {strength.requiredMarkPct !== null && (
                                <span
                                  className="absolute inset-y-0 w-0.5 bg-white/80"
                                  style={{ left: `${strength.requiredMarkPct}%` }}
                                  aria-hidden="true"
                                />
                              )}
                            </div>
                            <p className="mt-1 text-xs text-white/60">
                              {detail} · {BAND_LABEL[p.band]}
                            </p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/55">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
                    Strong
                    {strength.mode === "required"
                      ? " (has all it needs)"
                      : " (85%+ of your strongest)"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />
                    Moderate
                    {strength.mode === "required" ? " (75–99%)" : " (65–84%)"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-red-400" aria-hidden="true" />
                    Needs support
                    {strength.mode === "required" ? " (under 75%)" : " (under 65%)"}
                  </span>
                  {strength.requiredMarkPct !== null && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-3 w-0.5 bg-white/80" aria-hidden="true" />
                      Strength it needs
                    </span>
                  )}
                </p>
              </div>
            ) : (
              <p className="text-sm text-white/60">
                The calculation returned no planetary strength scores for your
                chart.
              </p>
            )}
          </div>

          {/* Varshaphal */}
          <div className="glass rounded-[2rem] p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={18} className="text-gold" />
              <h2 className="text-gold text-sm font-bold uppercase tracking-widest">
                Your year ahead (Varshaphal)
              </h2>
            </div>
            <p className="mb-4 text-sm leading-relaxed text-white/60">
              A chart cast for your latest birthday, read for the twelve months
              until the next one.
            </p>
            {varshaphalError ? (
              <StatusNotice
                size="section"
                message="Your annual chart couldn't be calculated. Check your connection and try again."
                onRetry={retry}
              />
            ) : hasVarshaphal ? (
              <div className="space-y-4">
                {txt(varshaphal.year_lord) && (
                  <div className="p-4 rounded-xl bg-gold/5 border border-gold/20 text-center">
                    <span className="text-xs text-gold/80 uppercase tracking-widest">
                      Ruler of your year
                    </span>
                    <p className="text-2xl font-display text-gold mt-1">
                      {txt(varshaphal.year_lord)}
                    </p>
                    <p className="mt-1 text-xs text-white/55">
                      This planet sets the year's main theme.
                    </p>
                  </div>
                )}
                {varshaText && (
                  <p className="text-white/65 text-sm leading-relaxed">
                    {varshaText}
                  </p>
                )}
                {muntha && (
                  <div className="p-3 rounded-xl bg-white/5">
                    <span className="text-xs text-white/55 uppercase tracking-widest">
                      Focus point (Muntha)
                    </span>
                    <p className="text-sm text-white/80 mt-1">{muntha}</p>
                    <p className="mt-1 text-xs text-white/55">
                      Moves one sign each birthday and points to where this
                      year's attention goes.
                    </p>
                  </div>
                )}
                {keyPeriods.length > 0 && (
                  <div>
                    <span className="text-xs text-white/55 uppercase tracking-widest">
                      Dates to note
                    </span>
                    <div className="space-y-2 mt-2">
                      {keyPeriods.slice(0, 6).map((p: any, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-amber-400 min-w-[80px] shrink-0">
                            {txt(p?.period) || txt(p?.date)}
                          </span>
                          <span className="text-white/60">
                            {txt(p?.description) || txt(p?.prediction)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-white/60">
                The calculation returned no annual chart details for this year.
              </p>
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}
