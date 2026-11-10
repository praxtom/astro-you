import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import {
  ArrowLeft,
  FileText,
  HelpCircle,
  Loader2,
  MessageSquare,
  Receipt,
  Wallet as WalletIcon,
} from "lucide-react";
import AuthModal from "../components/AuthModal";
import { StatusNotice } from "../components/ui/StatusNotice";
import { useAuth } from "../lib/useAuth";
import { db } from "../lib/firebase";
import { useSubscription, usePendingPayment } from "../hooks";
import { useCreditTopup } from "../hooks/useCreditTopup";
import { CREDIT_PACKS, formatCreditRate } from "../lib/credit-packs";
import { useCurrency } from "../hooks/useCurrency";
import { formatMoney } from "../lib/currency";
import { getPackAmount } from "../lib/credit-packs";
import { PERSONAS } from "../lib/personas";
import { REPORT_PRICING } from "../lib/report-pricing";
import { FEATURE_CREDIT_COST } from "../lib/feature-pricing";
import { getTier } from "../lib/subscriptions";
import {
  activityLabel,
  humanizeValue,
  ledgerTypeLabel,
  statusLabel,
} from "../lib/wallet-labels";
import type { ReportType } from "../lib/report-pricing";

/** Guide per-minute rates and report prices, read from the real price lists. */
const GUIDE_RATES = PERSONAS.map((p) => p.pricePerMin);
const MIN_GUIDE_RATE = Math.min(...GUIDE_RATES);
const MAX_GUIDE_RATE = Math.max(...GUIDE_RATES);
const REPORT_COSTS = Object.values(REPORT_PRICING).map((r) => r.creditCost);
const READING_COSTS = Object.values(FEATURE_CREDIT_COST);

interface LedgerEntry {
  id: string;
  type?: string;
  amount?: number;
  source?: string;
  balanceAfter?: number;
  createdAt?: string | { toDate?: () => Date };
  metadata?: Record<string, unknown>;
}

interface ConsultationRecord {
  id: string;
  personaId?: string;
  status?: string;
  minutes?: number;
  cost?: number;
  pricePerMin?: number;
  createdAt?: string | { toDate?: () => Date };
}

interface ReportRecord {
  id: string;
  title?: string;
  reportType?: string;
  status?: string;
  chargedCredits?: number;
  creditCost?: number;
  createdAt?: string | { toDate?: () => Date };
}

function toDate(value: LedgerEntry["createdAt"]) {
  if (!value) return null;
  if (typeof value === "string") return new Date(value);
  return value.toDate?.() ?? null;
}

function formatDate(value: LedgerEntry["createdAt"]) {
  const date = toDate(value);
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function Wallet() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { credits, tier, loading: subscriptionLoading } = useSubscription();
  const { buyCredits, isPaying, error: paymentError } = useCreditTopup();
  const { currency } = useCurrency();
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [consultations, setConsultations] = useState<ConsultationRecord[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sectionErrors, setSectionErrors] = useState({
    ledger: false,
    consultations: false,
    reports: false,
  });
  const [selectedPack, setSelectedPack] = useState<number | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const pendingCheckoutId = usePendingPayment();

  const loadActivity = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setSectionErrors({ ledger: false, consultations: false, reports: false });
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/wallet/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, limit: 30 }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setLedger(Array.isArray(data.ledger) ? data.ledger : []);
        setConsultations(
          Array.isArray(data.consultations) ? data.consultations : [],
        );
        setReports(Array.isArray(data.reports) ? data.reports : []);
        setLoading(false);
        return;
      }
      console.warn("[Wallet] Server activity unavailable, using Firestore read.");
    } catch (serverError) {
      console.warn("[Wallet] Server activity unavailable, using Firestore read.", serverError);
    }

    try {
      const [ledgerResult, consultationResult, reportResult] = await Promise.allSettled([
        getDocs(
          query(
            collection(db, "users", user.uid, "creditLedger"),
            orderBy("createdAt", "desc"),
            limit(30),
          ),
        ),
        getDocs(
          query(
            collection(db, "users", user.uid, "consultations"),
            orderBy("createdAt", "desc"),
            limit(8),
          ),
        ),
        getDocs(
          query(
            collection(db, "users", user.uid, "reports"),
            orderBy("createdAt", "desc"),
            limit(8),
          ),
        ),
      ]);

      if (ledgerResult.status === "fulfilled") {
        setLedger(
          ledgerResult.value.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        );
      } else {
        console.warn("Credit ledger load failed:", ledgerResult.reason);
        setLedger([]);
      }

      if (consultationResult.status === "fulfilled") {
        setConsultations(
          consultationResult.value.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })),
        );
      } else {
        console.warn("Consultation activity load failed:", consultationResult.reason);
        setConsultations([]);
      }

      if (reportResult.status === "fulfilled") {
        setReports(
          reportResult.value.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        );
      } else {
        console.warn("Report activity load failed:", reportResult.reason);
        setReports([]);
      }

      setSectionErrors({
        ledger: ledgerResult.status === "rejected",
        consultations: consultationResult.status === "rejected",
        reports: reportResult.status === "rejected",
      });
    } catch (err) {
      console.error("Wallet activity load failed:", err);
      setSectionErrors({ ledger: true, consultations: true, reports: true });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLedger([]);
      setConsultations([]);
      setReports([]);
      setLoading(false);
      return;
    }
    loadActivity();
  }, [authLoading, loadActivity, user]);

  const buyPack = async (credits: number) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    setSelectedPack(credits);
    const success = await buyCredits(credits);
    if (success) await loadActivity();
    setSelectedPack(null);
  };

  return (
    <div>
      <div className="platform-main">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-white/60 hover:text-white"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Back
        </button>

        {pendingCheckoutId && (
          <StatusNotice
            tone="info"
            size="section"
            className="mb-4"
            message="You have a recent payment to confirm."
            action={{
              label: "Check payment status",
              to: `/payment/return?checkout=${encodeURIComponent(pendingCheckoutId)}`,
            }}
          />
        )}
        {/* Same column widths as the section below so the balance card lines
            up with the sidebar. */}
        <section className="grid grid-cols-1 xl:grid-cols-[1fr_22rem] gap-4 items-start mb-4">
          <div>
            <p className="platform-eyebrow mb-2">Wallet</p>
            <h1 className="type-page-title max-w-3xl">Your credits</h1>
            <p className="platform-copy mt-3 max-w-2xl">
              Credits pay for chat messages, guide sessions, longer forecasts
              and PDF reports. You always see the cost before anything is
              charged.
            </p>
          </div>

          <aside className="platform-panel p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="type-meta uppercase text-white/55">Balance</p>
                <p className="type-kpi text-white mt-1">
                  {user && subscriptionLoading ? (
                    <span className="text-white/55" aria-label="Loading balance">…</span>
                  ) : (
                    <>
                      {credits}{" "}
                      <span className="type-body-sm text-white/60">credits</span>
                    </>
                  )}
                </p>
              </div>
              <WalletIcon className="text-gold" size={25} aria-hidden="true" />
            </div>
            {user && !subscriptionLoading && (
              <p className="type-body-sm text-white/60 mt-2">
                {credits <= 0
                  ? "Add a pack below to keep chatting and booking guide sessions."
                  : tier === "free"
                    ? `Enough for ${credits} chat message${credits === 1 ? "" : "s"}, or about ${Math.floor(credits / MIN_GUIDE_RATE)} minute${Math.floor(credits / MIN_GUIDE_RATE) === 1 ? "" : "s"} with a guide.`
                    : `About ${Math.floor(credits / MIN_GUIDE_RATE)} minutes with a guide. Chat is included in your plan.`}
              </p>
            )}
            <div className="mt-2 flex items-center justify-between">
              <span className="type-body-sm text-white/60">Plan</span>
              <button
                type="button"
                onClick={() => navigate("/pricing")}
                className="type-body-sm text-gold hover:underline"
              >
                {getTier(tier).name} · See plans
              </button>
            </div>
          </aside>
        </section>

        {paymentError && (
          <StatusNotice size="section" className="mb-3" message={paymentError} />
        )}

        <section className="grid grid-cols-1 xl:grid-cols-[1fr_22rem] gap-4">
          <div className="space-y-4">
            <section>
              <div className="mb-3">
                <h2 className="type-section-title">Add credits</h2>
                <p className="type-body-sm text-white/55">
                  Packs are prepaid. Credit cost is shown before use.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {CREDIT_PACKS.map((pack) => (
                  <article key={pack.minutes} className="platform-panel p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="type-card-title text-white">{pack.label}</p>
                        <p className="type-body-sm text-white/60 mt-1">
                          {pack.description}
                        </p>
                      </div>
                      {pack.badge && (
                        <span className="platform-chip text-gold border-gold/20">
                          {pack.badge}
                        </span>
                      )}
                    </div>
                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div>
                        <p className="type-card-title text-gold">
                          {formatMoney(getPackAmount(pack, currency), currency)}
                        </p>
                        <p className="type-meta text-white/55">
                          {formatCreditRate(pack, currency)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => buyPack(pack.minutes)}
                        disabled={isPaying}
                        className="platform-button-primary min-w-32 disabled:opacity-60"
                      >
                        {selectedPack === pack.minutes && (
                          <Loader2 size={14} className="animate-spin" />
                        )}
                        {user ? "Buy" : "Sign in"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-3">
                <h2 className="type-section-title">Credit activity</h2>
                <p className="type-body-sm text-white/55">
                  Every purchase, charge and refund, newest first.
                </p>
              </div>
              <div className="platform-panel overflow-hidden">
                {!user ? (
                  <div className="p-4 text-center">
                    <Receipt className="mx-auto text-white/20 mb-3" size={32} aria-hidden="true" />
                    <p className="type-body text-white/70">Private wallet activity</p>
                    <p className="type-body-sm text-white/55 mt-1">
                      Sign in to buy credits and see purchases, charges, and receipts.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowAuthModal(true)}
                      className="platform-button-secondary mt-4"
                    >
                      Sign in
                    </button>
                  </div>
                ) : loading ? (
                  <div role="status" className="p-4 text-center text-white/60">
                    <Loader2 className="mx-auto animate-spin mb-3" size={22} aria-hidden="true" />
                    Loading activity…
                  </div>
                ) : sectionErrors.ledger ? (
                  <div className="p-4">
                    <StatusNotice
                      size="section"
                      title="Your credit history couldn't be loaded."
                      message="Your balance above is still current. Check your connection and try again."
                      onRetry={() => void loadActivity()}
                    />
                  </div>
                ) : ledger.length === 0 ? (
                  <div className="p-4 text-center">
                    <Receipt className="mx-auto text-white/20 mb-3" size={32} aria-hidden="true" />
                    <p className="type-body text-white/70">No credit activity yet.</p>
                    <p className="type-body-sm text-white/55 mt-1">
                      Each time you add or spend credits it shows up here,
                      with your balance after it.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/10">
                    {ledger.map((entry) => (
                      <LedgerRow key={entry.id} entry={entry} />
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="platform-panel p-4">
              <p className="platform-eyebrow mb-3">What things cost</p>
              <div className="space-y-3 type-body-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/60">Jyotish chat</span>
                  <span className="text-right text-gold">
                    1 per message
                    <span className="block type-meta text-white/55">
                      Unlimited on Premium and Pro
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/60">Guide sessions</span>
                  <span className="text-gold">
                    {MIN_GUIDE_RATE}–{MAX_GUIDE_RATE} a minute
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/60">
                    Longer forecasts, transit and compatibility readings
                  </span>
                  <span className="shrink-0 text-gold">
                    {Math.min(...READING_COSTS)}–{Math.max(...READING_COSTS)} each
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/60">PDF reports</span>
                  <span className="text-gold">
                    {Math.min(...REPORT_COSTS)}–{Math.max(...REPORT_COSTS)} each
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/60">
                    Kundali, daily forecast, Panchang
                  </span>
                  <span className="text-emerald-300">Free</span>
                </div>
              </div>
            </section>

            <section className="platform-panel p-4">
              <p className="platform-eyebrow mb-3">Recent sessions</p>
              <MiniList
                loading={Boolean(user) && loading}
                error={
                  sectionErrors.consultations
                    ? "Sessions couldn't be loaded."
                    : null
                }
                onRetry={() => void loadActivity()}
                emptyLabel={
                  user
                    ? "No guide sessions yet. Choose a guide to start one."
                    : "Sign in to see sessions."
                }
                rows={consultations.map((item) => ({
                  id: item.id,
                  icon: MessageSquare,
                  title:
                    PERSONAS.find((p) => p.id === item.personaId)?.name ??
                    "Guide session",
                  meta: [statusLabel(item.status), `${item.cost ?? 0} credits`]
                    .filter(Boolean)
                    .join(" · "),
                  date: formatDate(item.createdAt),
                }))}
              />
            </section>

            <section className="platform-panel p-4">
              <p className="platform-eyebrow mb-3">Recent reports</p>
              <MiniList
                loading={Boolean(user) && loading}
                error={sectionErrors.reports ? "Reports couldn't be loaded." : null}
                onRetry={() => void loadActivity()}
                emptyLabel={
                  user
                    ? "No PDF reports yet. Reports you buy are listed here."
                    : "Sign in to see reports."
                }
                rows={reports.map((item) => ({
                  id: item.id,
                  icon: FileText,
                  title: reportTitle(item),
                  meta: [
                    statusLabel(item.status),
                    `${item.chargedCredits ?? item.creditCost ?? 0} credits`,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                  date: formatDate(item.createdAt),
                }))}
              />
            </section>

            <section className="platform-panel p-4">
              <div className="flex items-center gap-2 text-gold">
                <HelpCircle size={15} aria-hidden="true" />
                <p className="platform-eyebrow">Support</p>
              </div>
              <p className="type-body-sm text-white/60 mt-3">
                For failed payments, duplicate charges, or refund review,
                open a ticket with the payment or report reference if you have it.
              </p>
              <button
                type="button"
                onClick={() => navigate("/support")}
                className="platform-button-secondary mt-4 w-full"
              >
                Open support ticket
              </button>
            </section>
          </aside>
        </section>
      </div>
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          void loadActivity();
        }}
        title="Sign in for wallet"
        message="Use your AstroYou account so credits, receipts, and paid activity stay tied to you."
      />
    </div>
  );
}

function reportTitle(item: ReportRecord) {
  if (item.title) return item.title;
  const known = item.reportType
    ? REPORT_PRICING[item.reportType as ReportType]?.title
    : undefined;
  return known || (item.reportType ? humanizeValue(item.reportType) : "Report");
}

function LedgerRow({ entry }: { entry: LedgerEntry }) {
  const amount = entry.amount ?? 0;
  const positive = amount > 0;
  const title = ledgerTypeLabel(entry.type);
  const source = activityLabel(entry.source);
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="min-w-0">
        <p className="type-body-sm text-white/80">
          {title}
        </p>
        <p className="type-meta text-white/55 mt-1">
          {[source !== title ? source : "", formatDate(entry.createdAt)]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className={`type-card-title ${positive ? "text-emerald-300" : "text-white"}`}>
          {positive ? "+" : ""}
          {amount} credits
        </p>
        {typeof entry.balanceAfter === "number" && (
          <p className="type-meta text-white/55 mt-1">
            Balance {entry.balanceAfter}
          </p>
        )}
      </div>
    </div>
  );
}

function MiniList({
  rows,
  emptyLabel,
  loading = false,
  error = null,
  onRetry,
}: {
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  rows: Array<{
    id: string;
    icon: typeof FileText;
    title: string;
    meta: string;
    date: string;
  }>;
  emptyLabel: string;
}) {
  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading">
        {[0, 1].map((i) => (
          <div key={i} className="h-8 rounded-lg bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <StatusNotice size="section" message={error} onRetry={onRetry} />
    );
  }

  if (rows.length === 0) {
    return <p className="type-body-sm text-white/55">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const Icon = row.icon;
        return (
          <div key={row.id} className="flex items-start gap-3">
            <div className="mt-0.5 h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gold">
              <Icon size={14} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="type-body-sm text-white/70 truncate">{row.title}</p>
              <p className="type-meta text-white/55">
                {row.meta} {row.date && `· ${row.date}`}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
