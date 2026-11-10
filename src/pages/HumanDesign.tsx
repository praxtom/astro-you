import { useState, useEffect } from "react";
import { postJson } from "../lib/apiFetch";
import { useUserProfile } from "../hooks";
import { useRequestBirthData } from "../hooks/useRequestBirthData";
import { Loader2, Hexagon } from "lucide-react";
import { StatusNotice } from "../components/ui/StatusNotice";
import { PageShell } from "../components/layout/PageShell";
import BirthProfileRequired from "../components/BirthProfileRequired";
import {
  humanDesignAuthorityMeaning,
  humanDesignCenterLabel,
  humanDesignCenterMeaning,
  humanDesignProfileMeaning,
  humanDesignStrategyMeaning,
  humanDesignTypeLabel,
  humanDesignTypeMeaning,
} from "../lib/human-design-meanings";

function txt(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

/** One plain-language line under a value; renders nothing if unknown. */
function Meaning({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p className="mt-1 text-xs leading-relaxed text-white/60">{text}</p>
  );
}

/**
 * Bodygraph centres arrive as an array, as a map keyed by centre
 * ({ head: { center, defined } }), or as a defined_centers map of booleans.
 */
function readCenters(graph: any): { name: string; defined: boolean }[] | null {
  const source = graph?.centers ?? graph?.defined_centers;
  if (Array.isArray(source)) {
    return source.map((c: any) => ({
      name: txt(c?.name) || txt(c?.center),
      defined: Boolean(c?.defined || c?.is_defined),
    }));
  }
  if (source && typeof source === "object") {
    return Object.entries(source).map(([key, value]: [string, any]) =>
      value && typeof value === "object"
        ? {
            name: txt(value.name) || txt(value.center) || key,
            defined: Boolean(value.defined || value.is_defined),
          }
        : { name: key, defined: Boolean(value) },
    );
  }
  return null;
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

export default function HumanDesign() {
  const { birthData, loading: profileLoading } = useUserProfile();
  const requestBirthData = useRequestBirthData(birthData);
  const [hdType, setHdType] = useState<any>(null);
  const [bodygraph, setBodygraph] = useState<any>(null);
  const [typeError, setTypeError] = useState(false);
  const [graphError, setGraphError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const retry = () => setAttempt((n) => n + 1);

  // /human-design/bodygraph nests its result under `bodygraph`; the type
  // endpoint is flat. Fall back to the bodygraph for any field the quick type
  // call left out (it never returns a profile).
  const graph = bodygraph?.bodygraph ?? bodygraph;
  const rawType =
    txt(hdType?.type) || txt(hdType?.human_design_type) || txt(graph?.type);
  const typeLabel = humanDesignTypeLabel(rawType) ?? rawType;
  const strategy = txt(hdType?.strategy) || txt(graph?.strategy);
  const authority = txt(hdType?.authority) || txt(graph?.authority);
  const profile = txt(hdType?.profile) || txt(graph?.profile);
  const centers = readCenters(graph);

  useEffect(() => {
    if (profileLoading) return;
    if (!requestBirthData?.dob) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setTypeError(false);
    setGraphError(false);
    Promise.allSettled([
      fetchChart(requestBirthData, "HUMAN_DESIGN", controller.signal),
      fetchChart(requestBirthData, "BODYGRAPH", controller.signal),
    ]).then(([typeRes, graphRes]) => {
      if (controller.signal.aborted) return;
      if (typeRes.status === "fulfilled") setHdType(typeRes.value);
      else {
        console.error("Human Design type failed:", typeRes.reason);
        setHdType(null);
        setTypeError(true);
      }
      if (graphRes.status === "fulfilled") setBodygraph(graphRes.value);
      else {
        console.error("Bodygraph failed:", graphRes.reason);
        setBodygraph(null);
        setGraphError(true);
      }
      setLoading(false);
    });

    return () => controller.abort();
  }, [requestBirthData, profileLoading, attempt]);

  return (
    <PageShell>
      <h1 className="type-page-title mb-2 flex items-center gap-3">
        <Hexagon size={28} className="text-gold" aria-hidden="true" /> Human
        Design
      </h1>
      <p className="text-white/60 mb-8">
        How you are built to use your energy and make decisions, worked out
        from your birth moment
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
          title="Create your birth profile to see your Human Design."
          description="Your type, authority, profile, gates, and bodygraph need birth details before the system can calculate them."
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
          {/* Type & Strategy */}
          <div className="glass rounded-[2rem] p-6">
            <h2 className="text-gold text-sm font-bold uppercase tracking-widest mb-4">
              Your Type
            </h2>
            <p className="-mt-2 mb-4 text-sm text-white/60">
              Your type describes how your energy works best with other people.
            </p>
            {typeError ? (
              <StatusNotice
                size="section"
                message="Your type, strategy and authority couldn't be calculated. Check your connection and try again."
                onRetry={retry}
              />
            ) : typeLabel ? (
              <div className="space-y-4">
                <div>
                  <span className="text-3xl font-display">{typeLabel}</span>
                  {humanDesignTypeMeaning(rawType) && (
                    <p className="mt-2 text-sm leading-relaxed text-white/65">
                      {humanDesignTypeMeaning(rawType)}
                    </p>
                  )}
                </div>
                {(strategy || authority || profile) && (
                  <div className="grid grid-cols-1 gap-3">
                    {strategy && (
                      <div className="p-3 rounded-xl bg-white/5">
                        <span className="text-xs text-white/55 uppercase tracking-widest">
                          Strategy
                        </span>
                        <span className="block text-xs text-white/55">
                          How to say yes to new things without forcing them.
                        </span>
                        <p className="text-sm text-white/80 mt-1">
                          {strategy}
                        </p>
                        <Meaning text={humanDesignStrategyMeaning(strategy)} />
                      </div>
                    )}
                    {authority && (
                      <div className="p-3 rounded-xl bg-white/5">
                        <span className="text-xs text-white/55 uppercase tracking-widest">
                          Authority
                        </span>
                        <span className="block text-xs text-white/55">
                          Where your most reliable decisions come from.
                        </span>
                        <p className="text-sm text-white/80 mt-1">
                          {authority}
                        </p>
                        <Meaning text={humanDesignAuthorityMeaning(authority)} />
                      </div>
                    )}
                    {profile && (
                      <div className="p-3 rounded-xl bg-white/5">
                        <span className="text-xs text-white/55 uppercase tracking-widest">
                          Profile
                        </span>
                        <span className="block text-xs text-white/55">
                          The role you tend to play in life and with others.
                        </span>
                        <p className="text-sm text-white/80 mt-1">
                          {profile}
                        </p>
                        <Meaning text={humanDesignProfileMeaning(profile)} />
                      </div>
                    )}
                  </div>
                )}
                {txt(hdType?.description) && (
                  <p className="text-white/65 text-sm leading-relaxed">
                    {txt(hdType?.description)}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-white/60">
                The calculation returned no Human Design type for your birth
                details.
              </p>
            )}
          </div>

          {/* Bodygraph Centers */}
          <div className="glass rounded-[2rem] p-6">
            <h2 className="text-gold text-sm font-bold uppercase tracking-widest mb-4">
              Energy Centers
            </h2>
            <p className="-mt-2 mb-4 text-sm leading-relaxed text-white/60">
              Nine centers in the body.{" "}
              <span className="text-white/80">Defined</span> means steady
              energy you can always rely on.{" "}
              <span className="text-white/80">Open</span> means you take in and
              amplify the energy of people around you, which makes you adaptable
              there.
            </p>
            {graphError ? (
              <StatusNotice
                size="section"
                message="Your energy centers couldn't be calculated. Check your connection and try again."
                onRetry={retry}
              />
            ) : centers && centers.length > 0 ? (
              <div className="space-y-2">
                {centers.map((c, i) => (
                  <div key={i} className="p-3 rounded-xl bg-white/5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-white/80">
                        {humanDesignCenterLabel(c.name) ?? c.name}
                      </span>
                      <span
                        className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${c.defined ? "bg-gold/20 text-gold" : "bg-white/10 text-white/60"}`}
                      >
                        {c.defined ? "Defined" : "Open"}
                      </span>
                    </div>
                    <Meaning text={humanDesignCenterMeaning(c.name, c.defined)} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-white/60">
                The calculation returned no energy center data for your birth
                details.
              </p>
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}
