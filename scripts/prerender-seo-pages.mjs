/**
 * Prerender the SEO surface to static HTML.
 *
 * Why this exists: AstroYou is a client-rendered SPA, and the crawlers that
 * feed AI answer engines — GPTBot, PerplexityBot, ClaudeBot, Google-Extended —
 * do not execute JavaScript. Whatever this script writes into `<div id="root">`
 * is the entire page as far as they are concerned.
 *
 * The content model lives in src/lib/seo-content.ts and is shared with the
 * React route that renders the same pages. It used to be duplicated here as a
 * thinner `bullets` list, which meant crawlers saw roughly a third of what
 * users saw. Everything below now reads from the single source of truth.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

const distDir = path.resolve("dist");
const rawBaseUrl = (
  process.env.APP_BASE_URL ||
  process.env.URL ||
  "https://astroyou.app"
).replace(/\/+$/, "");
// Tolerate a value handed over without a scheme (e.g. "astroyou.netlify.app"
// pasted straight from the Netlify UI) rather than emitting a broken
// "astroyou.netlify.app/sitemap.xml"-as-a-relative-path URL.
const baseUrl = /^https?:\/\//i.test(rawBaseUrl)
  ? rawBaseUrl
  : `https://${rawBaseUrl}`;
const today = new Date().toISOString().slice(0, 10);

// ── Load the shared content model ────────────────────────────────────────────
// tsc rather than a runtime type-stripper: TypeScript is already a
// devDependency, so this works on whatever Node version the CI image ships.

const LIB_OUT = path.resolve("node_modules/.tmp/prerender-lib");
const LIB_SOURCES = [
  "src/lib/seo-content.ts",
  "src/lib/site-url.ts",
  "src/lib/panchang.ts",
  "src/lib/credit-packs.ts",
  "src/lib/entitlements.ts",
  "src/lib/seo-routing.ts",
  "src/lib/seo-public.ts",
  "src/lib/legal-policies.ts",
];

async function loadSharedModules() {
  await execFileAsync("npx", [
    "tsc",
    ...LIB_SOURCES,
    "--ignoreConfig",
    "--outDir",
    LIB_OUT,
    "--module",
    "esnext",
    "--target",
    "es2022",
    "--moduleResolution",
    "bundler",
    "--skipLibCheck",
  ]);
  const load = (name) => import(path.join(LIB_OUT, `${name}.js`));
  const [seo, panchang, packs, entitlements, routing, publicSeo, legal] = await Promise.all([
    load("seo-content"),
    load("panchang"),
    load("credit-packs"),
    load("entitlements"),
    load("seo-routing"),
    load("seo-public"),
    load("legal-policies"),
  ]);
  return { seo, panchang, packs, entitlements, routing, publicSeo, legal };
}

const {
  seo,
  panchang: panchangLib,
  packs,
  entitlements,
  routing, publicSeo, legal,
} = await loadSharedModules();

const {
  SEO_CONTENT_PAGES,
  getSeoContentFaqs,
  getRelatedSeoContentPages,
  getSeoClusterPages,
  SEO_AUTHOR,
  SEO_PUBLISHER,
  SEO_CONTENT_REVIEWED,
  SEO_GUIDE_REDIRECTS,
  getMergedSeoGuide,
} = seo;

// ── Static page definitions ──────────────────────────────────────────────────

const { searchTitle, searchDescription, PRIVATE_ROUTES } = routing;

const defaultSeoLinks = [
  { label: "Free Kundali", href: "/free-kundali" },
  { label: "Kundali Matching", href: "/free-kundali-matching" },
  { label: "Today Panchang", href: "/panchang" },
  { label: "Daily Horoscope", href: "/daily-horoscope" },
  { label: "Pricing", href: "/pricing" },
];

const signs = [
  [
    "aries",
    "Aries",
    "Mesha",
    "Mars",
    "fire",
    "movable",
    "Ashwini, Bharani, and the first pada of Krittika",
  ],
  [
    "taurus",
    "Taurus",
    "Vrishabha",
    "Venus",
    "earth",
    "fixed",
    "the last three padas of Krittika, Rohini, and the first half of Mrigashira",
  ],
  [
    "gemini",
    "Gemini",
    "Mithuna",
    "Mercury",
    "air",
    "dual",
    "the second half of Mrigashira, Ardra, and the first three padas of Punarvasu",
  ],
  [
    "cancer",
    "Cancer",
    "Karka",
    "Moon",
    "water",
    "movable",
    "the fourth pada of Punarvasu, Pushya, and Ashlesha",
  ],
  [
    "leo",
    "Leo",
    "Simha",
    "Sun",
    "fire",
    "fixed",
    "Magha, Purva Phalguni, and the first pada of Uttara Phalguni",
  ],
  [
    "virgo",
    "Virgo",
    "Kanya",
    "Mercury",
    "earth",
    "dual",
    "the last three padas of Uttara Phalguni, Hasta, and the first half of Chitra",
  ],
  [
    "libra",
    "Libra",
    "Tula",
    "Venus",
    "air",
    "movable",
    "the second half of Chitra, Swati, and the first three padas of Vishakha",
  ],
  [
    "scorpio",
    "Scorpio",
    "Vrishchika",
    "Mars",
    "water",
    "fixed",
    "the fourth pada of Vishakha, Anuradha, and Jyeshtha",
  ],
  [
    "sagittarius",
    "Sagittarius",
    "Dhanu",
    "Jupiter",
    "fire",
    "dual",
    "Mula, Purva Ashadha, and the first pada of Uttara Ashadha",
  ],
  [
    "capricorn",
    "Capricorn",
    "Makara",
    "Saturn",
    "earth",
    "movable",
    "the last three padas of Uttara Ashadha, Shravana, and the first half of Dhanishta",
  ],
  [
    "aquarius",
    "Aquarius",
    "Kumbha",
    "Saturn",
    "air",
    "fixed",
    "the second half of Dhanishta, Shatabhisha, and the first three padas of Purva Bhadrapada",
  ],
  [
    "pisces",
    "Pisces",
    "Meena",
    "Jupiter",
    "water",
    "dual",
    "the fourth pada of Purva Bhadrapada, Uttara Bhadrapada, and Revati",
  ],
];

const periods = [
  [
    "daily",
    "Daily",
    "the Moon's position, which changes sign roughly every 2.25 days",
  ],
  [
    "weekly",
    "Weekly",
    "the Moon's full circuit and any sign changes by Mercury or Venus during the week",
  ],
  [
    "monthly",
    "Monthly",
    "the Sun's sign change and the slower movement of Mars and Venus",
  ],
  [
    "yearly",
    "Yearly",
    "Jupiter's annual sign change and Saturn's slower transit, which set the year's structural themes",
  ],
];

const PANCHANG_CITY = { city: "New Delhi", lat: 28.6139, lng: 77.209 };
const PANCHANG_DAYS = 180;

const futureDates = Array.from({ length: PANCHANG_DAYS }, (_, index) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + index);
  return date.toISOString().slice(0, 10);
});

// ── Homepage ─────────────────────────────────────────────────────────────────
// The single most important page for "what is AstroYou" queries, and until now
// the one route that shipped as an empty SPA shell.

const homePage = {
  path: "/",
  title: "Free Kundali, Panchang & Jyotish Guidance | AstroYou",
  description:
    "Create your free Vedic Kundali, check compatibility and daily Panchang, and get Jyotish guidance that remembers your chart and questions.",
  heading: "Free Vedic Kundali and Jyotish Guidance",
  schemaType: "WebSite",
  updated: SEO_CONTENT_REVIEWED,
  intro:
    "AstroYou is a Vedic astrology platform that computes your sidereal birth chart from date, exact time, and place, and then interprets it through a Jyotish guide that remembers your chart and the key things you share with it. Kundali generation, Kundali matching, and daily Panchang are free.",
  sections: [
    {
      title: "What AstroYou does",
      body: "It computes a full Janam Kundali — the D-1 rashi chart, ascendant, all nine grahas, house cusps, your Moon's Nakshatra and pada, and the complete Vimshottari dasha sequence — using the Lahiri ayanamsa, the standard adopted by India's Rashtriya Panchang. It then reads that chart against your actual question rather than returning a generic table.",
    },
    {
      title: "What makes it different from a horoscope app",
      body: "Sun-sign horoscopes apply to a twelfth of the world. AstroYou requires exact birth time and place because the ascendant advances about one degree every four minutes, and most Vedic interpretation is house-based. It also remembers your chart, your dasha timeline, and the key things you share with it, so guidance builds instead of restarting.",
    },
    {
      title: "What is free",
      body: `Janam Kundali generation, Kundali matching with the full 36-point Ashtakoot breakdown, Manglik checking, daily Panchang, and ${entitlements.ENTITLEMENTS.free.limits.monthlyCredits} credits once at signup — no card required. Paid plans start at ₹${entitlements.ENTITLEMENTS.premium.monthlyPriceInr} per month and guide sessions run from 5 credits per minute. Full rates are published at /pricing before you sign up.`,
    },
    {
      title: "Who you are talking to",
      body: "AstroYou's guides are not people, and every profile says so. Parts of this market present automated responses as human practitioners without saying so; AstroYou's policy is written down on the trust page rather than left implied.",
    },
    {
      title: "What AstroYou will not do",
      body: "It will not predict death, guarantee outcomes, or sell fear-based remedies. Where a question is medical, legal, or psychological, the correct answer is a doctor, a lawyer, or a therapist — and it will say so. Remedies follow the classical order: behaviour and service before anything that costs money.",
    },
  ],
  facts: [
    {
      label: "Ayanamsa",
      value: "Lahiri (Chitrapaksha)",
      source: "The standard used by India's Rashtriya Panchang",
    },
    { label: "Free tier", value: `${entitlements.ENTITLEMENTS.free.limits.monthlyCredits} credits once at signup, no card required` },
    { label: "Paid plans", value: `From ₹${entitlements.ENTITLEMENTS.premium.monthlyPriceInr}/month` },
    { label: "Guide session rate", value: "From 5 credits per minute" },
    { label: "Required birth inputs", value: "Date, exact time, and place" },
  ],
  faq: [
    {
      question: "What is AstroYou?",
      answer:
        "A Vedic astrology platform that generates a free sidereal birth chart from your date, exact time, and place of birth using the Lahiri ayanamsa, and interprets it with a Jyotish guide that remembers your chart, your dashas, and the key things you share with it.",
    },
    {
      question: "Is AstroYou free?",
      answer:
        `Kundali generation, Kundali matching, Manglik checking, and daily Panchang are free, along with ${entitlements.ENTITLEMENTS.free.limits.monthlyCredits} credits once at signup and no card requirement. Paid plans start at ₹${entitlements.ENTITLEMENTS.premium.monthlyPriceInr} per month; guide sessions run from 5 credits per minute.`,
    },
    {
      question: "Are the astrologers on AstroYou real people?",
      answer:
        "No. AstroYou's guides are not people, and every consultation profile says so. AstroYou publishes that policy in writing on its trust page rather than leaving it ambiguous.",
    },
    {
      question: "Do I need my exact birth time?",
      answer:
        "For house-based interpretation, yes. The ascendant advances roughly one degree every four minutes and changes sign about every two hours. Without accurate time you can still get planetary signs and your Moon's Nakshatra, but house analysis becomes unreliable.",
    },
    {
      question: "Which ayanamsa does AstroYou use?",
      answer:
        "Lahiri, also called Chitrapaksha — the standard used by India's official Rashtriya Panchang and by most Indian Vedic practice. It is currently around 24° and increases by roughly 50 arcseconds per year.",
    },
  ],
  links: [
    { label: "Free Kundali", href: "/free-kundali" },
    { label: "Kundali Matching", href: "/free-kundali-matching" },
    { label: "Today Panchang", href: "/panchang" },
    { label: "Daily Horoscope", href: "/daily-horoscope" },
    { label: "Vedic Astrology Guide", href: "/vedic-astrology" },
    { label: "Pricing", href: "/pricing" },
    { label: "Trust and Transparency", href: "/trust" },
    { label: "Help Centre", href: "/help" },
    { label: "Contact Support", href: "/support" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
  ],
  cta: "/free-kundali",
  ctaLabel: "Generate a free Kundali",
};

// ── Pricing, generated from the same constants the app bills against ─────────

const { CREDIT_PACKS, formatCreditRate } = packs;
const { ENTITLEMENTS } = entitlements;
const TIER_ORDER = ["free", "premium", "pro"];
// Mirrors src/lib/subscriptions.ts PAID_CHAT_FAIR_USE_PER_DAY.
const PAID_CHAT_FAIR_USE_PER_DAY = 150;
// Mirrors src/lib/report-pricing.ts (daily PDF lowest, yearly report highest).
const REPORT_CREDIT_COSTS = "10 to 199 credits each";
const perCredit = (id) =>
  `₹${(ENTITLEMENTS[id].monthlyPriceInr / ENTITLEMENTS[id].limits.monthlyCredits).toFixed(2)}`;

const pricingPage = {
  path: "/pricing",
  title: "AstroYou Pricing: Plans, Credits, and Consultation Rates",
  description: `AstroYou pricing in full: ${ENTITLEMENTS.free.limits.monthlyCredits} free credits at signup, Premium ₹${ENTITLEMENTS.premium.monthlyPriceInr}/month, Pro ₹${ENTITLEMENTS.pro.monthlyPriceInr}/month, credit packs from ₹${CREDIT_PACKS[0].amountInRupees}.`,
  heading: "Pricing",
  schemaType: "WebPage",
  updated: today,
  intro:
    "Every rate is listed here in full, before signup. Credits are a single currency shared across Jyotish chat, guide sessions, and PDF reports. A machine-readable copy of this page is published at /pricing.md.",
  sections: [
    {
      title: "Subscription plans",
      body: TIER_ORDER.map((id) => {
        const t = ENTITLEMENTS[id];
        return t.monthlyPriceInr === 0
          ? `${t.displayName}: free, with ${t.limits.monthlyCredits} credits granted once at signup and Jyotish chat at 1 credit per message.`
          : `${t.displayName}: ₹${t.monthlyPriceInr} per month, adding ${t.limits.monthlyCredits} credits each billing month (about ${perCredit(id)} per credit) and unlimited Jyotish chat with a fair-use limit of ${PAID_CHAT_FAIR_USE_PER_DAY} messages a day.`;
      }).join(" ") + " Every reading, forecast, report, and guide session is open on every plan, paid for in credits.",
    },
    {
      title: "Credit packs",
      body: `Credit packs are one-time purchases for people who do not want a subscription: ${CREDIT_PACKS.map((p) => `${p.label} for ₹${p.amountInRupees} (${formatCreditRate(p)})`).join(", ")}. Purchased credits do not expire while your wallet is active.`,
    },
    {
      title: "What credits are spent on",
      body: `guide sessions cost 5, 8, or 10 credits per minute depending on the guide; the clock runs from your first message until the session closes, and a partial minute is charged as a full minute. Jyotish chat costs 1 credit per message without a subscription. PDF reports cost ${REPORT_CREDIT_COSTS}. Weekly, monthly, and yearly forecasts, transit readings, and compatibility readings cost a few credits per view. One balance covers all of it.`,
    },
    {
      title: "What is free without paying anything",
      body: `Janam Kundali generation, Kundali matching with the full Ashtakoot breakdown, Manglik checking, daily Panchang, and ${ENTITLEMENTS.free.limits.monthlyCredits} credits granted once at signup. No card is required to reach any of it.`,
    },
  ],
  facts: [
    ...TIER_ORDER.map((id) => ({
      label: `${ENTITLEMENTS[id].displayName} plan`,
      value:
        ENTITLEMENTS[id].monthlyPriceInr === 0
          ? "Free"
          : `₹${ENTITLEMENTS[id].monthlyPriceInr}/month`,
      source:
        ENTITLEMENTS[id].monthlyPriceInr === 0
          ? `${ENTITLEMENTS[id].limits.monthlyCredits} credits once at signup`
          : `${ENTITLEMENTS[id].limits.monthlyCredits} credits each billing month`,
    })),
    { label: "Guide session rate", value: "5, 8, or 10 credits per minute" },
    { label: "Jyotish chat", value: "1 credit per message; unlimited on paid plans" },
    { label: "Machine-readable pricing", value: "/pricing.md" },
  ],
  comparison: {
    caption: "AstroYou plans compared",
    columns: TIER_ORDER.map((id) => ENTITLEMENTS[id].displayName),
    rows: [
      {
        criterion: "Monthly price",
        values: TIER_ORDER.map((id) =>
          ENTITLEMENTS[id].monthlyPriceInr === 0
            ? "Free"
            : `₹${ENTITLEMENTS[id].monthlyPriceInr}`,
        ),
      },
      {
        criterion: "Credits included",
        values: TIER_ORDER.map((id) =>
          ENTITLEMENTS[id].monthlyPriceInr === 0
            ? `${ENTITLEMENTS[id].limits.monthlyCredits} once, at signup`
            : `${ENTITLEMENTS[id].limits.monthlyCredits} per month`,
        ),
      },
      {
        criterion: "Effective price per credit",
        values: TIER_ORDER.map((id) =>
          ENTITLEMENTS[id].monthlyPriceInr === 0 ? "—" : perCredit(id),
        ),
      },
      {
        criterion: "Jyotish chat",
        values: TIER_ORDER.map((id) =>
          ENTITLEMENTS[id].limits.synthesisMessagesPerDay === -1
            ? `Unlimited (fair use: ${PAID_CHAT_FAIR_USE_PER_DAY}/day)`
            : "1 credit per message",
        ),
      },
      {
        criterion: "Reports, forecasts, guide sessions",
        values: TIER_ORDER.map(() => "Open to all, paid in credits"),
      },
    ],
  },
  faq: [
    {
      question: "How much does AstroYou cost?",
      answer: `The free tier costs nothing and grants ${ENTITLEMENTS.free.limits.monthlyCredits} credits once at signup, with no card. Premium is ₹${ENTITLEMENTS.premium.monthlyPriceInr} per month with ${ENTITLEMENTS.premium.limits.monthlyCredits} credits; Pro is ₹${ENTITLEMENTS.pro.monthlyPriceInr} per month with ${ENTITLEMENTS.pro.limits.monthlyCredits}. Credit packs start at ₹${CREDIT_PACKS[0].amountInRupees}.`,
    },
    {
      question: "What is a credit worth?",
      answer: `A credit is the unit every paid feature is priced in. A guide session costs 5, 8, or 10 credits per minute depending on the guide, Jyotish chat costs 1 credit per message without a subscription, and PDF reports cost ${REPORT_CREDIT_COSTS}. Packs range from ${CREDIT_PACKS[0].label} at ₹${CREDIT_PACKS[0].amountInRupees} (${formatCreditRate(CREDIT_PACKS[0])}) to ${CREDIT_PACKS[CREDIT_PACKS.length - 1].label} at ₹${CREDIT_PACKS[CREDIT_PACKS.length - 1].amountInRupees} (${formatCreditRate(CREDIT_PACKS[CREDIT_PACKS.length - 1])}).`,
    },
    {
      question: "Is there a free plan?",
      answer: `Yes. Kundali generation, Kundali matching, Manglik checking, and daily Panchang are free permanently, plus ${ENTITLEMENTS.free.limits.monthlyCredits} credits granted once at signup. The free credits do not renew each month. No card is required.`,
    },
    {
      question: "Do unused credits expire?",
      answer:
        "Purchased credits stay in your wallet. Subscription credits are added to your wallet each time a monthly payment succeeds.",
    },
  ],
  links: defaultSeoLinks,
  cta: "/free-kundali",
  ctaLabel: "Start free",
};

// Remaining routes that were shipping as empty SPA shells. These do not need
// deep content, but they do need a real title, description, canonical, and a
// body that says what the page is.
const supportPages = [
  {
    path: "/help",
    title: "AstroYou Help Centre",
    description:
      "Answers to common AstroYou questions — birth data accuracy, credits and billing, chart calculation, who you are talking to, and account management.",
    heading: "Help Centre",
    intro:
      "Common questions about birth data, credits, chart calculation, and accounts. If something here does not answer your question, support is reachable from the support page.",
    sections: [
      {
        title: "Birth data",
        body: "AstroYou needs date, exact time, and place of birth. Time matters because the ascendant advances about one degree every four minutes. If your recorded time is uncertain, you can still generate a chart, but house-based readings will be approximate.",
      },
      {
        title: "Credits and billing",
        body: "Credits are shared across Jyotish chat, guide sessions, and PDF reports. guide sessions start at 5 credits per minute. Purchased credits stay in your wallet; subscription credits are added at each monthly payment.",
      },
      {
        title: "Chart calculation",
        body: "Charts use the Lahiri (Chitrapaksha) ayanamsa. If a chart here differs from another site, ayanamsa choice is almost always the reason rather than a calculation error.",
      },
      {
        title: "Accounts and data",
        body: "You can sign in with Google or email. Your chart, conversation history, and journal entries are stored against your account and are used to give your Jyotish guide continuity between sessions.",
      },
    ],
    schemaType: "WebPage",
    updated: SEO_CONTENT_REVIEWED,
    faq: [
      {
        question: "Why does AstroYou need my exact birth time?",
        answer:
          "Because the ascendant advances about one degree every four minutes and changes sign roughly every two hours. Most Vedic interpretation is house-based, and houses shift with the ascendant. Without an accurate time, planetary signs and your Moon's Nakshatra remain usable but house analysis does not.",
      },
      {
        question: "What are credits used for?",
        answer:
          "Credits are one currency across Jyotish chat, guide sessions, and PDF reports. guide sessions start at 5 credits per minute. Purchased credits stay in your wallet; subscription credits are added at each monthly payment.",
      },
      {
        question: "Why does my chart differ from another astrology site?",
        answer:
          "Almost always the ayanamsa. AstroYou uses Lahiri (Chitrapaksha), the Indian standard. Raman and Krishnamurti ayanamsas differ by fractions of a degree, which only matters when a planet sits near a sign boundary.",
      },
      {
        question: "Can I change the birth details on a saved chart?",
        answer:
          "Yes, from your profile settings. If the chart was already used for readings, support can help correct the saved history as well.",
      },
    ],
    links: [
      { label: "Support", href: "/support" },
      { label: "Trust and Transparency", href: "/trust" },
      { label: "Pricing", href: "/pricing" },
      { label: "Privacy Policy", href: "/privacy" },
    ],
    cta: "/support",
    ctaLabel: "Contact support",
  },
  {
    path: "/support",
    title: "AstroYou Support",
    description:
      "Contact AstroYou support for billing questions, chart corrections, account access, and refunds.",
    heading: "Support",
    intro:
      "Reach the AstroYou team for billing questions, chart corrections, account access problems, or refund requests.",
    sections: [
      {
        title: "What support can help with",
        body: "Billing and credit questions, correcting birth details on a saved chart, account access, and refund requests under the refund policy.",
      },
      {
        title: "What to include",
        body: "Your account email and, for chart issues, the birth date, time, and place you entered. For billing, the payment reference helps.",
      },
    ],
    schemaType: "WebPage",
    updated: SEO_CONTENT_REVIEWED,
    faq: [
      {
        question: "How do I contact AstroYou support?",
        answer:
          "Through the support page, with your account email included. For chart issues, add the birth date, time, and place you entered; for billing, add the payment reference.",
      },
      {
        question: "Can I get a refund?",
        answer:
          "Refunds are handled under the refund policy. Contact support with your payment reference and the reason for the request.",
      },
      {
        question: "How do I correct wrong birth details?",
        answer:
          "You can edit them in profile settings. If readings were already generated from the incorrect data, support can help clear the affected history.",
      },
    ],
    links: [
      { label: "Help Centre", href: "/help" },
      { label: "Refund Policy", href: "/refund-policy" },
      { label: "Pricing", href: "/pricing" },
    ],
    cta: "/help",
    ctaLabel: "Read the Help Centre",
  },
  {
    path: "/privacy",
    title: "AstroYou Privacy Policy",
    description:
      "How AstroYou collects, stores, and uses birth data, conversation history, and account information.",
    heading: "Privacy Policy",
    intro:
      "This page summarises how AstroYou handles your data. The full policy text is on the page itself.",
    sections: [
      {
        title: "What is collected",
        body: "Account details, birth data you enter, conversation history with your Jyotish guide, and journal entries you choose to save.",
      },
      {
        title: "Why it is stored",
        body: "Birth data is required to compute your chart. Conversation history is retained so guidance has continuity between sessions rather than restarting each time.",
      },
    ],
    schemaType: "WebPage",
    updated: SEO_CONTENT_REVIEWED,
    faq: [
      {
        question: "What data does AstroYou collect?",
        answer:
          "Account details, the birth data you enter, your conversation history with your Jyotish guide, and any journal entries you choose to save.",
      },
      {
        question: "Why is conversation history stored?",
        answer:
          "So guidance has continuity. Your Jyotish guide references your chart, dasha timeline, and previous questions rather than restarting from zero each session.",
      },
      {
        question: "Can I delete my data?",
        answer:
          "Yes. Contact support from the account email to request deletion of your chart, conversation history, and account.",
      },
    ],
    links: [
      { label: "Terms of Service", href: "/terms" },
      { label: "Trust", href: "/trust" },
      { label: "Support", href: "/support" },
    ],
    cta: "/terms",
    ctaLabel: "Read the terms",
  },
  {
    path: "/terms",
    title: "AstroYou Terms of Service",
    description:
      "The terms governing use of AstroYou, including credits, subscriptions, refunds, and the limits of astrological guidance.",
    heading: "Terms of Service",
    intro:
      "The terms governing use of AstroYou, including billing, credits, and the explicit limits of what astrological guidance is offered as.",
    sections: [
      {
        title: "Nature of the service",
        body: "AstroYou provides astrological guidance for reflection and self-awareness. It is not medical, legal, financial, or psychological advice, and it should not be used as a substitute for a qualified professional in any of those areas.",
      },
      {
        title: "Billing and credits",
        body: "Subscriptions renew monthly until cancelled. Credits purchased in packs remain in your wallet. Refunds are handled under the refund policy.",
      },
    ],
    schemaType: "WebPage",
    updated: SEO_CONTENT_REVIEWED,
    faq: [
      {
        question: "Is AstroYou a substitute for professional advice?",
        answer:
          "No. Astrological guidance is offered for reflection and self-awareness. It is not medical, legal, financial, or psychological advice, and it should not replace a qualified professional in any of those areas.",
      },
      {
        question: "How does subscription billing work?",
        answer:
          "Subscriptions renew monthly until cancelled. Credits included with a subscription are added at each successful monthly payment; credits bought in packs remain in your wallet.",
      },
      {
        question: "What are the limits on guidance?",
        answer:
          "AstroYou does not predict death, guarantee outcomes, or sell fear-based remedies, and it refers medical, legal, and psychological questions to appropriate professionals.",
      },
    ],
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Refund Policy", href: "/refund-policy" },
      { label: "Pricing", href: "/pricing" },
    ],
    cta: "/pricing",
    ctaLabel: "See pricing",
  },
  {
    path: "/experts/apply",
    // Every guide on AstroYou is AI; this intake page stays reachable for
    // people who already have the link but is kept out of search.
    noindex: true,
    title: "Apply as an Astrologer on AstroYou",
    description:
      "Apply to join AstroYou as a practising astrologer. What we look for, how verification works, and how listings are labelled.",
    heading: "Apply as an Expert",
    intro:
      "AstroYou's guides today are not people. This page records interest from practising astrologers; applying does not create a listing. If human practitioners are ever listed, they will be labelled distinctly from the guides.",
    sections: [
      {
        title: "What we look for",
        body: "Demonstrable Jyotish training, a practice history you can describe, and willingness to work within the platform's guidance limits — no fear-based remedy selling, no death prediction, and referral out where a question is medical or legal.",
      },
      {
        title: "How listings are labelled",
        body: "Human astrologers are labelled as human, and guides that are not people are labelled as not people, on every profile. That labelling is not optional and is documented on the trust page.",
      },
    ],
    schemaType: "WebPage",
    updated: SEO_CONTENT_REVIEWED,
    faq: [
      {
        question: "Who can apply as an astrologer on AstroYou?",
        answer:
          "Practitioners with demonstrable Jyotish training and a practice history they can describe, willing to work within the platform's guidance limits.",
      },
      {
        question: "Are human astrologers labelled differently from the guides?",
        answer:
          "Yes. Human practitioners are labelled as human, and guides that are not people say so, on every profile. The labelling is not optional and is documented on the trust page.",
      },
      {
        question: "What guidance limits apply?",
        answer:
          "No death prediction, no fear-based remedy selling, and referral out where a question is medical, legal, or psychological.",
      },
    ],
    links: [
      { label: "Trust and Transparency", href: "/trust" },
      { label: "Help Centre", href: "/help" },
    ],
    cta: "/trust",
    ctaLabel: "Read our trust policy",
  },
  {
    path: "/wellness",
    title: "Vedic Wellness: Dinacharya, Doshas, and Daily Rhythm",
    description:
      "How Vedic timing intersects with daily wellness routine — dinacharya, the Ayurvedic doshas, and using Panchang to structure a day.",
    heading: "Vedic Wellness",
    intro:
      "Jyotish and Ayurveda share a timing vocabulary. This page covers how daily rhythm, dosha awareness, and Panchang timing fit together in practice.",
    sections: [
      {
        title: "Dinacharya, the daily routine",
        body: "Classical Ayurvedic routine anchors the day to sunrise rather than the clock: waking before sunrise, eating the main meal near solar noon when digestion is strongest, and settling before late evening. Panchang gives you the local sunrise these anchors depend on.",
      },
      {
        title: "Doshas and chart temperament",
        body: "The three doshas — vata, pitta, and kapha — map loosely onto chart temperament, with Mercury and Saturn leaning vata, Sun and Mars pitta, and Moon, Venus and Jupiter kapha. The mapping is indicative rather than diagnostic; an Ayurvedic practitioner determines constitution properly.",
      },
      {
        title: "Using Panchang for routine",
        body: "Abhijit Muhurat, the roughly 48-minute window around local solar noon, is the traditional slot for demanding work. Rahu Kaal, about 90 minutes daily, is traditionally avoided for new starts. Both are derived from local sunrise, so both are city-specific.",
      },
    ],
    schemaType: "Article",
    updated: SEO_CONTENT_REVIEWED,
    faq: [
      {
        question: "What is dinacharya?",
        answer:
          "The classical Ayurvedic daily routine, anchored to sunrise rather than the clock: waking before sunrise, taking the main meal near solar noon when digestion is strongest, and settling before late evening.",
      },
      {
        question: "How do the doshas relate to my birth chart?",
        answer:
          "Loosely. Mercury and Saturn lean vata, Sun and Mars pitta, and Moon, Venus and Jupiter kapha. The mapping is indicative rather than diagnostic \u2014 constitution is properly determined by an Ayurvedic practitioner.",
      },
      {
        question: "How do I use Panchang for daily routine?",
        answer:
          "Abhijit Muhurat, roughly 48 minutes around local solar noon, is the traditional window for demanding work. Rahu Kaal, about 90 minutes daily, is avoided for new starts. Both derive from local sunrise, so both are city-specific.",
      },
    ],
    links: [
      { label: "Today Panchang", href: "/panchang" },
      { label: "Free Kundali", href: "/free-kundali" },
      { label: "Remedies", href: "/gemstone-remedies" },
    ],
    cta: "/panchang",
    ctaLabel: "Check today's Panchang",
  },
  {
    path: "/human-design",
    title: "Human Design and Vedic Astrology: How They Differ",
    description:
      "How Human Design relates to Vedic astrology — shared astronomical inputs, different interpretive frameworks, and what each is useful for.",
    heading: "Human Design",
    intro:
      "Human Design draws on astrological positions among other systems. This page explains where it overlaps with Jyotish and where the two diverge.",
    sections: [
      {
        title: "Shared inputs",
        body: "Both need date, exact time, and place of birth, and both read planetary positions. Human Design additionally uses a second calculation about 88 solar degrees before birth, which has no Jyotish equivalent.",
      },
      {
        title: "Different frameworks",
        body: "Jyotish reads houses, signs, Nakshatras, and dashas, with a timing system built in. Human Design maps positions onto a 64-gate structure derived from the I Ching along with chakra-like centres. The astronomy is shared; the interpretation is not.",
      },
      {
        title: "Which to use",
        body: "Jyotish has the stronger timing apparatus, which is what most people actually want from a chart. Human Design is typically used for temperament and decision-style framing rather than prediction.",
      },
    ],
    schemaType: "Article",
    updated: SEO_CONTENT_REVIEWED,
    faq: [
      {
        question: "Is Human Design the same as Vedic astrology?",
        answer:
          "No. Both use date, exact time, and place of birth and both read planetary positions, but Human Design maps them onto a 64-gate I Ching structure while Jyotish reads houses, signs, Nakshatras, and dashas. The astronomy is shared; the interpretation is not.",
      },
      {
        question: "Which is better for timing questions?",
        answer:
          "Jyotish, which has a built-in timing apparatus in the Vimshottari dasha system. Human Design is typically used for temperament and decision-style framing rather than prediction.",
      },
      {
        question: "Can I use both?",
        answer:
          "Yes \u2014 they answer different questions from the same birth data. Neither invalidates the other, but do not expect their vocabularies to translate.",
      },
    ],
    links: [
      { label: "Free Kundali", href: "/free-kundali" },
      { label: "Vedic Astrology Guide", href: "/vedic-astrology" },
      { label: "Numerology", href: "/numerology" },
    ],
    cta: "/free-kundali",
    ctaLabel: "Generate your Vedic chart",
  },
  {
    path: "/advanced-vedic",
    title:
      "Advanced Vedic Astrology: Divisional Charts, Yogas, and Ashtakavarga",
    description:
      "Advanced Jyotish techniques — the sixteen divisional charts, yoga formation, Ashtakavarga scoring, and Jaimini methods.",
    heading: "Advanced Vedic Astrology",
    intro:
      "Techniques beyond the rashi chart: divisional charts, yoga identification, Ashtakavarga point scoring, and the Jaimini system.",
    sections: [
      {
        title: "Divisional charts (vargas)",
        body: "Sixteen vargas are described classically, each refining a specific topic. The D-9 Navamsa is the general strength test and the most widely used; D-10 Dashamsha covers career, D-7 Saptamsha children, and D-12 Dwadashamsha parents. A promise present in the rashi chart but absent from the relevant varga usually under-delivers.",
      },
      {
        title: "Yogas",
        body: "A yoga is a defined planetary combination with a stated result. Raja yogas form from kendra and trikona lord connections; dhana yogas from wealth-house lord connections; viparita raja yogas from dusthana lords interacting. Most charts contain several, and their strength depends on the participating planets' dignity.",
      },
      {
        title: "Ashtakavarga",
        body: "A point-scoring system assigning benefic points to each sign from each planet's perspective, producing a Sarvashtakavarga total out of 337 points across twelve signs. It gives a numerical read on which signs and houses carry strength, useful for transit work.",
      },
      {
        title: "Jaimini",
        body: "A parallel system using chara karakas assigned by planetary degree, rashi aspects rather than planetary aspects, and its own dasha schemes. Practitioners typically use it to confirm or refine Parashari conclusions rather than to replace them.",
      },
    ],
    schemaType: "Article",
    updated: SEO_CONTENT_REVIEWED,
    faq: [
      {
        question: "What are divisional charts?",
        answer:
          "Sixteen vargas described in classical texts, each refining a specific topic. The D-9 Navamsa is the general strength test, D-10 covers career, D-7 children, and D-12 parents.",
      },
      {
        question: "What is Ashtakavarga?",
        answer:
          "A point-scoring system assigning benefic points to each sign from each planet's perspective, producing a Sarvashtakavarga total out of 337 points across twelve signs. It is mainly used for transit work.",
      },
      {
        question: "What is the difference between Parashari and Jaimini?",
        answer:
          "Parashari uses planetary aspects, house lordship, and Vimshottari dashas. Jaimini uses chara karakas assigned by degree, rashi aspects, and its own dasha schemes. Most practitioners read Parashari first and use Jaimini to confirm.",
      },
      {
        question: "How many yogas are there?",
        answer:
          "Classical texts describe hundreds. The main families are raja yogas from kendra-trikona lord connections, dhana yogas from wealth-house lords, and viparita raja yogas from dusthana lords interacting.",
      },
    ],
    links: [
      { label: "Vedic Astrology Guide", href: "/vedic-astrology" },
      { label: "Dasha Guide", href: "/dasha" },
      { label: "Free Kundali", href: "/free-kundali" },
    ],
    cta: "/free-kundali",
    ctaLabel: "Generate your chart",
  },
  {
    path: "/astromap",
    title: "Astrocartography: Vedic Astrology by Location",
    description:
      "How astrocartography maps planetary lines onto geography, and how it is read alongside a Vedic birth chart for relocation questions.",
    heading: "Astrocartography",
    intro:
      "Astrocartography projects your chart onto a world map, drawing lines where each planet was angular at your moment of birth. It is used for relocation and travel questions.",
    sections: [
      {
        title: "What the lines mean",
        body: "Each planet produces four lines — where it was rising, setting, at the midheaven, and at the nadir. Being near a line is held to emphasise that planet's significations in that location. Jupiter and Venus lines are read as supportive, Saturn and Mars lines as demanding.",
      },
      {
        title: "How it fits with Jyotish",
        body: "Astrocartography is a Western technique and is not part of classical Jyotish. Vedic practice approaches relocation through the 4th house, the 12th house for foreign lands, and Rahu for foreign contact. The two can be read together, but they are separate traditions.",
      },
      {
        title: "Practical limits",
        body: "A line does not override the chart. Practical factors — visa, work, family, cost — matter more than a planetary line, and no reputable practitioner would advise relocating on astrocartography alone.",
      },
    ],
    schemaType: "Article",
    updated: SEO_CONTENT_REVIEWED,
    faq: [
      {
        question: "What is astrocartography?",
        answer:
          "A technique projecting your birth chart onto a world map, drawing lines where each planet was angular at your moment of birth. Proximity to a line is held to emphasise that planet's significations in that place.",
      },
      {
        question: "Is astrocartography part of Vedic astrology?",
        answer:
          "No \u2014 it is a Western technique. Vedic practice approaches relocation through the 4th house, the 12th house for foreign lands, and Rahu for foreign contact. The two can be read together but are separate traditions.",
      },
      {
        question: "Should I relocate based on astrocartography?",
        answer:
          "Not on its own. Visa, work, family, and cost matter more than a planetary line, and no reputable practitioner would advise relocating on this technique alone.",
      },
    ],
    links: [
      { label: "Free Kundali", href: "/free-kundali" },
      { label: "Advanced Vedic", href: "/advanced-vedic" },
      { label: "Pricing", href: "/pricing" },
    ],
    cta: "/free-kundali",
    ctaLabel: "Generate your chart",
  },
];

// ── Horoscope pages ──────────────────────────────────────────────────────────

const signIndexPages = signs.map(
  ([slug, name, sanskrit, lord, element, quality, nakshatras]) => ({
    path: `/horoscope/${slug}`,
    title: `${name} Horoscope`,
    description: `${name} — ${sanskrit} in Sanskrit — is a ${quality} ${element} sign ruled by ${lord}, spanning ${nakshatras}. Read free daily, weekly, monthly, and yearly forecasts.`,
    heading: `${name} Horoscope`,
    schemaType: "CollectionPage",
    updated: today,
    intro: `${name}, called ${sanskrit} in Sanskrit, is a ${quality} ${element} sign ruled by ${lord}. It spans ${nakshatras}. In Vedic practice these forecasts are read from your Moon sign rather than your Sun sign.`,
    sections: [
      {
        title: `What defines ${name}`,
        body: `${sanskrit} is ruled by ${lord}, which means ${lord}'s condition in your chart — its sign, house, and dignity — colours how this rashi actually behaves for you. As a ${quality} ${element} sign it leans toward ${quality === "movable" ? "initiation and change" : quality === "fixed" ? "consolidation and persistence" : "adaptation and negotiation"}.`,
      },
      {
        title: "Read this from your Moon sign",
        body: `Vedic horoscopes are calculated from the Janma Rashi — the sign the Moon occupied at your birth — not the Sun sign used in Western horoscopes. Because the sidereal zodiac is offset by an ayanamsa of roughly 24°, your Vedic sign is usually one behind your Western one. If you have not checked, calculate it before relying on these pages.`,
      },
      {
        title: "Which Nakshatras fall in this sign",
        body: `${name} covers ${nakshatras}. The Nakshatra is a finer division than the sign — 27 segments of 13°20' against 12 segments of 30° — and it determines your starting mahadasha in the Vimshottari sequence. Two people with the same Moon sign but different Nakshatras can read quite differently.`,
      },
      {
        title: "The limits of a sign-based forecast",
        body: `Any ${name} horoscope applies to roughly a twelfth of the population. It cannot account for your ascendant, your house placements, or which dasha you are running. It describes transit weather, which is real but general. For timing that is specific to you, the mahadasha and antardasha matter far more.`,
      },
    ],
    facts: [
      { label: "Sanskrit name", value: sanskrit },
      { label: "Ruling graha", value: lord },
      { label: "Element and quality", value: `${element}, ${quality}` },
      { label: "Nakshatras spanned", value: nakshatras },
      { label: "Span", value: "30° of the sidereal zodiac" },
    ],
    faq: [
      {
        question: `Which planet rules ${name}?`,
        answer: `${lord} rules ${name} (${sanskrit}). How the sign behaves in your chart depends on where ${lord} sits — its own sign, house, dignity, and current dasha all modify the result.`,
      },
      {
        question: `Is ${name} a fire, earth, air, or water sign?`,
        answer: `${name} is a ${element} sign and ${quality} by quality, which in Vedic classification leans it toward ${quality === "movable" ? "initiating and changing circumstances" : quality === "fixed" ? "holding and consolidating" : "adapting and mediating"}.`,
      },
      {
        question: `Should I read the ${name} horoscope if it's my Sun sign?`,
        answer: `Vedic practice reads the Moon sign. Because the sidereal zodiac differs from the tropical by about 24°, your Vedic Moon sign is often not the sign you know from Western horoscopes. Calculate your Janma Rashi first.`,
      },
      {
        question: `Which Nakshatras are in ${name}?`,
        answer: `${name} spans ${nakshatras}. Your birth Nakshatra within the sign determines your starting Vimshottari mahadasha, which is why two people sharing a Moon sign can have very different timing.`,
      },
    ],
    links: [
      ...periods.map(([p, label]) => ({
        label: `${name} ${label}`,
        href: `/horoscope/${slug}/${p}`,
      })),
      { label: "Free Kundali", href: "/free-kundali" },
      { label: "Moon Sign Calculator", href: "/moon-sign-calculator" },
    ],
    cta: "/moon-sign-calculator",
    ctaLabel: "Find your Moon sign",
  }),
);

const signPages = signs.flatMap(
  ([slug, name, sanskrit, lord, element, quality, nakshatras]) =>
    periods.map(([period, periodName, driver]) => ({
      path: `/horoscope/${slug}/${period}`,
      title: `${name} ${periodName} Horoscope (${sanskrit})`,
      description: `${name} ${periodName.toLowerCase()} horoscope. ${name} is a ${quality} ${element} sign ruled by ${lord}. ${periodName} forecasts track ${driver}.`,
      heading: `${name} ${periodName} Horoscope`,
      schemaType: "Article",
      updated: today,
      intro: `${name} (${sanskrit}) is ruled by ${lord}. A ${periodName.toLowerCase()} forecast for this rashi tracks ${driver}.`,
      sections: [
        {
          title: `What drives a ${periodName.toLowerCase()} forecast`,
          body: `${periodName} predictions are built from ${driver}. That is what makes a ${periodName.toLowerCase()} horoscope different in kind from the other periods — it is not the same reading at a different zoom level, it is a different set of moving parts.`,
        },
        {
          title: `${name} specifics`,
          body: `Because ${name} is ruled by ${lord}, transits involving ${lord} matter more for this rashi than for others. ${lord}'s position in your own chart determines whether a favourable transit for ${name} generally is favourable for you specifically.`,
        },
        {
          title: "Read from the Moon sign",
          body: `Use your Janma Rashi — the Moon's sign at birth — not your Western Sun sign. The sidereal and tropical zodiacs differ by roughly 24°, which usually shifts placements back by one sign.`,
        },
        {
          title: "What this cannot tell you",
          body: `A sign forecast covers about a twelfth of the population and ignores your ascendant, house placements, and dasha. For ${periodName.toLowerCase()} guidance specific to you, the running mahadasha and antardasha matter more than the sign transit does.`,
        },
      ],
      facts: [
        { label: "Sign", value: `${name} (${sanskrit})` },
        { label: "Ruling graha", value: lord },
        { label: "Element and quality", value: `${element}, ${quality}` },
        { label: "Forecast basis", value: driver },
      ],
      faq: [
        {
          question: `What is the ${name} ${periodName.toLowerCase()} horoscope based on?`,
          answer: `On ${driver}. As a ${quality} ${element} sign ruled by ${lord}, ${name} responds particularly to transits involving ${lord}.`,
        },
        {
          question: `Is the ${name} ${periodName.toLowerCase()} horoscope accurate for me?`,
          answer: `Only in general terms. It applies to everyone sharing ${name} as a Moon sign — roughly a twelfth of people — and cannot account for your ascendant, house placements, or current dasha. Even within ${name}, your birth Nakshatra (${nakshatras}) changes the reading.`,
        },
        {
          question: `Should I use my Sun sign or Moon sign for this?`,
          answer: `Moon sign. Vedic forecasts are read from the Janma Rashi, and the sidereal zodiac's roughly 24° offset means your Vedic Moon sign is often not the sign you know from Western astrology.`,
        },
        {
          question: `What is more reliable than a ${periodName.toLowerCase()} horoscope?`,
          answer: `Your Vimshottari mahadasha and antardasha, and the transits of Saturn and Jupiter across your own natal points. Those are chart-specific rather than shared by a twelfth of the population.`,
        },
      ],
      links: [
        ...periods
          .filter(([p]) => p !== period)
          .map(([p, label]) => ({
            label: `${name} ${label}`,
            href: `/horoscope/${slug}/${p}`,
          })),
        { label: `All ${name} Horoscopes`, href: `/horoscope/${slug}` },
        { label: "Free Kundali", href: "/free-kundali" },
      ],
      cta: "/free-kundali",
      ctaLabel: "Get a chart-based forecast",
    })),
);

// ── Panchang date pages, with real almanac values ────────────────────────────

const API_BASE = "https://api.astrology-api.io/api/v3";
// Live Panchang calls spend paid-API quota (up to 180 per cold build). Only
// production builds — or an explicit PRERENDER_LIVE_PANCHANG=1 — make them;
// deploy previews, branch deploys and local builds use the cross-build cache
// or descriptive copy. Netlify sets CONTEXT at build time.
const BUILD_CONTEXT = process.env.CONTEXT || "";
const allowLivePanchang =
  BUILD_CONTEXT === "production" || process.env.PRERENDER_LIVE_PANCHANG === "1";
const apiKey = allowLivePanchang
  ? process.env.ASTROLOGY_API_KEY || process.env.ASTROYOU_API_KEY
  : undefined;
const panchangSkipReason = allowLivePanchang
  ? "ASTROLOGY_API_KEY not set"
  : `live Panchang calls disabled for the "${BUILD_CONTEXT || "local"}" build ` +
    "(set PRERENDER_LIVE_PANCHANG=1 to force)";

/**
 * Panchang values for a fixed date never change, so they are cached across
 * builds inside node_modules — which Netlify restores between deploys. Without
 * this, every deploy re-requested all 180 dates and a few deploys in quick
 * succession were enough to hit the provider's rate limit (429), silently
 * degrading the date pages back to placeholder copy.
 */
const PANCHANG_CACHE = path.resolve(
  "node_modules/.cache/astroyou-panchang.json",
);

async function readPanchangCache() {
  try {
    const raw = JSON.parse(await readFile(PANCHANG_CACHE, "utf8"));
    if (raw?.city !== PANCHANG_CITY.city) return new Map();
    return new Map(Object.entries(raw.dates ?? {}));
  } catch {
    return new Map();
  }
}

async function writePanchangCache(map) {
  // Prune dates that have fallen out of the prerendered window.
  const keep = new Set(futureDates);
  const dates = Object.fromEntries(
    [...map.entries()].filter(([date]) => keep.has(date)),
  );
  await mkdir(path.dirname(PANCHANG_CACHE), { recursive: true });
  await writeFile(
    PANCHANG_CACHE,
    JSON.stringify({ city: PANCHANG_CITY.city, dates }),
    "utf8",
  );
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Hard ceiling on the whole Panchang phase. A rate-limited provider plus
 * per-request backoff can otherwise stretch this to many minutes and stall a
 * deploy. Pages without data degrade to descriptive copy and the next build
 * picks them up from cache, so giving up early is strictly better than
 * blocking the release.
 */
const PANCHANG_BUDGET_MS = Number(process.env.PANCHANG_BUDGET_MS ?? 90_000);
let panchangDeadline = Infinity;

/**
 * Set once a 429 response body identifies itself as a hard quota rejection
 * (as opposed to an ordinary rate-limit that is worth backing off and
 * retrying). Once true, every subsequent call short-circuits without
 * touching the network — a cold build with 180 dates to fetch must not keep
 * spending the remaining monthly quota against a provider that has already
 * said no.
 */
let quotaExhausted = false;

async function fetchPanchang(date, attempt = 0, cachedValue) {
  if (quotaExhausted) return cachedValue ?? null;
  if (Date.now() > panchangDeadline) throw new Error("budget-exhausted");

  const [year, month, day] = date.split("-").map(Number);
  const res = await fetch(`${API_BASE}/vedic/panchang`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({
      datetime_location: {
        year,
        month,
        day,
        hour: 6,
        minute: 0,
        second: 0,
        city: PANCHANG_CITY.city,
        latitude: PANCHANG_CITY.lat,
        longitude: PANCHANG_CITY.lng,
      },
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (res.status === 429) {
    const bodyText = await res.text().catch(() => "");
    if (/RATE_LIMIT_EXCEEDED|Quota exceeded/i.test(bodyText)) {
      if (!quotaExhausted) {
        quotaExhausted = true;
        console.warn(
          "prerender: Panchang API quota exhausted — remaining dates fall back to cache/descriptive copy for this build.",
        );
      }
      return cachedValue ?? null;
    }

    if (attempt < 3) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const waitMs =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 2000 * 2 ** attempt;
      // Do not sleep past the deadline; fail this date and let the phase end.
      if (Date.now() + waitMs > panchangDeadline) throw new Error("429");
      await sleep(waitMs);
      return fetchPanchang(date, attempt + 1, cachedValue);
    }

    throw new Error("429");
  }

  if (!res.ok) throw new Error(`${res.status}`);
  const json = await res.json();
  return panchangLib.normalizePanchang(json.data ?? json);
}

/** Bounded-concurrency map so 180 dates do not open 180 sockets at once. */
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        try {
          results[index] = await fn(items[index]);
        } catch {
          results[index] = null;
        }
      }
    }),
  );
  return results;
}

async function loadPanchangData() {
  const cached = await readPanchangCache();

  if (!apiKey) {
    if (cached.size) {
      console.warn(
        `prerender: ${panchangSkipReason} — using ${cached.size} cached ` +
          "Panchang dates. Dates outside the cache fall back to descriptive copy.",
      );
      return cached;
    }
    console.warn(
      `prerender: ${panchangSkipReason} and no Panchang cache — date pages ` +
        "will describe what the page offers rather than claiming values that " +
        "are not present.",
    );
    return new Map();
  }

  const missing = futureDates.filter((date) => !cached.has(date));
  if (!missing.length) {
    console.log(
      `prerender: all ${futureDates.length} Panchang dates served from cache`,
    );
    return cached;
  }

  const started = Date.now();
  panchangDeadline = started + PANCHANG_BUDGET_MS;
  const values = await mapWithConcurrency(missing, 6, (date) =>
    fetchPanchang(date, 0, cached.get(date)),
  );
  values.forEach((value, index) => {
    if (value) cached.set(missing[index], value);
  });

  const resolved = futureDates.filter((date) => cached.has(date)).length;
  console.log(
    `prerender: Panchang ${resolved}/${futureDates.length} dates ` +
      `(${missing.length} fetched in ${Math.round((Date.now() - started) / 1000)}s, ` +
      `${futureDates.length - missing.length} cached)`,
  );
  if (resolved < futureDates.length) {
    console.warn(
      `prerender: ${futureDates.length - resolved} Panchang dates unavailable ` +
        "(likely provider rate limiting) — those pages fall back to descriptive " +
        "content and will be retried on the next build.",
    );
  }

  await writePanchangCache(cached);
  return cached;
}

const panchangByDate = await loadPanchangData();

const MISSING = panchangLib.MISSING;
const has = (value) => Boolean(value) && value !== MISSING;

function panchangDatePage(date) {
  const data = panchangByDate.get(date);
  const readable = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const base = {
    path: `/panchang/${date}`,
    heading: `Panchang for ${readable}`,
    schemaType: "Article",
    updated: today,
    links: [
      { label: "Today Panchang", href: "/panchang" },
      { label: "Muhurat Finder", href: "/muhurat" },
      { label: "Free Kundali", href: "/free-kundali" },
    ],
    cta: `/panchang/${date}`,
    ctaLabel: "Check this date’s Panchang",
  };

  if (!data || ![data.tithi, data.nakshatra, data.rahu_kaal, data.sunrise, data.sunset].every(has)) {
    // No fabricated almanac. The page says what it offers instead of listing
    // values it does not have — an empty promise is worse than an honest one.
    return {
      ...base,
      noindex: true,
      title: routing.panchangRoute(date).title,
      description: `Panchang for ${readable} calculated for ${PANCHANG_CITY.city}: tithi, nakshatra, yoga, karana, sunrise, sunset, and Rahu Kaal. Open the live almanac for the current values.`,
      intro: `Panchang for ${readable}, calculated for ${PANCHANG_CITY.city}. Live values for tithi, nakshatra, yoga, karana, and Rahu Kaal are computed on the page itself.`,
      sections: [
        {
          title: "What this almanac covers",
          body: `The Panchang for ${readable} gives the five limbs — tithi (lunar day), nakshatra (lunar mansion), yoga (Sun–Moon combination), karana (half-tithi), and vara (weekday) — along with sunrise, sunset, Rahu Kaal, and Abhijit Muhurat.`,
        },
        {
          title: "Why the location matters",
          body: `These values are computed for ${PANCHANG_CITY.city}. Tithi transitions, Rahu Kaal, and all muhurat windows are derived from local sunrise, so they shift by city. A Panchang for Delhi does not apply precisely in Chennai or Kolkata.`,
        },
        {
          title: "Using it for timing",
          body: "Rahu Kaal runs about 90 minutes each day and is traditionally avoided for beginnings. Abhijit Muhurat, roughly 48 minutes around local solar noon, is the one auspicious window available on most days.",
        },
      ],
      facts: [
        { label: "Date", value: readable },
        { label: "Location", value: PANCHANG_CITY.city },
        {
          label: "Panchang limbs",
          value: "5 — tithi, nakshatra, yoga, karana, vara",
        },
      ],
      faq: [
        {
          question: `What is the Panchang for ${readable}?`,
          answer: `The Panchang for ${readable} covers tithi, nakshatra, yoga, karana, and vara for ${PANCHANG_CITY.city}, along with sunrise, sunset, and Rahu Kaal. Live values are calculated on the page.`,
        },
        {
          question: "Does Panchang differ by city?",
          answer:
            "Yes. Tithi transitions, Rahu Kaal, and muhurat windows all derive from local sunrise and sunset, so values computed for one city do not transfer precisely to another.",
        },
      ],
    };
  }

  const summaryParts = [];
  if (has(data.tithi)) summaryParts.push(`Tithi ${data.tithi}`);
  if (has(data.nakshatra)) summaryParts.push(`Nakshatra ${data.nakshatra}`);
  if (has(data.yoga)) summaryParts.push(`Yoga ${data.yoga}`);
  if (has(data.karana)) summaryParts.push(`Karana ${data.karana}`);
  if (has(data.rahu_kaal)) summaryParts.push(`Rahu Kaal ${data.rahu_kaal}`);
  const summary = summaryParts.join(", ");

  const facts = [
    { label: "Date", value: readable },
    { label: "Location", value: PANCHANG_CITY.city },
  ];
  if (has(data.tithi))
    facts.push({
      label: "Tithi",
      value: data.tithi,
      source: data.tithiEnd ? `until ${data.tithiEnd}` : undefined,
    });
  if (has(data.nakshatra))
    facts.push({
      label: "Nakshatra",
      value: data.nakshatra,
      source: data.nakshatraEnd ? `until ${data.nakshatraEnd}` : undefined,
    });
  if (has(data.yoga)) facts.push({ label: "Yoga", value: data.yoga });
  if (has(data.karana)) facts.push({ label: "Karana", value: data.karana });
  if (has(data.rahu_kaal))
    facts.push({
      label: "Rahu Kaal",
      value: data.rahu_kaal,
      source: "Avoided for new beginnings",
    });
  if (has(data.sunrise)) facts.push({ label: "Sunrise", value: data.sunrise });
  if (has(data.sunset)) facts.push({ label: "Sunset", value: data.sunset });
  if (has(data.moonSign))
    facts.push({ label: "Moon sign", value: data.moonSign });

  return {
    ...base,
    title: `Panchang for ${readable}: ${summaryParts.slice(0, 3).join(", ")}`,
    description: `Panchang for ${readable} in ${PANCHANG_CITY.city}. ${summary}.`,
    intro: `On ${readable} in ${PANCHANG_CITY.city}: ${summary}.`,
    sections: [
      {
        title: "The five limbs on this date",
        body: [
          has(data.tithi)
            ? `The tithi is ${data.tithi}${data.tithiEnd ? `, running until ${data.tithiEnd}` : ""}.`
            : "",
          has(data.nakshatra)
            ? `The Moon occupies ${data.nakshatra} Nakshatra${data.nakshatraEnd ? ` until ${data.nakshatraEnd}` : ""}.`
            : "",
          has(data.yoga) ? `The yoga is ${data.yoga}.` : "",
          has(data.karana) ? `The karana is ${data.karana}.` : "",
          has(data.day) ? `The vara, or weekday, is ${data.day}.` : "",
        ]
          .filter(Boolean)
          .join(" "),
      },
      {
        title: "Timing windows",
        body: [
          has(data.rahu_kaal)
            ? `Rahu Kaal falls between ${data.rahu_kaal} and is traditionally avoided for starting anything new.`
            : "Rahu Kaal runs about 90 minutes daily and is traditionally avoided for beginnings.",
          has(data.sunrise) && has(data.sunset)
            ? `Sunrise is at ${data.sunrise} and sunset at ${data.sunset}, which is what every other timing on this page is calculated from.`
            : "",
          "Abhijit Muhurat, roughly 48 minutes around local solar noon, is the auspicious window available on most days.",
        ]
          .filter(Boolean)
          .join(" "),
      },
      {
        title: "Why this is city-specific",
        body: `These values are computed for ${PANCHANG_CITY.city}. Because tithi transitions and every muhurat window derive from local sunrise, a Panchang for one city does not transfer precisely to another. Check the location before using these timings elsewhere.`,
      },
    ],
    facts,
    faq: [
      {
        question: `What is the tithi on ${readable}?`,
        answer: has(data.tithi)
          ? `The tithi is ${data.tithi}${data.tithiEnd ? `, running until ${data.tithiEnd}` : ""}, calculated for ${PANCHANG_CITY.city}.`
          : `Tithi for ${readable} is calculated live on the page for ${PANCHANG_CITY.city}.`,
      },
      {
        question: `What is the Rahu Kaal on ${readable}?`,
        answer: has(data.rahu_kaal)
          ? `Rahu Kaal on ${readable} is ${data.rahu_kaal} in ${PANCHANG_CITY.city}. It lasts about 90 minutes and is traditionally avoided for new beginnings.`
          : `Rahu Kaal lasts about 90 minutes and its timing depends on the weekday and local sunrise.`,
      },
      {
        question: `Which Nakshatra is the Moon in on ${readable}?`,
        answer: has(data.nakshatra)
          ? `The Moon is in ${data.nakshatra}${data.nakshatraEnd ? ` until ${data.nakshatraEnd}` : ""} on ${readable}.`
          : `The Moon crosses one Nakshatra per day; the exact one is calculated live on the page.`,
      },
      {
        question: "Does this Panchang apply to my city?",
        answer: `It is calculated for ${PANCHANG_CITY.city}. Tithi transitions, Rahu Kaal, and muhurat windows all derive from local sunrise, so values shift for other cities.`,
      },
    ],
  };
}

const panchangDatePages = futureDates.map(panchangDatePage);

// ── Muhurat category pages ───────────────────────────────────────────────────

const muhuratCategoryPages = [
  [
    "business",
    "Business Muhurat",
    "a shop opening, company registration, contract signing, or product launch",
    "10th and 11th",
    "business-muhurat",
  ],
  [
    "marriage",
    "Marriage Muhurat",
    "a wedding, engagement, or family ceremony",
    "7th",
    "marriage-muhurat",
  ],
  [
    "property",
    "Property Muhurat",
    "home buying, registration, renovation, or griha pravesh",
    "4th",
    "property-muhurat",
  ],
  [
    "travel",
    "Travel Muhurat",
    "a journey, relocation, or important departure",
    "3rd and 12th",
    "muhurat",
  ],
].map(([slug, label, useCase, houses, guide]) => ({
  path: `/muhurat/${slug}`,
  title: `${label}: Choosing an Auspicious Time`,
  description: `How ${label.toLowerCase()} is chosen for ${useCase} — Panchang filters, Rahu Kaal, Abhijit Muhurat, and the ${houses} house condition in your own chart.`,
  heading: label,
  schemaType: "Article",
  updated: SEO_CONTENT_REVIEWED,
  intro: `${label} is the practice of selecting an auspicious time for ${useCase}, using Panchang filters first and your own chart second.`,
  sections: [
    {
      title: "The Panchang filters",
      body: `Start with the five limbs: a favourable tithi and nakshatra, a weekday suited to the activity, and avoidance of Rahu Kaal — about 90 minutes daily, timed from local sunrise. Abhijit Muhurat, roughly 48 minutes around solar noon, is a reasonable default when no better window exists.`,
    },
    {
      title: "Your own chart",
      body: `Panchang describes the day; your chart describes whether the day suits you. For ${label.toLowerCase()}, the ${houses} house condition matters most, along with your running mahadasha and antardasha. A universally auspicious day during a difficult personal dasha is still a difficult day.`,
    },
    {
      title: "What Muhurat cannot do",
      body: `Timing is a filter applied to a decision already made on practical grounds. ${label} cannot substitute for due diligence, and any practitioner suggesting a date will overcome a fundamentally poor decision is overselling the technique.`,
    },
  ],
  facts: [
    {
      label: "Panchang limbs checked",
      value: "5 — tithi, nakshatra, yoga, karana, vara",
    },
    {
      label: "Rahu Kaal",
      value: "About 90 minutes daily, avoided for beginnings",
    },
    {
      label: "Abhijit Muhurat",
      value: "About 48 minutes around local solar noon",
    },
    { label: "Chart houses read", value: `${houses} house` },
  ],
  faq: [
    {
      question: `How is ${label.toLowerCase()} chosen?`,
      answer: `By filtering Panchang for a favourable tithi, nakshatra, and weekday while avoiding Rahu Kaal, then checking the ${houses} house condition and your running dasha in your own chart.`,
    },
    {
      question: `Do I need my birth chart for ${label.toLowerCase()}?`,
      answer: `For a general auspicious window, no — Panchang alone is enough. For timing matched to you specifically, yes: the ${houses} house and your current dasha determine whether a generally good day is good for you.`,
    },
    {
      question: "Should I avoid Rahu Kaal?",
      answer:
        "Traditional practice avoids it for beginnings. It costs nothing to avoid, runs about 90 minutes, and its timing shifts by weekday and by city since it derives from local sunrise.",
    },
  ],
  links: [
    { label: "Muhurat Finder", href: "/muhurat" },
    { label: "Today Panchang", href: "/panchang" },
    ...(guide === "muhurat" ? [] : [{ label: `${label} Guide`, href: `/${guide}` }]),
    { label: "Free Kundali", href: "/free-kundali" },
  ],
  cta: "/muhurat",
  ctaLabel: "Find your Muhurat",
}));

// ── Assemble ─────────────────────────────────────────────────────────────────

/** Content-model pages carry cluster links; give them nav and a CTA. */
const contentPages = SEO_CONTENT_PAGES.map((page) => ({
  ...page,
  faq: getSeoContentFaqs(page),
  links: [
    ...getSeoClusterPages(page.slug).map(related => ({ label: related.heading, href: related.path })),
    ...getRelatedSeoContentPages(page.slug, 4).map((related) => ({
      label: related.heading,
      href: related.path,
    })),
    { label: "Free Kundali", href: "/free-kundali" },
  ],
  cta: page.primaryCta.to,
  ctaLabel: page.primaryCta.label,
}));

const toolPages = publicSeo.PUBLIC_TOOL_PAGES.map(page => ({
  ...page, heading: page.title, intro: page.description, schemaType: "WebPage",
  links: defaultSeoLinks, cta: page.path, ctaLabel: "Open the tool",
  faq: [{ question: `What can I find on this page?`, answer: page.description }],
}));
// Guides merged into a tool page (see MERGED_SEO_GUIDES): their text renders
// on the tool page, and their own links to themselves are dropped.
for (const page of [...toolPages, ...muhuratCategoryPages]) {
  const guide = getMergedSeoGuide(page.path);
  if (!guide) continue;
  page.sections = [...(page.sections || []), ...guide.sections];
  page.faq = [...(page.faq || []), ...getSeoContentFaqs(guide)];
  page.links = (page.links || []).filter((link) => link.href !== guide.path);
}

const legalPages = [
  ["/refund-policy", "Refund Policy", legal.REFUND_SECTIONS],
  ["/disclaimer", "Astrology and Guidance Disclaimer", legal.DISCLAIMER_SECTIONS],
].map(([path, title, sections]) => ({
  path, title, heading: title, description: sections[0].content[0],
  intro: sections[0].content[0], schemaType: "WebPage",
  sections: sections.map(section => ({ title: section.title, body: section.content.join(" ") })),
  links: [...defaultSeoLinks, { label: "Support", href: "/support" }],
  cta: "/support", ctaLabel: "Contact support",
  faq: [{ question: "Where can I ask a question?", answer: "Contact AstroYou support with questions about this policy." }],
}));

const pages = [
  homePage,
  pricingPage,
  ...toolPages,
  ...legalPages,
  ...supportPages,
  ...contentPages,
  ...signIndexPages,
  ...signPages,
  ...panchangDatePages,
  ...muhuratCategoryPages,
];

// Link every public page through an HTML directory, including pages without JS navigation.
const directoryPages = pages.filter(page => !page.noindex);
const directory = {
  path: "/explore", title: "Explore Astrology Tools & Guides", heading: "Explore AstroYou",
  description: "Browse AstroYou’s birth chart tools, astrology guides, horoscopes and daily Panchang pages.",
  intro: "Find a tool, learn about your chart, or explore a date in the Panchang.", schemaType: "CollectionPage",
  sections: [{ title: "Tools and reference guides", body: "Browse the links below by topic. Personal tools may ask for your birth profile." }],
  faq: [{ question: "Where should I start?", answer: "Start with a free Kundali, or browse the Vedic astrology guide." }],
  links: directoryPages.map(page => ({ label: page.heading, href: page.path })),
  cta: "/free-kundali", ctaLabel: "Create your Kundali",
};
pages.push(directory);
for (const page of pages) {
  const meta = publicSeo.PUBLIC_PAGE_META.find(item => item.path === page.path);
  if (meta) { page.title = meta.title; page.description = meta.description; }
  page.title = page.path.startsWith("/panchang/") ? routing.panchangRoute(page.path.split("/")[2]).title : page.title;
  page.description = searchDescription(page.description);
  page.links = [...new Map([
    { label: "Home", href: "/" }, { label: "All tools and guides", href: "/explore" },
    ...(page.links || []),
  ].map(link => [link.href, link])).values()].filter(link => link.href !== page.path);
}

// ── Rendering ────────────────────────────────────────────────────────────────

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const S = {
  main: "min-height:100vh;background:#030308;color:#fff;font-family:'Plus Jakarta Sans',Inter,Arial,sans-serif;padding:64px 24px;",
  wrap: "max-width:860px;margin:0 auto;",
  eyebrow:
    "color:#e5b96a;text-transform:uppercase;letter-spacing:.18em;font-size:12px;margin:0;",
  h1: "font-size:clamp(30px,5vw,44px);line-height:1.12;margin:16px 0 18px;",
  lede: "font-size:18px;line-height:1.7;color:rgba(255,255,255,.74);margin:0 0 8px;",
  meta: "font-size:12px;color:rgba(255,255,255,.42);margin:0 0 32px;",
  card: "border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:20px;background:rgba(255,255,255,.04);",
  h2: "font-size:21px;margin:0 0 10px;line-height:1.3;",
  body: "margin:0;line-height:1.7;color:rgba(255,255,255,.68);",
  factRow:
    "display:flex;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.08);",
  table:
    "width:100%;border-collapse:collapse;font-size:14px;color:rgba(255,255,255,.75);",
  cell: "border:1px solid rgba(255,255,255,.12);padding:10px 12px;text-align:left;vertical-align:top;",
  pill: "color:#e5b96a;text-decoration:none;border:1px solid rgba(229,185,106,.28);border-radius:999px;padding:8px 13px;font-size:13px;",
  cta: "display:inline-block;background:#e5b96a;color:#030308;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:12px;",
};

const renderFacts = (facts) => {
  if (!facts?.length) return "";
  return `<section aria-labelledby="key-facts" style="margin:28px 0;">
            <h2 id="key-facts" style="${S.h2}">Key facts</h2>
            <dl style="margin:0;">
              ${facts
                .filter(Boolean)
                .map(
                  (fact) =>
                    `<div style="${S.factRow}"><dt style="color:rgba(255,255,255,.5);margin:0;">${escapeHtml(fact.label)}</dt><dd style="margin:0;text-align:right;font-weight:600;">${escapeHtml(fact.value)}${fact.source ? `<span style="display:block;font-weight:400;font-size:12px;color:rgba(255,255,255,.4);">${escapeHtml(fact.source)}</span>` : ""}</dd></div>`,
                )
                .join("")}
            </dl>
          </section>`;
};

const renderComparison = (comparison) => {
  if (!comparison) return "";
  return `<section aria-labelledby="comparison" style="margin:28px 0;">
            <h2 id="comparison" style="${S.h2}">${escapeHtml(comparison.caption)}</h2>
            <div style="overflow-x:auto;">
              <table style="${S.table}">
                <thead><tr><th style="${S.cell}"></th>${comparison.columns.map((c) => `<th style="${S.cell}">${escapeHtml(c)}</th>`).join("")}</tr></thead>
                <tbody>${comparison.rows
                  .map(
                    (row) =>
                      `<tr><th scope="row" style="${S.cell}">${escapeHtml(row.criterion)}</th>${row.values.map((v) => `<td style="${S.cell}">${escapeHtml(v)}</td>`).join("")}</tr>`,
                  )
                  .join("")}</tbody>
              </table>
            </div>
          </section>`;
};

const renderBody = (page) => `
    <div id="root">
      <main style="${S.main}">
        <article style="${S.wrap}">
          <p style="${S.eyebrow}">AstroYou</p>
          <h1 style="${S.h1}">${escapeHtml(page.heading)}</h1>
          <p style="${S.lede}">${escapeHtml(page.intro)}</p>
          <p style="${S.meta}">Reviewed ${escapeHtml(page.updated || SEO_CONTENT_REVIEWED)} by ${escapeHtml(SEO_AUTHOR.name)} — ${escapeHtml(SEO_AUTHOR.role)}</p>

          <div style="display:grid;gap:14px;">
            ${page.sections
              .map(
                (section) =>
                  `<section style="${S.card}"><h2 style="${S.h2}">${escapeHtml(section.title)}</h2><p style="${S.body}">${escapeHtml(section.body)}</p></section>`,
              )
              .join("")}
          </div>

          ${renderFacts(page.facts)}
          ${renderComparison(page.comparison)}

          <section aria-labelledby="faq" style="margin:32px 0;">
            <h2 id="faq" style="${S.h2}">Frequently asked questions</h2>
            <div style="display:grid;gap:12px;margin-top:14px;">
              ${(page.faq || [])
                .map(
                  (faq) =>
                    `<section style="${S.card}"><h3 style="font-size:16px;margin:0 0 8px;">${escapeHtml(faq.question)}</h3><p style="${S.body}">${escapeHtml(faq.answer)}</p></section>`,
                )
                .join("")}
            </div>
          </section>

          <nav aria-label="Related pages" style="margin:28px 0;display:flex;flex-wrap:wrap;gap:10px;">
            ${(page.links || defaultSeoLinks)
              .map(
                (link) =>
                  `<a href="${escapeHtml(link.href)}" style="${S.pill}">${escapeHtml(link.label)}</a>`,
              )
              .join("")}
          </nav>

          <p style="margin:8px 0 32px;"><a href="${escapeHtml(page.cta || "/free-kundali")}" style="${S.cta}">${escapeHtml(page.ctaLabel || "Open AstroYou")}</a></p>

          <footer style="border-top:1px solid rgba(255,255,255,.1);padding-top:20px;font-size:12px;line-height:1.7;color:rgba(255,255,255,.38);">
            <p style="margin:0 0 8px;">${escapeHtml(SEO_AUTHOR.statement)}</p>
            <p style="margin:0;">Astrological guidance is offered for reflection and self-awareness. It is not medical, legal, financial, or psychological advice.</p>
          </footer>
        </article>
      </main>
    </div>`;

/**
 * Replace a meta tag's content, or append the tag if it is absent.
 *
 * The whitespace tolerance matters: index.html is prettier-formatted, so most
 * meta tags are split across three lines. A single-line-only pattern silently
 * fails to match and falls through to the append branch, which leaves TWO tags
 * of the same name on the page — the generic one from the template first, the
 * page-specific one second. Crawlers read the first. That is how every
 * prerendered page shipped the same boilerplate description.
 */
const setMeta = (html, selector, value) => {
  const escaped = escapeHtml(value);
  const pattern = new RegExp(
    `<meta\\s+${selector}\\s+content="[^"]*"\\s*/?>`,
    "i",
  );
  if (pattern.test(html)) {
    return html.replace(pattern, `<meta ${selector} content="${escaped}" />`);
  }
  return html.replace(
    "</head>",
    `    <meta ${selector} content="${escaped}" />\n  </head>`,
  );
};

/**
 * Two tags with the same name is always a bug — the crawler picks one and it
 * is usually not the one we meant. Cheap to check, and it is exactly the
 * failure that went unnoticed here for as long as the prerenderer has existed.
 */
const assertNoDuplicateMeta = (html, pagePath) => {
  const counts = new Map();
  for (const match of html.matchAll(
    /<meta\s+(name|property)="([^"]+)"\s+content="/gi,
  )) {
    const key = `${match[1]}="${match[2]}"`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const duplicated = [...counts.entries()].filter(([, n]) => n > 1);
  if (duplicated.length) {
    throw new Error(
      `prerender: ${pagePath} has duplicate meta tags: ` +
        duplicated.map(([key, n]) => `${key} ×${n}`).join(", "),
    );
  }
};

const buildStructuredData = (page, canonical) => {
  const reviewed = page.updated || SEO_CONTENT_REVIEWED;
  const publisher = {
    "@type": "Organization",
    name: SEO_PUBLISHER.name,
    url: SEO_PUBLISHER.url,
    logo: { "@type": "ImageObject", url: SEO_PUBLISHER.logo },
  };

  const primary = {
    "@context": "https://schema.org",
    "@type": page.schemaType || "Article",
    headline: page.title,
    name: page.title,
    description: page.description,
    url: canonical,
    mainEntityOfPage: canonical,
    inLanguage: "en",
    datePublished: reviewed,
    dateModified: reviewed,
    author: {
      "@type": "Organization",
      name: SEO_AUTHOR.name,
      description: SEO_AUTHOR.role,
      url: SEO_PUBLISHER.url,
    },
    publisher,
    image: `${baseUrl}/og-image.png`,
    isAccessibleForFree: true,
  };

  const data = [primary];

  if (page.faq?.length) {
    data.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: page.faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    });
  }

  if (page.path !== "/") {
    data.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${baseUrl}/` },
        {
          "@type": "ListItem",
          position: 2,
          name: page.heading,
          item: canonical,
        },
      ],
    });
  }

  return data;
};

const injectPage = (template, page) => {
  const canonical =
    page.path === "/" ? `${baseUrl}/` : `${baseUrl}${page.path}`;
  const fullTitle = searchTitle(page.title);

  let html = template
    .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(fullTitle)}</title>`)
    .replace(
      /<link rel="canonical" href="[^"]*" \/>/,
      `<link rel="canonical" href="${canonical}" />`,
    )
    .replace(/<div id="root"><\/div>/, renderBody(page));

  html = setMeta(html, 'name="robots"', page.noindex ? "noindex, follow" : "index, follow");
  html = setMeta(html, 'name="description"', page.description);
  html = setMeta(html, 'name="title"', fullTitle);
  html = setMeta(html, 'property="og:title"', fullTitle);
  html = setMeta(html, 'property="og:description"', page.description);
  html = setMeta(html, 'property="og:url"', canonical);
  html = setMeta(html, 'property="og:image"', `${baseUrl}/og-image.png`);
  html = setMeta(
    html,
    'property="og:type"',
    page.path === "/" ? "website" : "article",
  );
  html = setMeta(html, 'name="twitter:title"', fullTitle);
  html = setMeta(html, 'name="twitter:description"', page.description);
  html = setMeta(html, 'name="twitter:url"', canonical);
  html = setMeta(html, 'name="twitter:image"', `${baseUrl}/og-image.png`);

  // The template ships a site-wide JSON-LD graph for the app shell. Prerendered
  // routes get page-specific schema instead; leaving both would put two
  // competing descriptions of the same URL on the page.
  html = html.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
    "",
  );
  html = html.replace(
    "</head>",
    `    <script id="astroyou-structured-data" data-page-url="${canonical}" type="application/ld+json">${JSON.stringify(buildStructuredData(page, canonical))}</script>\n  </head>`,
  );

  assertNoDuplicateMeta(html, page.path);
  return html;
};

const writeRoute = async (page, html) => {
  if (page.path === "/") {
    await writeFile(path.join(distDir, "index.html"), html, "utf8");
    return;
  }
  const routeDir = path.join(distDir, page.path.replace(/^\//, ""));
  await mkdir(routeDir, { recursive: true });
  await writeFile(path.join(routeDir, "index.html"), html, "utf8");
};

// ── Machine-readable files for AI agents ─────────────────────────────────────

const buildPricingMarkdown = () => `# Pricing — AstroYou

Last updated: ${today}
Currency: INR. All prices include applicable taxes unless stated otherwise.

## Subscription plans

${TIER_ORDER.map((id) => {
  const t = ENTITLEMENTS[id];
  return `### ${t.displayName}
- Price: ${t.monthlyPriceInr === 0 ? "₹0 (free, no card required)" : `₹${t.monthlyPriceInr}/month`}
${t.monthlyPriceInr === 0
  ? `- Credits: ${t.limits.monthlyCredits}, granted once at signup (not monthly)
- Jyotish chat: 1 credit per message`
  : `- Credits: ${t.limits.monthlyCredits} added each billing month (about ${perCredit(id)} per credit)
- Jyotish chat: unlimited, fair use up to ${PAID_CHAT_FAIR_USE_PER_DAY} messages a day`}
- Reports, forecasts and guide sessions: available, paid in credits`;
}).join("\n\n")}

## Credit packs (one-time purchase)

${CREDIT_PACKS.map((p) => `- ${p.label}: ₹${p.amountInRupees} (${formatCreditRate(p)}) — ${p.description}`).join("\n")}

## What credits are spent on

- Guide session: 5, 8, or 10 credits per minute depending on the guide; billed from the first message, partial minutes rounded up
- Jyotish chat: 1 credit per message without a subscription; unlimited (fair use) on Premium and Pro
- PDF reports: ${REPORT_CREDIT_COSTS}
- Weekly, monthly, and yearly forecasts, transit and compatibility readings: a few credits per view

Purchased credits remain in the wallet. Subscription credits are added at each successful monthly payment.

## Free without payment

- Janam Kundali generation
- Kundali matching (full 36-point Ashtakoot breakdown)
- Manglik dosha check
- Daily Panchang
- ${ENTITLEMENTS.free.limits.monthlyCredits} credits once at signup, no card required

Human-readable pricing: ${baseUrl}/pricing
`;

const buildLlmsTxt = (routes) => {
  const guides = SEO_CONTENT_PAGES.filter(
    (page) => !page.slug.includes("/"),
  ).slice(0, 40);
  return `# AstroYou

> Vedic astrology platform. Computes a sidereal Janam Kundali from date, exact
> time, and place of birth using the Lahiri (Chitrapaksha) ayanamsa, then
> interprets it with a Jyotish guide that remembers your chart, dasha timeline,
> and the key things you share with it.

Last updated: ${today}

## What it is

AstroYou generates the D-1 rashi chart, ascendant, all nine grahas, house cusps,
the Moon's Nakshatra and pada, the D-9 Navamsa, and the full 120-year Vimshottari
dasha sequence. Kundali generation, Kundali matching with the 36-point Ashtakoot
breakdown, Manglik checking, and daily Panchang are free.

## Who you are talking to

AstroYou's guides are not people, and every profile says so.
The policy is documented at ${baseUrl}/trust.

## Limits stated by the product

AstroYou does not predict death, guarantee outcomes, or sell fear-based remedies.
Medical, legal, and psychological questions are referred out. Remedy guidance
follows the classical order: behaviour and service before anything costly.

## Pricing

- Free tier: ${ENTITLEMENTS.free.limits.monthlyCredits} credits once at signup, no card required
- Premium: ₹${ENTITLEMENTS.premium.monthlyPriceInr}/month, ${ENTITLEMENTS.premium.limits.monthlyCredits} credits each month
- Pro: ₹${ENTITLEMENTS.pro.monthlyPriceInr}/month, ${ENTITLEMENTS.pro.limits.monthlyCredits} credits each month
- guide sessions: from 5 credits per minute
- Machine-readable: ${baseUrl}/pricing.md

## Key pages

- [Pricing](${baseUrl}/pricing): plans, credit packs, and consultation rates
- [Free Kundali](${baseUrl}/free-kundali): birth chart generation
- [Kundali Matching](${baseUrl}/free-kundali-matching): Ashtakoot Guna Milan
- [Panchang](${baseUrl}/panchang): daily almanac
- [Trust](${baseUrl}/trust): guide disclosure and review policy

## Reference guides

${guides.map((page) => `- [${page.heading}](${baseUrl}${page.path}): ${page.description}`).join("\n")}

## Comparisons

- [Astrology app vs human astrologer](${baseUrl}/astrology-app-vs-human-astrologer)
- [AstroTalk alternatives](${baseUrl}/astrotalk-alternatives)
- [AstroSage alternatives](${baseUrl}/astrosage-alternatives)
- [Best astrology app](${baseUrl}/best-astrology-app)
- [Free Kundali apps compared](${baseUrl}/free-kundali-apps-compared)

## Sitemap

${baseUrl}/sitemap.xml (${routes} URLs)
`;
};

const writeSitemap = async () => {
  const priorityFor = (p) => {
    if (p === "/") return "1.0";
    if (p === "/pricing" || p.startsWith("/free-")) return "0.9";
    if (p.startsWith("/privacy") || p.startsWith("/terms")) return "0.3";
    return "0.7";
  };
  const changefreqFor = (p) => {
    if (p.startsWith("/panchang") || p.includes("horoscope")) return "daily";
    if (p.startsWith("/privacy") || p.startsWith("/terms")) return "yearly";
    return "weekly";
  };

  const routes = Array.from(
    new Map(
      pages.filter(page => !page.noindex).map((page) => [
        page.path,
        {
          path: page.path,
          lastmod: page.updated || today,
          changefreq: changefreqFor(page.path),
          priority: priorityFor(page.path),
        },
      ]),
    ).values(),
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (route) => `  <url>
    <loc>${baseUrl}${route.path === "/" ? "/" : route.path}</loc>
    <lastmod>${route.lastmod}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;
  // Build output only: writing public/ dirtied tracked files on every build.
  await writeFile(path.join(distDir, "sitemap.xml"), xml, "utf8");
  return routes.length;
};

/**
 * Rewrite only the `Sitemap:` line of robots.txt to point at the deploy's
 * own baseUrl, leaving every other line (crawler allow/disallow rules)
 * untouched. Vite already copied public/robots.txt into dist/ during the
 * build, using whatever was committed there — so dist's copy is stale
 * against a non-default APP_BASE_URL until this overwrites it too.
 */
const writeRobots = async () => {
  const robotsPath = path.resolve("public/robots.txt");
  const raw = await readFile(robotsPath, "utf8");
  const updated = raw.replace(
    /^Sitemap:.*$/m,
    `Sitemap: ${baseUrl}/sitemap.xml`,
  );
  // Source stays untouched; only the deployed copy carries the deploy's URL.
  await writeFile(path.join(distDir, "robots.txt"), updated, "utf8");
};

// A catch-all `/panchang/:date` rule made junk like /panchang/foo a soft 404.
// Netlify rules cannot match a date pattern, so list real calendar dates in a
// bounded window instead; prerendered dates are static files and need no rule.
// Anything outside the window falls through to the 404 page.
const PANCHANG_SHELL_WINDOW_DAYS = 730;
const panchangShellRules = () => {
  const prerendered = new Set(futureDates);
  const rules = [];
  for (let offset = -PANCHANG_SHELL_WINDOW_DAYS; offset <= PANCHANG_SHELL_WINDOW_DAYS; offset++) {
    const day = new Date();
    day.setUTCDate(day.getUTCDate() + offset);
    const date = day.toISOString().slice(0, 10);
    if (!prerendered.has(date)) rules.push(`/panchang/${date} /app-shell.html 200`);
  }
  return rules.join("\n");
};

const buildHostingFiles = (template) => {
// Keep a separate empty app shell: private/dynamic routes must never inherit home content.
let shell = template.replace(/<script[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g, "")
  .replace(/<link rel="canonical"[^>]*>/g, "");
shell = setMeta(shell, 'name="robots"', "noindex, follow");
const notFound = shell.replace(/<title>.*?<\/title>/, "<title>Page Not Found | AstroYou</title>")
  .replace('<div id="root"></div>', '<div id="root"><main><h1>Page not found</h1><p>This page does not exist.</p><a href="/">Return home</a></main></div>');
  const redirects = PRIVATE_ROUTES.flatMap(route => [
    `${route} /app-shell.html 200`, `${route}/* /app-shell.html 200`,
  ]).join("\n") + "\n" +
    SEO_GUIDE_REDIRECTS.map(({ from, to }) => `${from} ${to} 301`).join("\n") + "\n" +
    panchangShellRules() + "\n";
  return { shell, notFound, redirects };
};

// ── Run ──────────────────────────────────────────────────────────────────────

const template = await readFile(path.join(distDir, "index.html"), "utf8");

// Fail the build loudly if the template is not the expected fresh Vite output.
// Without this guard, a missing/renamed root placeholder makes injectPage()'s
// .replace() a silent no-op and ships 600+ broken, empty SEO pages.
if (!template.includes('<div id="root"></div>')) {
  throw new Error(
    'prerender: dist/index.html is missing <div id="root"></div>. ' +
      "Was it already prerendered, or did the Vite build fail? Aborting to " +
      "avoid shipping broken SEO pages.",
  );
}

// Every page must actually carry content. A page that reaches the renderer
// with no sections or no FAQ is a data bug, and shipping it silently is how
// 41% of the sitemap ended up as empty promises last time.
for (const page of pages) {
  if (!page.sections?.length || !page.faq?.length || !page.description) {
    throw new Error(
      `prerender: ${page.path} is missing sections, FAQ, or description. Aborting.`,
    );
  }
}

const hosting = buildHostingFiles(template);
await Promise.all([
  writeFile(path.join(distDir, "app-shell.html"), hosting.shell),
  writeFile(path.join(distDir, "404.html"), hosting.notFound),
  writeFile(path.join(distDir, "_redirects"), hosting.redirects),
  ...pages.map(page => writeRoute(page, injectPage(template, page))),
]);

const routeCount = await writeSitemap();
await writeRobots();

await Promise.all([
  writeFile(path.join(distDir, "pricing.md"), buildPricingMarkdown(), "utf8"),
  writeFile(path.join(distDir, "llms.txt"), buildLlmsTxt(routeCount), "utf8"),
]);

// Stamp the service worker with this build's id so every deploy purges the
// previous precache/runtime caches on activate (see public/sw.js).
{
  const swPath = path.join(distDir, "sw.js");
  const buildId = (
    process.env.DEPLOY_ID ||
    process.env.COMMIT_REF ||
    Date.now().toString(36)
  )
    .replace(/[^A-Za-z0-9_-]/g, "")
    .slice(0, 24);
  try {
    const sw = await readFile(swPath, "utf8");
    const stamped = sw.replace(
      /^const SW_VERSION = "[^"]*";$/m,
      `const SW_VERSION = "${buildId}";`,
    );
    if (stamped === sw) {
      console.warn("prerender: SW_VERSION line not found in dist/sw.js");
    }
    await writeFile(swPath, stamped, "utf8");
  } catch (error) {
    console.warn(`prerender: could not stamp dist/sw.js (${error.code || error.name})`);
  }
}

console.log(
  `Prerendered ${pages.length} pages (${routeCount} sitemap URLs), ` +
    `plus pricing.md and llms.txt.`,
);
