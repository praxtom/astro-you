import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, FileText } from "lucide-react";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import SEO from "../components/SEO";
import { getPersonaById } from "../lib/personas";
import { useAuth } from "../lib/useAuth";
import {
  TRUST_NOT_CLAIMED_YET,
  TRUST_PAGE_HERO,
  TRUST_PRINCIPLES,
  TRUST_PROCESS_ROWS,
  TRUST_SIGNALS,
} from "../lib/trust-policy";
import { trackAcquisitionEvent } from "../lib/acquisition";

interface TrustSummary {
  totals: {
    approvedTestimonials: number;
    approvedReviews: number;
    pendingPublicSubmissions: number;
    publicProofItems: number;
  };
  predictionFeedback: {
    accurate: number;
    partly: number;
    missed: number;
    total: number;
    helpfulRate: number | null;
  };
  testimonials: Array<{
    publicName: string;
    story: string;
    createdAt?: string | null;
  }>;
  reviews: Array<{
    personaId: string;
    rating: number;
    reviewText: string;
    createdAt?: string | null;
  }>;
  transparency: {
    aiAstrologersLabelled: boolean;
    fakeReviewsAllowed: boolean;
    fakeTestimonialsAllowed: boolean;
    predictionFeedbackAggregateOnly: boolean;
    humanExpertClaimsRequireVerification: boolean;
  };
}

export default function Trust() {
  const { user } = useAuth();
  const HeroIcon = TRUST_PAGE_HERO.icon;
  const [story, setStory] = useState("");
  const [publicName, setPublicName] = useState("");
  const [allowPublicUse, setAllowPublicUse] = useState(true);
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<TrustSummary | null>(null);
  const [summaryStatus, setSummaryStatus] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/trust/summary")
      .then((response) => response.json())
      .then((data) => {
        if (!alive) return;
        if (data?.error) {
          setSummaryStatus("Live trust summary is syncing.");
          return;
        }
        setSummary(data);
      })
      .catch(() => {
        if (alive) setSummaryStatus("Live trust summary is syncing.");
      });
    return () => {
      alive = false;
    };
  }, []);

  const submitTestimonial = async () => {
    if (!user) {
      setStatus("Please sign in before submitting a testimonial.");
      return;
    }
    setSubmitting(true);
    setStatus("");
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/trust/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          kind: "testimonial",
          story,
          publicName,
          allowPublicUse,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not submit story.");
      setStory("");
      setPublicName("");
      trackAcquisitionEvent("trust_testimonial_submitted", {
        allowPublicUse,
      });
      setStatus("Story submitted for review. It will not be public automatically.");
    } catch (err: any) {
      setStatus(err.message || "Could not submit story.");
    } finally {
      setSubmitting(false);
    }
  };

  const transparency = summary?.transparency ?? {
    aiAstrologersLabelled: true,
    fakeReviewsAllowed: false,
    fakeTestimonialsAllowed: false,
    predictionFeedbackAggregateOnly: true,
    humanExpertClaimsRequireVerification: true,
  };
  const transparencyChecks = [
    {
      label: "AI astrologers labelled",
      passed: transparency.aiAstrologersLabelled,
    },
    {
      label: "Fake reviews blocked",
      passed: !transparency.fakeReviewsAllowed,
    },
    {
      label: "Fake testimonials blocked",
      passed: !transparency.fakeTestimonialsAllowed,
    },
    {
      label: "Prediction feedback is aggregate-only",
      passed: transparency.predictionFeedbackAggregateOnly,
    },
    {
      label: "Human expert claims require verification",
      passed: transparency.humanExpertClaimsRequireVerification,
    },
  ];

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "AboutPage",
      name: "AstroYou Trust and Transparency",
      url: "https://astroyou.app/trust",
      description:
        "How AstroYou handles AI astrologers, real reviews, testimonials, prediction feedback, and transparency.",
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Does AstroYou invent reviews or testimonials?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. Public reviews and testimonials must come from user submissions and pass moderation before display.",
          },
        },
        {
          "@type": "Question",
          name: "Are AstroYou astrologers AI?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Current AI astrologers are labelled as AI. Human expert claims require verification before they are shown.",
          },
        },
        {
          "@type": "Question",
          name: "How is prediction accuracy shown?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Prediction feedback is collected as aggregate signals and is not displayed as individual private feedback.",
          },
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#030308] text-white">
      <SEO
        title="Trust and Transparency"
        description="How AstroYou handles AI astrologers, real reviews, testimonials, prediction feedback, and transparency."
        url="https://astroyou.app/trust"
        canonical="https://astroyou.app/trust"
        structuredData={structuredData}
      />
      <Header />
      <main className="platform-main">
        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div>
            <div className="platform-chip mb-3 border-gold/25 bg-gold/10 text-gold">
              <HeroIcon size={14} />
              {TRUST_PAGE_HERO.eyebrow}
            </div>
            <h1 className="type-page-title max-w-2xl">
              {TRUST_PAGE_HERO.title}
            </h1>
            <p className="platform-copy mt-3 max-w-2xl">
              {TRUST_PAGE_HERO.body}
            </p>
          </div>

          <div className="platform-panel p-4">
            <p className="platform-eyebrow text-white/35">
              Operating rules
            </p>
            <div className="mt-3 grid gap-2">
              {TRUST_PRINCIPLES.map((item) => (
                <div key={item} className="flex items-start gap-2.5 type-body-sm text-white/65">
                  <CheckCircle2 className="mt-0.5 text-gold" size={15} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {TRUST_SIGNALS.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="platform-panel p-4"
              >
                <Icon className="text-gold" size={19} />
                <h2 className="mt-3 type-card-title text-white">{item.title}</h2>
                <p className="mt-2 type-body-sm text-white/45">
                  {item.body}
                </p>
              </article>
            );
          })}
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="platform-panel p-4">
            <p className="platform-eyebrow">
              How proof becomes public
            </p>
            <div className="mt-3 overflow-hidden rounded-lg border border-white/10">
              {TRUST_PROCESS_ROWS.map((row) => (
                <div
                  key={row.signal}
                  className="grid gap-2 border-b border-white/10 bg-black/20 p-3 last:border-b-0 md:grid-cols-[8rem_1fr_1.2fr]"
                >
                  <p className="type-body-sm font-semibold text-white">{row.signal}</p>
                  <p className="type-body-sm text-white/45">{row.source}</p>
                  <p className="type-body-sm text-white/55">{row.publicRule}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="platform-panel p-4">
            <p className="platform-eyebrow">
              Not claimed yet
            </p>
            <div className="mt-3 grid gap-2">
              {TRUST_NOT_CLAIMED_YET.map((item) => (
                <p
                  key={item}
                  className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 type-body-sm text-white/55"
                >
                  {item}
                </p>
              ))}
            </div>
          </article>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="platform-panel p-4">
            <p className="platform-eyebrow">
              Transparency report
            </p>
            <h2 className="mt-1 type-section-title">Current public status</h2>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <TrustMetric
                label="Approved stories"
                value={summary ? String(summary.totals.approvedTestimonials) : "-"}
              />
              <TrustMetric
                label="Approved reviews"
                value={summary ? String(summary.totals.approvedReviews) : "-"}
              />
              <TrustMetric
                label="Pending review"
                value={summary ? String(summary.totals.pendingPublicSubmissions) : "-"}
              />
              <TrustMetric
                label="Helpful feedback"
                value={
                  summary?.predictionFeedback.helpfulRate !== null &&
                  summary?.predictionFeedback.helpfulRate !== undefined
                    ? `${summary.predictionFeedback.helpfulRate}%`
                    : "Collecting"
                }
              />
            </div>
            <div className="mt-4 grid gap-2 type-body-sm text-white/55">
              <p>Public testimonial display: approved submissions only.</p>
              <p>Review source: completed consultation rating prompt.</p>
              <p>
                Prediction feedback: {summary?.predictionFeedback.total ?? 0} aggregate signals
                captured.
              </p>
              <p>Human expert claims: not shown until verification exists.</p>
              {summaryStatus && <p className="text-amber-300/80">{summaryStatus}</p>}
            </div>
            <div className="mt-4 grid gap-2">
              {transparencyChecks.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 type-body-sm"
                >
                  <span className="text-white/55">{item.label}</span>
                  <span className={item.passed ? "text-emerald-300" : "text-amber-300"}>
                    {item.passed ? "Active" : "Needs review"}
                  </span>
                </div>
              ))}
            </div>
            <Link
              to="/help"
              className="mt-4 inline-flex items-center gap-2 type-meta uppercase text-gold"
            >
              Read help policy
              <FileText size={14} />
            </Link>
          </div>

          <div className="platform-panel p-4">
            <p className="platform-eyebrow">
              Submit real story
            </p>
            <h2 className="mt-1 type-section-title">Share your experience</h2>
            <p className="mt-2 type-body-sm text-white/45">
              This goes into a review queue. It is not published automatically.
            </p>
            <div className="mt-4 grid gap-3">
              <input
                value={publicName}
                onChange={(event) => setPublicName(event.target.value)}
                placeholder="Public name, e.g. Asha K."
                className="platform-field px-3 py-2.5 text-sm placeholder:text-white/25"
              />
              <textarea
                value={story}
                onChange={(event) => setStory(event.target.value)}
                placeholder="What changed for you?"
                className="platform-field min-h-24 resize-none px-3 py-2.5 text-sm placeholder:text-white/25"
              />
              <label className="flex items-start gap-3 text-xs text-white/45">
                <input
                  type="checkbox"
                  checked={allowPublicUse}
                  onChange={(event) => setAllowPublicUse(event.target.checked)}
                  className="mt-0.5"
                />
                <span>Allow public use after moderation.</span>
              </label>
              <button
                onClick={submitTestimonial}
                disabled={submitting || !story.trim()}
                className="platform-button-primary disabled:opacity-50"
              >
                {submitting ? "Submitting" : "Submit story"}
              </button>
              {status && <p className="type-body-sm text-white/45">{status}</p>}
            </div>
          </div>
        </section>

        <section className="mt-4 platform-panel p-4">
          <p className="platform-eyebrow">
            Public proof
          </p>
          <h2 className="mt-1 type-section-title">Approved user signals</h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <h3 className="type-meta uppercase text-white/45">
                Testimonials
              </h3>
              <div className="mt-3 grid gap-3">
                {summary?.testimonials.length ? (
                  summary.testimonials.slice(0, 3).map((item) => (
                    <blockquote key={`${item.publicName}-${item.story}`} className="type-body-sm text-white/60">
                      “{item.story}”
                      <span className="mt-2 block text-xs text-gold">
                        {item.publicName}
                        {formatTrustDate(item.createdAt) ? ` · ${formatTrustDate(item.createdAt)}` : ""}
                      </span>
                    </blockquote>
                  ))
                ) : (
                  <p className="type-body-sm text-white/35">
                    No approved public testimonials yet. Submitted stories stay private until review.
                  </p>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <h3 className="type-meta uppercase text-white/45">
                Reviews
              </h3>
              <div className="mt-3 grid gap-3">
                {summary?.reviews.length ? (
                  summary.reviews.slice(0, 3).map((item) => {
                    const guideName = getPersonaById(item.personaId)?.name ?? "AstroYou guide";
                    return (
                      <blockquote key={`${item.personaId}-${item.reviewText}`} className="type-body-sm text-white/60">
                        <span className="mb-1 block text-gold">
                          {"★".repeat(item.rating)}
                        </span>
                        “{item.reviewText}”
                        <span className="mt-2 block text-xs text-gold">
                          {guideName}
                          {formatTrustDate(item.createdAt) ? ` · ${formatTrustDate(item.createdAt)}` : ""}
                        </span>
                      </blockquote>
                    );
                  })
                ) : (
                  <p className="type-body-sm text-white/35">
                    No approved public reviews yet. Private ratings are not displayed as social proof.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function formatTrustDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function TrustMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <p className="type-meta uppercase text-white/35">{label}</p>
      <p className="mt-1 type-kpi text-white">{value}</p>
    </div>
  );
}
