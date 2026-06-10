import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { getTrustProofMetrics } from "../../lib/trust-summary";
import { useTrustSummary } from "../../hooks/useTrustSummary";

export function TrustProofStrip({ className = "" }: { className?: string }) {
  const { summary } = useTrustSummary();
  const metrics = getTrustProofMetrics(summary);

  return (
    <section className={`platform-panel p-3 ${className}`}>
      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg border border-gold/20 bg-gold/10 p-1.5 text-gold">
            <ShieldCheck size={17} />
          </div>
          <div>
            <p className="platform-eyebrow mb-1">Trust signals</p>
            <p className="type-body-sm text-white/55">
              Public stories and reviews come from user submissions after moderation.
              Prediction feedback is aggregate-only.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2"
            >
              <p className="type-meta text-white/35">{metric.label}</p>
              <p className="mt-1 text-sm font-semibold text-gold">{metric.value}</p>
            </div>
          ))}
        </div>
      </div>
      <Link
        to="/trust"
        className="mt-3 inline-flex type-meta uppercase text-gold"
      >
        View transparency
      </Link>
    </section>
  );
}
