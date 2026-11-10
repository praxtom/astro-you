import { isRazorpayHostedUrl } from "../lib/payment-navigation";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { requestSignIn } from "../lib/auth-prompt";
import { ArrowRight, Check, Loader2, Wallet } from "lucide-react";
import { useAuth } from "../lib/useAuth";
import {
  CREDIT_PACKS,
  DEFAULT_CREDIT_PACK,
  formatCreditRate,
} from "../lib/credit-packs";
import { trackAcquisitionEvent } from "../lib/acquisition";
import {
  PAID_CHAT_FAIR_USE_PER_DAY,
  TIERS,
  type TierConfig,
} from "../lib/subscriptions";
import { REPORT_PRICING } from "../lib/report-pricing";
import { PERSONAS } from "../lib/personas";
import { useCreditTopup } from "../hooks/useCreditTopup";
import { TrustProofStrip } from "../components/trust/TrustProofStrip";
import { StatusNotice } from "../components/ui/StatusNotice";
import { useCurrency } from "../hooks/useCurrency";
import {
  formatMoney,
  SUPPORTED_CURRENCIES,
} from "../lib/currency";
import { getPackAmount } from "../lib/credit-packs";

/** Per-minute rates actually charged by the guides, lowest first. */
const GUIDE_RATES = [...new Set(PERSONAS.map((p) => p.pricePerMin))].sort(
  (a, b) => a - b,
);
const GUIDE_RATE_LABEL = `${GUIDE_RATES.slice(0, -1).join(", ")} or ${
  GUIDE_RATES[GUIDE_RATES.length - 1]
}`;
/** Rupees per credit across packs and plans, cheapest and dearest. */
const INR_PER_CREDIT = [
  ...CREDIT_PACKS.map((pack) => pack.amounts.INR / pack.minutes),
  ...Object.values(TIERS)
    .filter((tier) => tier.prices.INR > 0 && tier.limits.credits > 0)
    .map((tier) => tier.prices.INR / tier.limits.credits),
];
const formatRupeeRate = (n: number) => `₹${n.toFixed(2)}`;
const CREDIT_RUPEE_RANGE = `${formatRupeeRate(
  Math.min(...INR_PER_CREDIT),
)} to ${formatRupeeRate(Math.max(...INR_PER_CREDIT))}`;
const REPORT_COSTS = Object.values(REPORT_PRICING).sort(
  (a, b) => a.creditCost - b.creditCost,
);

export default function Pricing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { buyCredits, isPaying, error: topupError } = useCreditTopup();
  const { currency, setCurrency } = useCurrency();
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
      // Sign in here, then land back on Pricing with this checkout resumed.
      if (!requestSignIn({ returnTo: `/pricing?resume=${tier.id}` }))
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
      if (!isRazorpayHostedUrl(data.shortUrl)) throw new Error("Hosted subscription checkout is unavailable. Please try again shortly.");
      window.location.assign(data.shortUrl);
    } catch (err) {
      console.error("Subscription checkout error:", err);
      setError(
        err instanceof Error ? err.message : "Subscription checkout failed",
      );
    } finally {
      setLoadingTier(null);
    }
  };

  const handleTopup = async (minutes = selectedPack.minutes) => {
    if (!user) {
      trackAcquisitionEvent("topup_login_required");
      if (!requestSignIn({ returnTo: `/pricing?resume=topup-${minutes}` }))
        navigate("/onboarding");
      return;
    }
    await buyCredits(minutes);
  };

  // Resume the checkout a guest picked before signing in (?resume=<tier> or
  // ?resume=topup-<minutes>). Runs once: the param is removed first.
  const [searchParams, setSearchParams] = useSearchParams();
  const resume = searchParams.get("resume");
  useEffect(() => {
    if (!user || !resume) return;
    setSearchParams(
      (params) => {
        params.delete("resume");
        return params;
      },
      { replace: true },
    );
    const topup = /^topup-(\d+)$/.exec(resume);
    if (topup) {
      const pack = CREDIT_PACKS.find((p) => p.minutes === Number(topup[1]));
      if (pack) {
        setSelectedPackMinutes(pack.minutes);
        void handleTopup(pack.minutes);
      }
      return;
    }
    const tier = Object.values(TIERS).find((t) => t.id === resume);
    if (tier && tier.id !== "free") void handleSelect(tier);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, resume]);

  return (
    <div>
      <div className="platform-main">
        {/* Currency — the choice persists on the profile, so signed-in only. */}
        {user && SUPPORTED_CURRENCIES.length > 1 && (
          <div className="mb-4 flex items-center justify-end gap-2">
            <span className="type-meta text-white/50">Credit pack currency</span>
            <div
              className="flex overflow-hidden rounded-xl border border-white/10"
              role="group"
              aria-label="Display currency"
            >
              {SUPPORTED_CURRENCIES.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => void setCurrency(code)}
                  aria-pressed={currency === code}
                  className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                    currency === code
                      ? "bg-gold/15 text-gold"
                      : "text-white/55 hover:text-white/70"
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
        )}
        <section className="mb-4">
          <p className="platform-eyebrow mb-2">Plans and Credits</p>
          <h1 className="type-page-title max-w-3xl">
            Start free. Pay when guidance becomes a habit.
          </h1>
          <p className="platform-copy mt-3 max-w-2xl">
            Credits are how you pay inside AstroYou: 1 chat message is 1
            credit, a guide session is a few credits a minute. You get{" "}
            {TIERS.free.limits.credits} free when you sign up. After that, a
            credit costs {CREDIT_RUPEE_RANGE} depending on the pack or plan.
          </p>
          <p className="platform-copy mt-2 max-w-2xl">
            Plans add credits every month and make Jyotish chat unlimited.
            Credit packs are a one-time top-up, for when you only need guide
            sessions or reports.
          </p>
        </section>

        {error && (
          <StatusNotice size="section" className="mb-4" message={error} />
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
          <div className="mb-3">
            <p className="platform-eyebrow mb-2">Credit Packs</p>
            <h2 className="type-section-title">Top up only when needed.</h2>
            <p className="mt-1 type-body-sm text-white/55">
              Unused purchased credits stay in your wallet.
            </p>
            <p className="mt-1 type-body-sm text-white/55">
              Credits are shared across Jyotish chat, guide sessions and PDF
              reports. Guide sessions start at {GUIDE_RATES[0]} credits/min.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {CREDIT_PACKS.map((pack) => {
              const isSelected = pack.minutes === selectedPack.minutes;
              return (
                <button
                  key={pack.minutes}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    setSelectedPackMinutes(pack.minutes);
                    trackAcquisitionEvent("pricing_pack_selected", {
                      credits: pack.minutes,
                      amount: pack.amountInRupees,
                    });
                  }}
                  className={`platform-panel p-4 text-left transition-colors ${
                    isSelected
                      ? "border-gold/35 bg-gold/[0.07]"
                      : "hover:border-white/20"
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
                        {formatMoney(getPackAmount(pack, currency), currency)}
                      </p>
                      <p className="type-meta text-white/50 mt-1">
                        {formatCreditRate(pack, currency)}
                      </p>
                    </div>
                  </div>
                  <p className="type-body-sm text-white/55 mt-3">
                    {pack.description}
                  </p>
                </button>
              );
            })}
          </div>
          {/* The buy box sits under the picker it acts on: choose, then pay. */}
          <div className="platform-panel-strong mt-3 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-end justify-between gap-4 sm:justify-start sm:gap-6">
              <div>
                <p className="type-meta uppercase text-gold/65">
                  Selected pack
                </p>
                <p className="type-card-title text-white mt-1">
                  {selectedPack.label}
                </p>
                <p className="type-meta text-white/50 mt-1">
                  {formatCreditRate(selectedPack, currency)}
                </p>
              </div>
              <p className="type-price text-gold">
                {formatMoney(getPackAmount(selectedPack, currency), currency)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleTopup()}
              disabled={isPaying}
              className="platform-button-primary w-full sm:w-auto sm:min-w-[14rem]"
            >
              {isPaying ? (
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              ) : (
                <Wallet size={15} aria-hidden="true" />
              )}
              Buy selected pack
            </button>
          </div>
          {topupError && (
            <StatusNotice size="section" className="mt-3" message={topupError} />
          )}
        </section>

        <section className="mt-4 platform-panel p-4">
          <p className="platform-eyebrow mb-2">What things cost</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="type-card-title text-white">Jyotish chat</p>
              <p className="type-body-sm text-white/55 mt-1">
                1 credit per message on the free plan and credit packs.
                Unlimited on Premium and Pro, with a fair-use limit of{" "}
                {PAID_CHAT_FAIR_USE_PER_DAY} messages a day.
              </p>
            </div>
            <div>
              <p className="type-card-title text-white">Guide sessions</p>
              <p className="type-body-sm text-white/55 mt-1">
                {GUIDE_RATE_LABEL} credits per minute, depending on the guide
                (so 10 minutes at {GUIDE_RATES[0]}/min is{" "}
                {GUIDE_RATES[0] * 10} credits). The clock runs from your first message until the session
                closes, and a partial minute is charged as a full minute. A
                session where you send nothing costs nothing.
              </p>
            </div>
            <div>
              <p className="type-card-title text-white">PDF reports</p>
              <ul className="type-body-sm text-white/55 mt-1 space-y-0.5">
                {REPORT_COSTS.map((report) => (
                  <li key={report.type}>
                    {report.title}: {report.creditCost} credits
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="type-body-sm text-white/55 mt-3">
            Weekly, monthly and yearly forecasts, transit readings and
            compatibility readings cost a few credits per view, for every
            plan. Free Kundali, Kundali matching and daily Panchang cost
            nothing.
          </p>
        </section>

        {/* Billing terms. The partial-minute rule is stated under "Guide
            sessions" above, so it isn't repeated here. */}
        <ul className="mt-4 grid grid-cols-1 gap-2 px-1 type-body-sm text-white/55 md:grid-cols-3">
          <li>
            <span className="font-semibold text-white/75">Billing:</span>{" "}
            Razorpay checkout in INR. Cancel anytime.
          </li>
          <li>
            <span className="font-semibold text-white/75">Reports:</span>{" "}
            Generated PDFs are saved for redownload.
          </li>
          <li>
            <span className="font-semibold text-white/75">No surprises:</span>{" "}
            Pricing is shown before you start.
          </li>
        </ul>
      </div>
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
        tier.recommended ? "border-gold/35 bg-gold/[0.07]" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          {tier.recommended && (
            <span className="platform-chip mb-3 text-gold border-gold/25">
              Recommended
            </span>
          )}
          <h2 className="type-section-title text-white">{tier.name}</h2>
          <p className="type-body-sm text-white/55 mt-2">
            {tier.id === "free"
              ? `Try it with ${tier.limits.credits} free credits. No card needed.`
              : tier.id === "premium"
                ? "For chatting most days and regular readings."
                : "For frequent guide sessions and reports."}
          </p>
        </div>
        <div className="text-right">
          {/* Plans bill through one INR Razorpay plan per tier, so the
              price shown is always the rupee price, whatever the toggle. */}
          {tier.prices.INR === 0 ? (
            <p className="type-price">Free</p>
          ) : (
            <>
              <p className="type-price">
                {formatMoney(tier.prices.INR, "INR")}
              </p>
              <p className="type-meta text-white/50">per month</p>
            </>
          )}
        </div>
      </div>

      <div className="my-4 grid grid-cols-2 gap-3">
        <div className="border-t border-white/10 pt-3">
          <p className="type-meta text-white/50">
            {tier.id === "free" ? "Credits, once" : "Credits / month"}
          </p>
          <p className="type-card-title text-white">{tier.limits.credits}</p>
        </div>
        <div className="border-t border-white/10 pt-3">
          <p className="type-meta text-white/50">Jyotish chat</p>
          <p className="type-card-title text-white">
            {tier.limits.synthesisUnlimited ? "Unlimited" : "1 credit / msg"}
          </p>
        </div>
      </div>

      <ul className="space-y-2.5 flex-1">
        {tier.features.map((feature) => (
          <li key={feature} className="flex gap-2 type-body-sm text-white/65">
            <Check
              size={15}
              className="mt-0.5 shrink-0 text-emerald-300"
              aria-hidden="true"
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onSelect}
        disabled={isDisabled}
        className={`mt-4 w-full ${
          tier.recommended
            ? "platform-button-primary"
            : "platform-button-secondary"
        } disabled:opacity-50`}
      >
        {isLoading
          ? "Starting..."
          : tier.prices.INR === 0
            ? "Get started"
            : "Subscribe"}
        {!isLoading && <ArrowRight size={15} aria-hidden="true" />}
      </button>
    </article>
  );
}
