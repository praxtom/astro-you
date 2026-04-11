import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { TIERS, type TierConfig } from "../lib/subscriptions";
import { Check, ArrowRight, Zap } from "lucide-react";
import Header from "../components/layout/Header";

export default function Pricing() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleSelect = (tier: TierConfig) => {
    if (tier.id === "free") {
      navigate(user ? "/dashboard" : "/onboarding");
    } else {
      // Navigate to checkout (handled by subscription management)
      navigate(`/settings/subscription?plan=${tier.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#030308] text-white">
      <Header />
      <main className="container mx-auto pt-24 px-6 pb-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-display mb-3">
            Choose Your Path
          </h1>
          <p className="text-white/50 max-w-xl mx-auto">
            Expert AI astrology from ₹5/min. No hidden fees. Cancel anytime.
          </p>

          {/* AstroTalk comparison */}
          <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold/10 border border-gold/20">
            <Zap size={14} className="text-gold" />
            <span className="text-xs text-gold">
              AstroTalk charges ₹100/min. We charge ₹5/min. Same quality, 20x
              cheaper.
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {Object.values(TIERS).map((tier) => (
            <div
              key={tier.id}
              className={`relative rounded-[2rem] p-8 border transition-all hover:scale-[1.02] ${
                tier.popular
                  ? "bg-gold/5 border-gold/30 shadow-[0_0_30px_rgba(229,185,106,0.1)]"
                  : "bg-white/5 border-white/10"
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gold text-black text-xs font-bold uppercase tracking-widest">
                  Most Popular
                </div>
              )}

              <div className="text-center mb-6">
                <span className="text-3xl">{tier.badge}</span>
                <h2 className="text-xl font-display mt-2">{tier.name}</h2>
                <div className="mt-3">
                  {tier.price === 0 ? (
                    <span className="text-3xl font-bold">Free</span>
                  ) : (
                    <div>
                      <span className="text-3xl font-bold">₹{tier.price}</span>
                      <span className="text-white/40 text-sm">/month</span>
                    </div>
                  )}
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {tier.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-sm text-white/70"
                  >
                    <Check
                      size={16}
                      className="text-emerald-400 mt-0.5 flex-shrink-0"
                    />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelect(tier)}
                className={`w-full py-3 rounded-xl font-bold text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                  tier.popular
                    ? "bg-gold text-black hover:bg-gold/90"
                    : "border border-white/20 text-white/70 hover:border-gold/30 hover:text-gold"
                }`}
              >
                {tier.price === 0 ? "Get Started" : "Subscribe"}
                <ArrowRight size={16} />
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
