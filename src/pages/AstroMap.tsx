import { useState, useEffect } from "react";
import { useUserProfile } from "../hooks";
import { useRequestBirthData } from "../hooks/useRequestBirthData";
import { MapPin, Globe, Loader2, Star } from "lucide-react";
import { StatusNotice } from "../components/ui/StatusNotice";
import { PageShell } from "../components/layout/PageShell";
import BirthProfileRequired from "../components/BirthProfileRequired";
import { postJson } from "../lib/apiFetch";
import {
  astroLineMeaning,
  astroZoneMeaning,
  formatZoneScore,
} from "../lib/astromap-meanings";

function txt(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

function arr(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
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

export default function AstroMap() {
  const { birthData, loading: profileLoading } = useUserProfile();
  const requestBirthData = useRequestBirthData(birthData);
  const [powerZones, setPowerZones] = useState<any>(null);
  const [lines, setLines] = useState<any>(null);
  const [zonesError, setZonesError] = useState(false);
  const [linesError, setLinesError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationAnalysis, setLocationAnalysis] = useState<any>(null);
  const [analyzingLocation, setAnalyzingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Fetch power zones + lines on mount
  useEffect(() => {
    if (profileLoading) return;
    if (!requestBirthData?.dob) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setZonesError(false);
    setLinesError(false);
    Promise.allSettled([
      fetchChart(requestBirthData, "POWER_ZONES", controller.signal),
      fetchChart(requestBirthData, "ASTRO_LINES", controller.signal),
    ]).then(([zonesRes, linesRes]) => {
      if (controller.signal.aborted) return;
      for (const r of [zonesRes, linesRes]) {
        if (r.status === "rejected")
          console.error("Astro map fetch failed:", r.reason);
      }
      setPowerZones(zonesRes.status === "fulfilled" ? zonesRes.value : null);
      setLines(linesRes.status === "fulfilled" ? linesRes.value : null);
      setZonesError(zonesRes.status === "rejected");
      setLinesError(linesRes.status === "rejected");
      setLoading(false);
    });
    return () => controller.abort();
  }, [requestBirthData, profileLoading, attempt]);

  const analyzeLocation = async (queryOverride?: string) => {
    const query = (queryOverride ?? locationQuery).trim();
    if (!query || !requestBirthData) return;
    setAnalyzingLocation(true);
    setLocationError(null);
    setLocationAnalysis(null);
    let geo: { lat: string; lon: string } | undefined;
    try {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
      );
      if (!geoRes.ok) throw new Error(`Geocode failed: ${geoRes.status}`);
      const results = await geoRes.json();
      geo = Array.isArray(results) ? results[0] : undefined;
    } catch (error) {
      console.error("Location geocode failed:", error);
      setLocationError(
        "We couldn't look up that city. Check your connection and try again.",
      );
      setAnalyzingLocation(false);
      return;
    }

    if (!geo) {
      setLocationError(
        `We couldn't find "${query}". Try the full city name, or add the country.`,
      );
      setAnalyzingLocation(false);
      return;
    }

    try {
      const res = await postJson("/api/kundali", {
        birthData: requestBirthData,
        chartType: "LOCATION_ANALYSIS",
        targetLat: parseFloat(geo.lat),
        targetLng: parseFloat(geo.lon),
      });
      if (!res.ok) throw new Error(`Location analysis failed: ${res.status}`);
      const data = await res.json();
      setLocationAnalysis({ ...(data?.data ?? {}), city: query });
    } catch (error) {
      console.error("Location analysis failed:", error);
      setLocationError(
        `We found ${query} but couldn't compare it with your chart. Try again in a moment.`,
      );
    }
    setAnalyzingLocation(false);
  };

  const zones = arr(powerZones?.zones ?? powerZones?.power_zones);
  const lineItems = arr(lines?.lines);
  // Both failed: one page-level notice. Exactly one failed: a notice in that
  // half, so the part that did load still shows.
  const mapError = zonesError && linesError;
  const retryMap = () => setAttempt((n) => n + 1);
  const showZonesHalf = !mapError && (zones.length > 0 || zonesError);
  const showLinesHalf = !mapError && (lineItems.length > 0 || linesError);
  const influences = arr(
    locationAnalysis?.influences ?? locationAnalysis?.aspects,
  );

  return (
    <PageShell>
      <h1 className="type-page-title mb-2">Astrocartography</h1>
      <p className="text-white/60 mb-8">
        Each planet in your chart is strongest along certain lines on the
        globe. See which places suit you for work, love or a fresh start.
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
          title="Create your birth profile to map your strongest places."
          description="Astrocartography needs your exact birth details before it can compare your chart against cities and planetary lines."
        />
      ) : (
        <>
          {/* Location Search */}
          <label
            htmlFor="astromap-city"
            className="block text-sm text-white/60 mb-2"
          >
            Thinking of moving, studying or travelling? Check a city against
            your chart
          </label>
          <div className="flex gap-3 mb-8 max-w-lg">
            <input
              id="astromap-city"
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && analyzeLocation()}
              placeholder="Search a city (e.g., London, Tokyo, New York)"
              className="platform-field flex-1 min-w-0 w-auto placeholder:text-white/50"
            />
            <button
              type="button"
              onClick={() => analyzeLocation()}
              disabled={analyzingLocation}
              aria-label="Analyze city"
              className="px-5 py-3 min-h-11 rounded-xl bg-gold text-black font-bold text-sm disabled:opacity-50"
            >
              {analyzingLocation ? (
                <Loader2
                  size={16}
                  className="animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <MapPin size={16} aria-hidden="true" />
              )}
            </button>
          </div>

          {locationError && (
            <StatusNotice
              size="section"
              message={locationError}
              className="-mt-5 mb-8 max-w-lg"
            />
          )}

          {/* Location Analysis Result: directly under the search, so the
                answer isn't buried below the zone and line lists. */}
          {locationAnalysis && (
            <div className="mb-8 glass rounded-[2rem] p-6">
              <h2 className="text-gold text-sm font-bold uppercase tracking-widest mb-4">
                {locationAnalysis.city} and your chart
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {influences.map((inf: any, i: number) => (
                  <div key={i} className="p-3 rounded-xl bg-white/5">
                    <p className="text-white/90 text-sm font-medium">
                      {txt(inf?.planet) || txt(inf?.name)}
                    </p>
                    <p className="text-white/65 text-sm leading-relaxed mt-1">
                      {txt(inf?.interpretation) || txt(inf?.description)}
                    </p>
                  </div>
                ))}
              </div>
              {txt(locationAnalysis.overall) && (
                <p className="max-w-[65ch] text-white/75 text-sm leading-relaxed mt-4">
                  {txt(locationAnalysis.overall)}
                </p>
              )}
              {influences.length === 0 && !txt(locationAnalysis.overall) && (
                <p className="text-white/60 text-sm">
                  No notable planetary influences were found for this city.
                </p>
              )}
            </div>
          )}

          {loading && (
            <div
              className="flex items-center justify-center py-20"
              role="status"
              aria-label="Loading"
            >
              <Loader2 size={32} className="animate-spin text-white/50" />
            </div>
          )}

          {!loading && mapError && (
            <StatusNotice
              className="mb-6"
              message="Your power zones and planetary lines couldn't be calculated. Check your connection and try again. City search above still works."
              onRetry={retryMap}
            />
          )}

          <div
            className={`grid grid-cols-1 gap-6 ${showZonesHalf && showLinesHalf ? "lg:grid-cols-2" : ""}`}
          >
            {/* Power Zones */}
            {!loading && showZonesHalf && zonesError && (
              <StatusNotice
                tone="info"
                size="section"
                message="Your power zones couldn't be calculated just now. Try again in a moment."
                onRetry={retryMap}
                className="self-start"
              />
            )}
            {!loading && zones.length > 0 && (
              <div className="glass rounded-[2rem] p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Star size={18} className="text-gold" />
                  <h2 className="text-gold text-sm font-bold uppercase tracking-widest">
                    Your Power Zones
                  </h2>
                </div>
                <p className="mb-4 text-sm leading-relaxed text-white/60">
                  Places where several of your planet lines meet. The
                  percentage is how well the place matches your chart; higher
                  is a stronger match.
                </p>
                <div className="space-y-3">
                  {zones.slice(0, 8).map((zone: any, i: number) => {
                    const title =
                      txt(zone?.location) ||
                      txt(zone?.city) ||
                      txt(zone?.name) ||
                      txt(zone?.region);
                    const cities = arr(zone?.nearby_cities)
                      .map(txt)
                      .filter((c) => c && c !== title)
                      .slice(0, 3);
                    const score = formatZoneScore(zone?.score);
                    const meaning =
                      astroZoneMeaning(zone ?? {}) || txt(zone?.description);
                    const themes = zone?.themes ?? zone?.life_areas;
                    return (
                      <div
                        key={i}
                        className="p-3 rounded-xl bg-white/5 border border-white/10"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-white/90 text-sm font-medium">
                            {title}
                          </span>
                          {score && (
                            <span className="text-gold text-xs font-bold">
                              {score}
                            </span>
                          )}
                        </div>
                        {cities.length > 0 && (
                          <p className="text-white/55 text-xs mt-0.5">
                            Near {cities.join(", ")}
                          </p>
                        )}
                        {meaning && (
                          <p className="text-white/60 text-xs mt-1">
                            {meaning}
                          </p>
                        )}
                        {themes && (
                          <p className="text-white/55 text-xs mt-1">
                            {Array.isArray(themes)
                              ? themes.map(txt).filter(Boolean).join(" · ")
                              : txt(themes)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Planetary Lines */}
            {!loading && showLinesHalf && linesError && (
              <StatusNotice
                tone="info"
                size="section"
                message="Your planetary lines couldn't be calculated just now. Try again in a moment."
                onRetry={retryMap}
                className="self-start"
              />
            )}
            {!loading && lineItems.length > 0 && (
              <div className="glass rounded-[2rem] p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Globe size={18} className="text-gold" />
                  <h2 className="text-gold text-sm font-bold uppercase tracking-widest">
                    Planetary Lines
                  </h2>
                </div>
                <p className="mb-2 text-sm leading-relaxed text-white/60">
                  Living near a planet's line turns up that planet's themes.
                  The short code says how:
                </p>
                <ul className="mb-4 grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-white/55 sm:grid-cols-2">
                  <li>
                    <span className="text-white/80">AC</span> where you feel
                    most yourself
                  </li>
                  <li>
                    <span className="text-white/80">MC</span> career and
                    reputation
                  </li>
                  <li>
                    <span className="text-white/80">DS</span> partners and
                    relationships
                  </li>
                  <li>
                    <span className="text-white/80">IC</span> home and roots
                  </li>
                </ul>
                <div className="space-y-2">
                  {lineItems.slice(0, 10).map((line: any, i: number) => {
                    // The API names the angle `line_type` ("AC", "MC", …).
                    const angle =
                      txt(line?.line_type) ||
                      txt(line?.type) ||
                      txt(line?.angle);
                    const meaning =
                      astroLineMeaning(line?.planet, angle) ||
                      txt(line?.meaning) ||
                      txt(line?.description);
                    return (
                      <div
                        key={i}
                        className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0"
                      >
                        <span className="text-amber-400 text-sm font-medium min-w-[80px]">
                          {txt(line?.planet)}
                        </span>
                        <span className="text-white/60 text-xs min-w-[30px]">
                          {angle}
                        </span>
                        <p className="text-white/65 text-xs flex-1">
                          {meaning}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {!loading &&
            !zonesError &&
            !linesError &&
            zones.length === 0 &&
            lineItems.length === 0 && (
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass rounded-2xl p-5">
                  <h2 className="text-gold text-sm font-bold uppercase tracking-widest mb-3">
                    Where to start
                  </h2>
                  <p className="text-white/55 text-sm leading-relaxed">
                    No power zones or planetary lines were returned for your
                    chart. Search a city above to compare it against your birth
                    profile directly.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {["Mumbai", "London", "Singapore", "New York"].map(
                      (city) => (
                        <button
                          key={city}
                          type="button"
                          onClick={() => {
                            setLocationQuery(city);
                            void analyzeLocation(city);
                          }}
                          disabled={analyzingLocation}
                          className="min-h-11 rounded-full border border-white/10 px-4 py-2 text-sm text-white/65 hover:border-gold/30 hover:text-gold disabled:opacity-50"
                        >
                          {city}
                        </button>
                      ),
                    )}
                  </div>
                </div>
                <div className="glass rounded-2xl p-5">
                  <h2 className="text-gold text-sm font-bold uppercase tracking-widest mb-3">
                    What the map reads
                  </h2>
                  <div className="grid gap-2 text-sm text-white/55">
                    {[
                      "Sun line: visibility and confidence",
                      "Moon line: belonging and emotional safety",
                      "Jupiter line: growth and opportunity",
                      "Saturn line: duty and long-term work",
                    ].map((item) => (
                      <div
                        key={item}
                        className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
        </>
      )}
    </PageShell>
  );
}
