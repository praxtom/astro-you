import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronDown, HelpCircle, LifeBuoy, Mail } from "lucide-react";
import { SUPPORT_EMAIL } from "../lib/legal-policies";
import { useAuth } from "../lib/useAuth";

const FAQS = [
  {
    q: "How accurate are the readings?",
    a: "AstroYou uses Vedic chart calculations, dasha timing, panchang, and transits, then interprets them for your question. It is guidance, not certainty, and should not replace professional medical, legal, financial, or mental health advice.",
  },
  {
    q: "How is my data stored?",
    a: "Your account data is stored in Firebase with encryption in transit and at rest. Access is account-bound through Firebase Auth and Firestore rules.",
  },
  {
    q: "How do credits work?",
    a: "Credits are prepaid. Sittings in The Circle are billed per minute, PDF reports have fixed credit costs, and purchases or charges appear in Wallet activity.",
  },
  {
    q: "Where can I see my purchases and charges?",
    a: "Open Wallet from the header or Settings. It shows your balance, credit packs, server-written ledger entries, recent consultations, and report charges.",
  },
  {
    q: "Can I request a refund?",
    a: "Failed payments, duplicate charges, unused-credit cases, report failures, and consultation billing mismatches can be reviewed by support. Consumed credits are normally not refundable because the service has already been delivered.",
  },
  {
    q: "Can I change my birth data?",
    a: "Yes. Open Settings and choose Edit birth details. Your chart is recalculated from the new details.",
  },
  {
    q: "What's the difference between Jyotish and The Circle?",
    a: "Jyotish is your personal guide that remembers your chart, your conversations, and what you share over time. The Circle lets you sit with specialised guides (career, love, health, and more) at per-minute rates. Both are software guides, not human astrologers.",
  },
  {
    q: "Can real astrologers apply to join?",
    a: "Yes. Use the Expert Network application page. Applications are stored for review and should not become public profiles until identity, credentials, sample guidance, pricing, and quality checks are complete.",
  },
  {
    q: "How do I export my data?",
    a: "Open Settings and choose Export all my data to download your profile, chats, consultations, reports, credit ledger, and digest data as JSON.",
  },
  {
    q: "What is Kundali Matching?",
    a: "Kundali Matching (Guna Milan) compares two birth charts across 8 categories totaling 36 points. A score of 18+ is traditionally considered favorable for marriage compatibility.",
  },
  {
    q: "Do I need to know my exact birth time?",
    a: "Exact birth time gives the most accurate results, especially for the Ascendant and houses. Without it, AstroYou calculates your chart for 12:00 noon and marks Lagna- and house-based readings as less certain, while still showing the insights that do not depend on the time, such as your Moon sign and nakshatra, with dasha dates as approximate.",
  },
];

export default function Help() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Help & FAQ — AstroYou";
    return () => {
      document.title = prevTitle;
    };
  }, []);

  return (
    <div>

      <div className="relative z-10 px-4 pt-28 pb-16 max-w-2xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/60 text-sm mb-6">
            <HelpCircle className="w-3.5 h-3.5 text-gold" />
            Help Center
          </div>
          <h1 className="type-page-title mb-3">
            Frequently Asked Questions
          </h1>
          <p className="text-white/50 text-lg">
            Everything you need to know about AstroYou.
          </p>
        </motion.div>

        {/* FAQ Accordion */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="space-y-3"
        >
          {FAQS.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={i}
                className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden transition-colors hover:border-white/15"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                >
                  <span className="text-sm sm:text-base text-white/80 font-medium pr-4">
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-white/50 flex-shrink-0 transition-transform duration-300 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    isOpen ? "max-h-60 opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <p className="px-5 pb-4 text-sm text-white/50 leading-relaxed">{faq.a}</p>
                </div>
              </div>
            );
          })}
        </motion.div>

        {/* Contact Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-12 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8 text-center"
        >
          <h2 className="text-xl font-display text-white/80 mb-2">Still have questions?</h2>
          <p className="text-white/60 text-sm mb-6">
            {user
              ? "Open a ticket for payments, refunds, reports, consultation billing, or account issues."
              : "Can't sign in, or don't have an account? Email us — no login needed."}
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/support"
              className="inline-flex min-h-11 items-center gap-2 px-5 py-2.5 rounded-xl bg-gold text-black font-bold hover:bg-gold/90 transition-all text-sm"
            >
              <LifeBuoy className="w-4 h-4" />
              Open support ticket
            </Link>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-5 text-sm font-semibold text-white/80 hover:text-white"
            >
              <Mail className="w-4 h-4" />
              {SUPPORT_EMAIL}
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
