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
  AlertCircle,
  ArrowLeft,
  FileText,
  HelpCircle,
  Loader2,
  MessageSquare,
  Receipt,
  Wallet as WalletIcon,
} from "lucide-react";
import Header from "../components/layout/Header";
import AuthModal from "../components/AuthModal";
import { useAuth } from "../lib/useAuth";
import { db } from "../lib/firebase";
import { useSubscription } from "../hooks";
import { useCreditTopup } from "../hooks/useCreditTopup";
import { CREDIT_PACKS, formatCreditRate } from "../lib/credit-packs";

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

function labelForLedgerType(type?: string) {
  switch (type) {
    case "purchase":
      return "Credit purchase";
    case "consultation":
      return "Consultation";
    case "report":
      return "PDF report";
    case "subscription_grant":
      return "Plan credits";
    case "referral_bonus":
      return "Referral bonus";
    case "signup_bonus":
      return "Signup credits";
    case "refund":
      return "Refund";
    case "admin_adjustment":
      return "Adjustment";
    case "synthesis":
      return "Jyotish chat";
    default:
      return "Credit activity";
  }
}

export default function Wallet() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { credits, tier } = useSubscription();
  const { buyCredits, isPaying, error: paymentError } = useCreditTopup();
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [consultations, setConsultations] = useState<ConsultationRecord[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [selectedPack, setSelectedPack] = useState<number | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const loadActivity = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setActivityError(null);
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

      if (
        ledgerResult.status === "rejected" &&
        consultationResult.status === "rejected" &&
        reportResult.status === "rejected"
      ) {
        setActivityError("Wallet activity is unavailable right now.");
      }
    } catch (err) {
      console.error("Wallet activity load failed:", err);
      setActivityError("Could not load wallet activity right now.");
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
    <div className="min-h-screen bg-[#030308] text-white">
      <Header />
      <main className="platform-main">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-2 text-sm text-white/40 hover:text-white"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <section className="grid grid-cols-1 lg:grid-cols-[1fr_20rem] gap-4 items-start mb-4">
          <div>
            <p className="platform-eyebrow mb-2">Wallet</p>
            <h1 className="type-page-title max-w-3xl">
              Credits, charges, and receipts in one place.
            </h1>
            <p className="platform-copy mt-3 max-w-2xl">
              Track purchases, astrologer sittings, report charges, refunds,
              and plan credits without guessing where your balance went.
            </p>
          </div>

          <aside className="platform-panel p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="type-meta uppercase text-white/35">Balance</p>
                <p className="type-kpi text-white mt-1">{credits}</p>
              </div>
              <WalletIcon className="text-gold" size={25} />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="type-body-sm text-white/45">Plan</span>
              <span className="type-body-sm text-gold capitalize">{tier}</span>
            </div>
          </aside>
        </section>

        {paymentError && (
          <div className="platform-panel mb-3 border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-100 flex gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{paymentError}</span>
          </div>
        )}

        <section className="grid grid-cols-1 xl:grid-cols-[1fr_22rem] gap-4">
          <div className="space-y-4">
            <section>
              <div className="mb-3">
                <h2 className="type-section-title">Add credits</h2>
                <p className="type-body-sm text-white/40">
                  Packs are prepaid. Credit cost is shown before use.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {CREDIT_PACKS.map((pack) => (
                  <article key={pack.minutes} className="platform-panel p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="type-card-title text-white">{pack.label}</p>
                        <p className="type-body-sm text-white/45 mt-1">
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
                          ₹{pack.amountInRupees}
                        </p>
                        <p className="type-meta text-white/35">
                          {formatCreditRate(pack)}
                        </p>
                      </div>
                      <button
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
                <p className="type-body-sm text-white/40">
                  Server-written ledger entries.
                </p>
              </div>
              <div className="platform-panel overflow-hidden">
                {!user ? (
                  <div className="p-4 text-center">
                    <Receipt className="mx-auto text-white/20 mb-3" size={32} />
                    <p className="type-body text-white/70">Private wallet activity</p>
                    <p className="type-body-sm text-white/35 mt-1">
                      Sign in to buy credits and see purchases, charges, and receipts.
                    </p>
                    <button
                      onClick={() => setShowAuthModal(true)}
                      className="platform-button-secondary mt-4"
                    >
                      Sign in
                    </button>
                  </div>
                ) : loading ? (
                  <div className="p-4 text-center text-white/45">
                    <Loader2 className="mx-auto animate-spin mb-3" size={22} />
                    Loading activity
                  </div>
                ) : activityError ? (
                  <div className="p-4 text-center">
                    <AlertCircle className="mx-auto text-amber-300/60 mb-3" size={30} />
                    <p className="type-body text-white/70">Activity unavailable.</p>
                    <p className="type-body-sm text-white/35 mt-1">
                      {activityError}
                    </p>
                  </div>
                ) : ledger.length === 0 ? (
                  <div className="p-4 text-center">
                    <Receipt className="mx-auto text-white/20 mb-3" size={32} />
                    <p className="type-body text-white/70">No credit activity yet.</p>
                    <p className="type-body-sm text-white/35 mt-1">
                      Purchases and charges will appear here.
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
              <p className="platform-eyebrow mb-3">Where credits go</p>
              <div className="space-y-3 type-body-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/50">Astrologer sittings</span>
                  <span className="text-gold">5-10/min</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/50">PDF reports</span>
                  <span className="text-gold">10-199/report</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/50">Plan credits</span>
                  <span className="text-white/45">Monthly grant</span>
                </div>
              </div>
            </section>

            <section className="platform-panel p-4">
              <p className="platform-eyebrow mb-3">Recent sessions</p>
              <MiniList
                emptyLabel={user ? "No consultations yet." : "Sign in to see sessions."}
                rows={consultations.map((item) => ({
                  id: item.id,
                  icon: MessageSquare,
                  title: item.personaId || "Consultation",
                  meta: `${item.status || "unknown"} · ${item.cost ?? 0} credits`,
                  date: formatDate(item.createdAt),
                }))}
              />
            </section>

            <section className="platform-panel p-4">
              <p className="platform-eyebrow mb-3">Recent reports</p>
              <MiniList
                emptyLabel={user ? "No reports yet." : "Sign in to see reports."}
                rows={reports.map((item) => ({
                  id: item.id,
                  icon: FileText,
                  title: item.title || item.reportType || "Report",
                  meta: `${item.status || "unknown"} · ${
                    item.chargedCredits ?? item.creditCost ?? 0
                  } credits`,
                  date: formatDate(item.createdAt),
                }))}
              />
            </section>

            <section className="platform-panel p-4">
              <div className="flex items-center gap-2 text-gold">
                <HelpCircle size={15} />
                <p className="platform-eyebrow">Support</p>
              </div>
              <p className="type-body-sm text-white/45 mt-3">
                For failed payments, duplicate charges, or refund review,
                open a ticket with the payment or report reference if you have it.
              </p>
              <button
                onClick={() => navigate("/support")}
                className="platform-button-secondary mt-4 w-full"
              >
                Open support ticket
              </button>
            </section>
          </aside>
        </section>
      </main>
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

function LedgerRow({ entry }: { entry: LedgerEntry }) {
  const amount = entry.amount ?? 0;
  const positive = amount > 0;
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="min-w-0">
        <p className="type-body-sm text-white/80">
          {labelForLedgerType(entry.type)}
        </p>
        <p className="type-meta text-white/35 mt-1">
          {entry.source || "system"} {formatDate(entry.createdAt)}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className={`type-card-title ${positive ? "text-emerald-300" : "text-white"}`}>
          {positive ? "+" : ""}
          {amount} credits
        </p>
        {typeof entry.balanceAfter === "number" && (
          <p className="type-meta text-white/30 mt-1">
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
}: {
  rows: Array<{
    id: string;
    icon: typeof FileText;
    title: string;
    meta: string;
    date: string;
  }>;
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return <p className="type-body-sm text-white/35">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const Icon = row.icon;
        return (
          <div key={row.id} className="flex items-start gap-3">
            <div className="mt-0.5 h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gold">
              <Icon size={14} />
            </div>
            <div className="min-w-0">
              <p className="type-body-sm text-white/70 truncate">{row.title}</p>
              <p className="type-meta text-white/35">
                {row.meta} {row.date && `· ${row.date}`}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
