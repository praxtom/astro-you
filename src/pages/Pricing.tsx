import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, Loader2, Wallet } from "lucide-react";
import Header from "../components/layout/Header";
import { useAuth } from "../lib/useAuth";
import {
  CREDIT_PACKS,
  DEFAULT_CREDIT_PACK,
  formatCreditRate,
} from "../lib/credit-packs";
import { trackAcquisitionEvent } from "../lib/acquisition";
import { TIERS, type TierConfig } from "../lib/subscriptions";
import { useCreditTopup } from "../hooks/useCreditTopup";
import { TrustProofStrip } from "../components/trust/TrustProofStrip";

export default function Pricing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { buyCredits, isPaying, error: topupError } = useCreditTopup();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPackMinutes, setSelectedPackMinutes] = useState(
    DEFAULT_CREDIT_PACK.minutes,
  );
  const selectedPack =
    CREDIT_PACKS.find((pack) => pack.minutes === selectedPackMinutes) ??
    DEFAULT_CREDIT_PACK;

  const handleSelect = async (tier: TierConfig) => {
    if (tier.id === "free") {
      trackAcquisitionEvent("pricing_free_selected");
      navigate(user ? "/dashboard" : "/onboarding");
      return;
    }

    if (!user) {
      trackAcquisitionEvent("pricing_login_required", { tier: tier.id });
      navigate("/onboarding");
      return;
    }

    setLoadingTier(tier.id);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/subscription/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, tier: tier.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not start checkout");
      trackAcquisitionEvent("payment_checkout_started", { tier: tier.id });
      if (data.shortUrl) window.location.href = data.shortUrl;
    } catch (err) {
      console.error("Subscription checkout error:", err);
      setError(err instanceof Error ? err.message : "Subscription checkout failed");
    } finally {
      setLoadingTier(null);
    }
  };

  const handleTopup = async (minutes = selectedPack.minutes) => {
    if (!user) {
      trackAcquisitionEvent("topup_login_required");
      navigate("/onboarding");
      return;
    }
    await buyCredits(minutes);
  };

  return (
    <div className="min-h-screen bg-[#030308] text-white">
      <Header />
      <main className="platform-main">
        <section className="grid grid-cols-1 lg:grid-cols-[1fr_19rem] gap-4 items-start mb-4">
          <div>
            <p className="platform-eyebrow mb-2">Plans and Credits</p>
            <h1 className="type-page-title max-w-3xl">
              Start free. Pay when guidance becomes a habit.
            </h1>
            <p className="platform-copy mt-3 max-w-2xl">
              Subscriptions unlock recurring credits and deeper tools. Credit
              packs are available when you only need AI astrologer sessions or
              reports.
            </p>
          </div>
          <aside className="platform-panel-strong p-3">
            <p className="type-body-sm text-white/55">
              Credits are shared across Jyotish chat, AI astrologers, and PDF
              reports. AI astrologer sessions start at 5 credits/min.
            </p>
            <div className="mt-2 flex items-end justify-between border-t border-gold/20 pt-2">
              <div>
                <p className="type-meta uppercase text-gold/65">
                  Selected pack
                </p>
                <p className="type-card-title text-white mt-1">
                  {selectedPack.label}
                </p>
                <p className="type-meta text-white/35 mt-1">
                  {formatCreditRate(selectedPack)}
                </p>
              </div>
              <p className="type-price text-gold">
                ₹{selectedPack.amountInRupees}
              </p>
            </div>
            <button
              onClick={() => handleTopup()}
              disabled={isPaying}
              className="platform-button-primary mt-3 w-full"
            >
              {isPaying ? <Loader2 size={15} className="animate-spin" /> : <Wallet size={15} />}
              Buy selected pack
            </button>
          </aside>
        </section>

        {(error || topupError) && (
          <div className="platform-panel mb-4 border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
            {error || topupError}
          </div>
        )}

        <TrustProofStrip className="mb-4" />

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {Object.values(TIERS).map((tier) => (
            <PlanCard
              key={tier.id}
              tier={tier}
              isLoading={loadingTier === tier.id}
              isDisabled={loadingTier !== null}
              onSelect={() => handleSelect(tier)}
            />
          ))}
        </section>

        <section className="mt-4">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="platform-eyebrow mb-2">Credit Packs</p>
              <h2 className="type-section-title">Top up only when needed.</h2>
            </div>
            <p className="hidden sm:block type-body-sm text-white/40">
              Unused purchased credits stay in your wallet.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {CREDIT_PACKS.map((pack) => {
              const isSelected = pack.minutes === selectedPack.minutes;
              return (
                <button
                  key={pack.minutes}
                  onClick={() => {
                    setSelectedPackMinutes(pack.minutes);
                    trackAcquisitionEvent("pricing_pack_selected", {
                      credits: pack.minutes,
                      amount: pack.amountInRupees,
                    });
                  }}
                  className={`platform-panel p-4 text-left transition-colors ${
                    isSelected ? "border-gold/35 bg-gold/[0.07]" : "hover:border-white/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      {pack.badge && (
                        <span className="platform-chip text-gold border-gold/25">
                          {pack.badge}
                        </span>
                      )}
                      <p className="type-card-title text-white mt-3">
                        {pack.label}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="type-price text-gold">
                        ₹{pack.amountInRupees}
                      </p>
                      <p className="type-meta text-white/35 mt-1">
                        {formatCreditRate(pack)}
                      </p>
                    </div>
                  </div>
                  <p className="type-body-sm text-white/45 mt-3">
                    {pack.description}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-4 platform-panel p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="platform-eyebrow mb-2">Billing</p>
              <p className="type-body-sm text-white/55">Razorpay checkout. Cancel anytime.</p>
            </div>
            <div>
              <p className="platform-eyebrow mb-2">Consults</p>
              <p className="type-body-sm text-white/55">Credits are charged by completed minutes.</p>
            </div>
            <div>
              <p className="platform-eyebrow mb-2">Reports</p>
              <p className="type-body-sm text-white/55">Generated PDFs are saved for redownload.</p>
            </div>
            <div>
              <p className="platform-eyebrow mb-2">Value</p>
              <p className="type-body-sm text-white/55">Pricing is shown before you start.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function PlanCard({
  tier,
  isLoading,
  isDisabled,
  onSelect,
}: {
  tier: TierConfig;
  isLoading: boolean;
  isDisabled: boolean;
  onSelect: () => void;
}) {
  return (
    <article
      className={`platform-panel p-4 flex flex-col ${
        tier.popular ? "border-gold/35 bg-gold/[0.07]" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          {tier.popular && (
            <span className="platform-chip mb-3 text-gold border-gold/25">
              Most chosen
            </span>
          )}
          <h2 className="type-section-title text-white">{tier.name}</h2>
          <p className="type-body-sm text-white/45 mt-2">
            {tier.id === "free"
              ? "Good for trying the platform."
              : tier.id === "premium"
                ? "Best for daily use and reports."
                : "For heavy consults and advanced tools."}
          </p>
        </div>
        <div className="text-right">
          {tier.price === 0 ? (
            <p className="type-price">Free</p>
          ) : (
            <>
              <p className="type-price">₹{tier.price}</p>
              <p className="type-meta text-white/35">per month</p>
            </>
          )}
        </div>
      </div>

      <div className="my-4 grid grid-cols-2 gap-3">
        <div className="border-t border-white/10 pt-3">
          <p className="type-meta text-white/35">Credits</p>
          <p className="type-card-title text-white">{tier.limits.credits}</p>
        </div>
        <div className="border-t border-white/10 pt-3">
          <p className="type-meta text-white/35">Consult time</p>
          <p className="type-card-title text-white">
            {tier.limits.consultMinutesPerMonth} min
          </p>
        </div>
      </div>

      <ul className="space-y-2.5 flex-1">
        {tier.features.map((feature) => (
          <li key={feature} className="flex gap-2 type-body-sm text-white/65">
            <Check size={15} className="mt-0.5 shrink-0 text-emerald-300" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={onSelect}
        disabled={isDisabled}
        className={`mt-4 w-full ${
          tier.popular ? "platform-button-primary" : "platform-button-secondary"
        } disabled:opacity-50`}
      >
        {isLoading ? "Starting..." : tier.price === 0 ? "Get started" : "Subscribe"}
        {!isLoading && <ArrowRight size={15} />}
      </button>
    </article>
  );
}
