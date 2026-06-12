import { useState, useEffect } from "react";
import { useUserProfile } from "../hooks";
import { useRequestBirthData } from "../hooks/useRequestBirthData";
import { MapPin, Globe, Loader2, Star } from "lucide-react";
import { PageShell } from "../components/layout/PageShell";
import BirthProfileRequired from "../components/BirthProfileRequired";
import { postJson } from "../lib/apiFetch";

export default function AstroMap() {
  const { birthData } = useUserProfile();
  const requestBirthData = useRequestBirthData(birthData);
  const [powerZones, setPowerZones] = useState<any>(null);
  const [lines, setLines] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationAnalysis, setLocationAnalysis] = useState<any>(null);
  const [analyzingLocation, setAnalyzingLocation] = useState(false);

  // Fetch power zones + lines on mount
  useEffect(() => {
    if (!requestBirthData?.dob) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => setLoading(false), 3200);
    const fetchData = async () => {
      setLoading(true);
      const [zonesRes, linesRes] = await Promise.all([
        postJson(
          "/api/kundali",
          { birthData: requestBirthData, chartType: "POWER_ZONES" },
          { signal: controller.signal },
        )
          .then((r) => r.json())
          .catch(() => null),
        postJson(
          "/api/kundali",
          { birthData: requestBirthData, chartType: "ASTRO_LINES" },
          { signal: controller.signal },
        )
          .then((r) => r.json())
          .catch(() => null),
      ]);
      setPowerZones(zonesRes?.data);
      setLines(linesRes?.data);
      window.clearTimeout(timeoutId);
      setLoading(false);
    };
    fetchData();
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [requestBirthData]);

  const analyzeLocation = async () => {
    if (!locationQuery.trim() || !requestBirthData) return;
    setAnalyzingLocation(true);
    // Use Nominatim to geocode, then analyze
    try {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationQuery)}&limit=1`,
      );
      const [geo] = await geoRes.json();
      if (!geo) {
        setAnalyzingLocation(false);
        return;
      }

      const res = await postJson("/api/kundali", {
        birthData: requestBirthData,
        chartType: "LOCATION_ANALYSIS",
        targetLat: parseFloat(geo.lat),
        targetLng: parseFloat(geo.lon),
      });
      const data = await res.json();
      setLocationAnalysis({ city: locationQuery, ...data.data });
    } catch (error) {
      console.error("Location analysis failed:", error);
    }
    setAnalyzingLocation(false);
  };

  return (
    <PageShell>

        <h1 className="text-3xl md:text-4xl font-display mb-2">
          Astrocartography
        </h1>
        <p className="text-white/50 mb-8">
          Discover where on Earth your stars shine brightest
        </p>

        {!requestBirthData?.dob ? (
          <BirthProfileRequired
            title="Create your birth profile to map your strongest places."
            description="Astrocartography needs your exact birth details before it can compare your chart against cities and planetary lines."
          />
        ) : (
          <>
            {/* Location Search */}
            <div className="flex gap-3 mb-8 max-w-lg">
              <input
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && analyzeLocation()}
                placeholder="Search a city (e.g., London, Tokyo, New York)"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold/50"
              />
              <button
                onClick={analyzeLocation}
                disabled={analyzingLocation}
                className="px-5 py-3 rounded-xl bg-gold text-black font-bold text-sm disabled:opacity-50"
              >
                {analyzingLocation ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <MapPin size={16} />
                )}
              </button>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={32} className="animate-spin text-white/30" />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Power Zones */}
              {powerZones && (
                <div className="glass rounded-[2rem] p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Star size={18} className="text-gold" />
                    <h2 className="text-gold text-sm font-bold uppercase tracking-widest">
                      Your Power Zones
                    </h2>
                  </div>
                  <div className="space-y-3">
                    {(powerZones.zones || powerZones.power_zones || [])
                      .slice(0, 8)
                      .map((zone: any, i: number) => (
                        <div
                          key={i}
                          className="p-3 rounded-xl bg-white/5 border border-white/10"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-white/90 text-sm font-medium">
                              {zone.location || zone.city || zone.name}
                            </span>
                            {zone.score && (
                              <span className="text-gold text-xs font-bold">
                                {zone.score}%
                              </span>
                            )}
                          </div>
                          {zone.description && (
                            <p className="text-white/50 text-xs mt-1">
                              {zone.description}
                            </p>
                          )}
                          {zone.themes && (
                            <p className="text-white/30 text-[10px] mt-1">
                              {Array.isArray(zone.themes)
                                ? zone.themes.join(" · ")
                                : zone.themes}
                            </p>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Planetary Lines */}
              {lines && (
                <div className="glass rounded-[2rem] p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Globe size={18} className="text-gold" />
                    <h2 className="text-gold text-sm font-bold uppercase tracking-widest">
                      Planetary Lines
                    </h2>
                  </div>
                  <div className="space-y-2">
                    {(lines.lines || [])
                      .slice(0, 10)
                      .map((line: any, i: number) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0"
                        >
                          <span className="text-amber-400 text-sm font-medium min-w-[80px]">
                            {line.planet}
                          </span>
                          <span className="text-white/40 text-xs min-w-[30px]">
                            {line.type || line.angle}
                          </span>
                          <p className="text-white/60 text-xs flex-1">
                            {line.meaning || line.description || ""}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {!loading && !powerZones && !lines && (
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass rounded-2xl p-5">
                  <h2 className="text-gold text-sm font-bold uppercase tracking-widest mb-3">
                    Where to start
                  </h2>
                  <p className="text-white/55 text-sm leading-relaxed">
                    Search a city above to compare it against your birth
                    profile. The live map engine checks planetary lines,
                    relocation themes, and practical fit.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {["Mumbai", "London", "Singapore", "New York"].map(
                      (city) => (
                        <button
                          key={city}
                          onClick={() => setLocationQuery(city)}
                          className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/55 hover:border-gold/30 hover:text-gold"
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

            {/* Location Analysis Result */}
            {locationAnalysis && (
              <div className="mt-8 glass rounded-[2rem] p-6">
                <h2 className="text-gold text-sm font-bold uppercase tracking-widest mb-4">
                  Analysis: {locationAnalysis.city}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(
                    locationAnalysis.influences ||
                    locationAnalysis.aspects ||
                    []
                  ).map((inf: any, i: number) => (
                    <div key={i} className="p-3 rounded-xl bg-white/5">
                      <p className="text-white/90 text-sm font-medium">
                        {inf.planet || inf.name}
                      </p>
                      <p className="text-white/50 text-xs mt-1">
                        {inf.interpretation || inf.description}
                      </p>
                    </div>
                  ))}
                </div>
                {locationAnalysis.overall && (
                  <p className="text-white/60 text-sm mt-4 italic">
                    {locationAnalysis.overall}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </PageShell>
  );
}
