import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  HelpCircle,
  Loader2,
  MessageSquare,
  ReceiptText,
  Send,
} from "lucide-react";
import Header from "../components/layout/Header";
import AuthModal from "../components/AuthModal";
import { useAuth } from "../lib/useAuth";
import { trackAcquisitionEvent } from "../lib/acquisition";

const SUPPORT_CATEGORIES = [
  { value: "refund", label: "Refund review" },
  { value: "payment", label: "Payment issue" },
  { value: "report", label: "Report issue" },
  { value: "consultation", label: "Consultation billing" },
  { value: "account", label: "Account or data" },
  { value: "technical", label: "Technical issue" },
  { value: "other", label: "Other" },
];

interface SupportTicket {
  id: string;
  ticketId?: string;
  category?: string;
  priority?: string;
  subject?: string;
  message?: string;
  referenceId?: string;
  status?: string;
  createdAt?: string;
}

function formatTicketDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function Support() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [category, setCategory] = useState("refund");
  const [priority, setPriority] = useState("normal");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const selectedCategoryLabel = useMemo(
    () =>
      SUPPORT_CATEGORIES.find((item) => item.value === category)?.label ||
      "Support",
    [category],
  );

  const loadTickets = useCallback(async () => {
    if (!user) return;
    setLoadingTickets(true);
    setHistoryError(null);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, limit: 20 }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Could not load tickets");
      }
      setTickets(Array.isArray(data.tickets) ? data.tickets : []);
    } catch (error) {
      console.warn("[Support] Ticket history unavailable:", error);
      setHistoryError("Ticket history is unavailable right now.");
    } finally {
      setLoadingTickets(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setTickets([]);
      setLoadingTickets(false);
      return;
    }
    loadTickets();
  }, [authLoading, loadTickets, user]);

  const submitTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setSuccess(null);

    if (subject.trim().length < 5) {
      setFormError("Add a clear subject.");
      return;
    }

    if (message.trim().length < 20) {
      setFormError("Add a few more details so support can review it.");
      return;
    }

    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setSubmitting(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/support/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          category,
          priority,
          subject,
          message,
          referenceId,
          email: user.email,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Could not create support ticket");
      }

      setSuccess(`Ticket ${data.ticketId} opened.`);
      trackAcquisitionEvent("support_ticket_submitted", {
        category,
        priority,
        hasReference: Boolean(referenceId.trim()),
      });
      setSubject("");
      setMessage("");
      setReferenceId("");
      await loadTickets();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Could not create support ticket",
      );
    } finally {
      setSubmitting(false);
    }
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

        <section className="grid grid-cols-1 lg:grid-cols-[1fr_21rem] gap-4 items-start mb-4">
          <div>
            <p className="platform-eyebrow mb-2">Support Desk</p>
            <h1 className="type-page-title max-w-3xl">
              Open a ticket for payments, refunds, reports, or account issues.
            </h1>
            <p className="platform-copy mt-3 max-w-2xl">
              Tell us what happened, attach a payment or report reference if
              you have one, and we will keep the request tied to your account.
            </p>
          </div>

          <aside className="platform-panel p-3">
            <div className="flex items-center gap-3 text-gold">
              <HelpCircle size={20} />
              <p className="platform-eyebrow">What we review</p>
            </div>
            <div className="mt-2 space-y-1.5 type-body-sm text-white/50">
              <p>Failed or duplicate payments</p>
              <p>Refund review for unused credits</p>
              <p>Report generation and consultation billing issues</p>
            </div>
          </aside>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[1fr_24rem] gap-4 items-start">
          <form onSubmit={submitTicket} className="platform-panel p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="type-section-title">Create ticket</h2>
                <p className="type-body-sm text-white/40 mt-1">
                  Current category: {selectedCategoryLabel}
                </p>
              </div>
              <ReceiptText className="text-gold" size={22} />
            </div>

            {(formError || success) && (
              <div
                className={`mb-4 flex gap-2 rounded-xl border p-3 text-sm ${
                  formError
                    ? "border-amber-400/20 bg-amber-500/10 text-amber-100"
                    : "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                }`}
              >
                {formError ? (
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                ) : (
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                )}
                <span>{formError || success}</span>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <label>
                <span className="type-meta text-white/40">Category</span>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="platform-field mt-1.5"
                >
                  {SUPPORT_CATEGORIES.map((item) => (
                    <option key={item.value} value={item.value} className="bg-[#111118]">
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="type-meta text-white/40">Priority</span>
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                  className="platform-field mt-1.5"
                >
                  <option value="normal" className="bg-[#111118]">Normal</option>
                  <option value="urgent" className="bg-[#111118]">Urgent</option>
                </select>
              </label>
            </div>

            <label className="mt-3 block">
              <span className="type-meta text-white/40">Subject</span>
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Duplicate payment, report failed, wrong charge..."
                className="platform-field mt-1.5"
              />
            </label>

            <label className="mt-3 block">
              <span className="type-meta text-white/40">Reference ID optional</span>
              <input
                value={referenceId}
                onChange={(event) => setReferenceId(event.target.value)}
                placeholder="Payment ID, report ID, consultation ID"
                className="platform-field mt-1.5"
              />
            </label>

            <label className="mt-3 block">
              <span className="type-meta text-white/40">Details</span>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Explain what happened, when it happened, and what outcome you are requesting."
                className="platform-field mt-1.5 min-h-32 resize-y leading-relaxed"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="platform-button-primary mt-4 w-full sm:w-auto disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Send size={15} />
              )}
              {user ? "Open ticket" : "Sign in to open ticket"}
            </button>
            <p className="type-meta mt-3 text-white/35">
              Refund requests are reviewed under the{" "}
              <Link to="/refund-policy" className="text-gold hover:text-gold/80">
                Refund Policy
              </Link>
              .
            </p>
          </form>

          <aside className="platform-panel p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="platform-eyebrow">Ticket history</p>
                <p className="type-body-sm text-white/35 mt-1">
                  {tickets.length} recent
                </p>
              </div>
              <MessageSquare className="text-gold" size={20} />
            </div>

            {!user ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="type-body-sm text-white/60">
                  Sign in to create tickets and see past support requests.
                </p>
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="platform-button-secondary mt-4 w-full"
                >
                  Sign in
                </button>
              </div>
            ) : loadingTickets ? (
              <div className="py-8 text-center text-white/40">
                <Loader2 className="mx-auto animate-spin mb-3" size={22} />
                Loading tickets
              </div>
            ) : historyError ? (
              <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-100">
                {historyError}
              </div>
            ) : tickets.length === 0 ? (
              <div className="py-8 text-center">
                <MessageSquare className="mx-auto mb-3 text-white/20" size={30} />
                <p className="type-body-sm text-white/45">
                  No support tickets yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="type-body-sm text-white/75 line-clamp-2">
                        {ticket.subject || "Support ticket"}
                      </p>
                      <span className="rounded-full border border-white/10 px-2 py-1 type-meta text-white/45">
                        {ticket.status || "open"}
                      </span>
                    </div>
                    <p className="type-meta text-white/35 mt-2">
                      {ticket.category || "support"}{" "}
                      {formatTicketDate(ticket.createdAt) &&
                        `· ${formatTicketDate(ticket.createdAt)}`}
                    </p>
                    {ticket.referenceId && (
                      <p className="type-meta text-white/30 mt-1">
                        Ref {ticket.referenceId}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </aside>
        </section>

        <section className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {[
            {
              title: "Refund reviews",
              body: "Failed payments, duplicate charges, unused-credit requests, report failures, and billing mismatches.",
              link: "/refund-policy",
              label: "Read refund policy",
            },
            {
              title: "Privacy requests",
              body: "Export, deletion, correction, account data, and saved guidance memory questions.",
              link: "/privacy",
              label: "Read privacy policy",
            },
            {
              title: "Guidance limits",
              body: "Astrology guidance is not medical, legal, financial, psychological, or emergency advice.",
              link: "/disclaimer",
              label: "Read disclaimer",
            },
          ].map((item) => (
            <article key={item.title} className="platform-panel p-4">
              <h2 className="type-card-title text-white">{item.title}</h2>
              <p className="type-body-sm mt-2 text-white/45">{item.body}</p>
              <Link
                to={item.link}
                className="mt-4 inline-flex text-sm font-bold text-gold hover:text-gold/80"
              >
                {item.label}
              </Link>
            </article>
          ))}
        </section>
      </main>
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          void loadTickets();
        }}
        title="Sign in for support"
        message="Use your AstroYou account so support can securely review payments, reports, and consultation history."
      />
    </div>
  );
}
