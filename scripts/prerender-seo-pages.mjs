import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const distDir = path.resolve("dist");
const baseUrl = "https://astroyou.app";
const today = new Date().toISOString().slice(0, 10);

const signs = [
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
  "capricorn",
  "aquarius",
  "pisces",
];

const periods = ["daily", "weekly", "monthly", "yearly"];
const nakshatraSeeds = [
  ["ashwini", "Ashwini"],
  ["bharani", "Bharani"],
  ["krittika", "Krittika"],
  ["rohini", "Rohini"],
  ["mrigashira", "Mrigashira"],
  ["ardra", "Ardra"],
  ["punarvasu", "Punarvasu"],
  ["pushya", "Pushya"],
  ["ashlesha", "Ashlesha"],
  ["magha", "Magha"],
  ["purva-phalguni", "Purva Phalguni"],
  ["uttara-phalguni", "Uttara Phalguni"],
  ["hasta", "Hasta"],
  ["chitra", "Chitra"],
  ["swati", "Swati"],
  ["vishakha", "Vishakha"],
  ["anuradha", "Anuradha"],
  ["jyeshtha", "Jyeshtha"],
  ["mula", "Mula"],
  ["purva-ashadha", "Purva Ashadha"],
  ["uttara-ashadha", "Uttara Ashadha"],
  ["shravana", "Shravana"],
  ["dhanishta", "Dhanishta"],
  ["shatabhisha", "Shatabhisha"],
  ["purva-bhadrapada", "Purva Bhadrapada"],
  ["uttara-bhadrapada", "Uttara Bhadrapada"],
  ["revati", "Revati"],
];
const planetSeeds = [
  ["sun", "Sun"],
  ["moon", "Moon"],
  ["mars", "Mars"],
  ["mercury", "Mercury"],
  ["jupiter", "Jupiter"],
  ["venus", "Venus"],
  ["saturn", "Saturn"],
  ["rahu", "Rahu"],
  ["ketu", "Ketu"],
];
const houseSeeds = [
  ["first-house", "First House"],
  ["second-house", "Second House"],
  ["third-house", "Third House"],
  ["fourth-house", "Fourth House"],
  ["fifth-house", "Fifth House"],
  ["sixth-house", "Sixth House"],
  ["seventh-house", "Seventh House"],
  ["eighth-house", "Eighth House"],
  ["ninth-house", "Ninth House"],
  ["tenth-house", "Tenth House"],
  ["eleventh-house", "Eleventh House"],
  ["twelfth-house", "Twelfth House"],
];
const defaultSeoLinks = [
  { label: "Free Kundali", href: "/free-kundali" },
  { label: "Kundali Matching", href: "/free-kundali-matching" },
  { label: "Today Panchang", href: "/panchang" },
  { label: "Trust", href: "/trust" },
];

// Only PUBLIC, indexable routes belong in the sitemap. Authenticated app
// routes (/onboarding, /synthesis, /consult, /wallet, /reports, /remedies)
// redirect to login and have no indexable content — they are excluded here and
// disallowed in robots.txt.
const staticRoutes = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/pricing", changefreq: "weekly", priority: "0.8" },
  { path: "/support", changefreq: "weekly", priority: "0.6" },
  { path: "/help", changefreq: "weekly", priority: "0.6" },
  { path: "/trust", changefreq: "weekly", priority: "0.8" },
  { path: "/experts/apply", changefreq: "monthly", priority: "0.6" },
  { path: "/privacy", changefreq: "monthly", priority: "0.4" },
  { path: "/terms", changefreq: "monthly", priority: "0.4" },
  { path: "/astromap", changefreq: "monthly", priority: "0.5" },
  { path: "/wellness", changefreq: "monthly", priority: "0.5" },
  { path: "/human-design", changefreq: "monthly", priority: "0.5" },
  { path: "/advanced-vedic", changefreq: "monthly", priority: "0.5" },
];

const futureDates = Array.from({ length: 180 }, (_, index) => {
  const date = new Date(`${today}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + index);
  return date.toISOString().slice(0, 10);
});

const seoPages = [
  {
    path: "/free-kundali",
    title: "Free Kundali Online | Vedic Birth Chart Generator",
    description:
      "Generate your free Vedic Kundali birth chart instantly. Get Moon sign, Sun sign, Ascendant, and planetary positions with no signup required.",
    heading: "Free Kundali Online",
    bullets: [
      "Ascendant and Moon sign",
      "Planetary positions",
      "Free chart before signup",
    ],
    cta: "/free-kundali",
    schemaType: "SoftwareApplication",
    faq: [
      {
        question: "Is the free Kundali online report really free?",
        answer:
          "Yes. The free Kundali page can generate a basic Vedic birth chart before signup.",
      },
      {
        question: "What details are needed for a Janam Kundali?",
        answer:
          "Date of birth, time of birth, and place of birth give the most accurate chart.",
      },
    ],
    links: [
      { label: "Kundali Matching", href: "/free-kundali-matching" },
      { label: "Daily Horoscope", href: "/daily-horoscope" },
      { label: "Today Panchang", href: "/panchang" },
      { label: "Trust", href: "/trust" },
    ],
  },
  {
    path: "/free-kundali-matching",
    title: "Free Kundali Matching Online | Guna Milan Calculator",
    description:
      "Check Kundali matching and Guna Milan score for free. See compatibility score and Ashtakoot analysis with no signup required.",
    heading: "Free Kundali Matching",
    bullets: [
      "Compatibility score",
      "Ashtakoot Guna Milan",
      "Deeper AI analysis after saving",
    ],
    cta: "/free-kundali-matching",
  },
  {
    path: "/panchang",
    title: "Today Panchang | Tithi, Nakshatra, Rahu Kaal, Muhurat",
    description:
      "Check today's Panchang online for free. See tithi, nakshatra, yoga, karana, sunrise, sunset, Rahu Kaal, and auspicious timings.",
    heading: "Today Panchang",
    bullets: ["Tithi and Nakshatra", "Rahu Kaal", "Abhijit Muhurat"],
    cta: "/panchang",
  },
  {
    path: "/muhurat",
    title: "Free Muhurat Finder | Auspicious Timing from Panchang",
    description:
      "Find a free Muhurat guide for business, marriage, travel, and home activities using Panchang, Rahu Kaal, and Abhijit Muhurat.",
    heading: "Free Muhurat Finder",
    bullets: [
      "Purpose-based timing",
      "Panchang signals",
      "Personal Muhurat CTA",
    ],
    cta: "/muhurat",
  },
  {
    path: "/kundali",
    title: "Kundali Meaning, Birth Chart Houses, Planets, and Free Chart",
    description:
      "Learn what a Janam Kundali is, how Vedic birth charts use houses and planets, and generate a free Kundali online with AstroYou.",
    heading: "Kundali Guide",
    bullets: [
      "Janam Kundali basics",
      "Houses and planets",
      "Free Kundali generator",
    ],
    cta: "/free-kundali",
  },
  {
    path: "/kundali-matching",
    title: "Kundali Matching and Guna Milan | Free Compatibility Guide",
    description:
      "Understand Kundali matching, Ashtakoot Guna Milan, Mangal Dosha, and relationship compatibility before generating a free match report.",
    heading: "Kundali Matching Guide",
    bullets: [
      "36-point Guna Milan",
      "Mangal Dosha context",
      "Free matching tool",
    ],
    cta: "/free-kundali-matching",
  },
  {
    path: "/daily-horoscope",
    title: "Daily Horoscope by Zodiac Sign",
    description:
      "Read free daily, weekly, monthly, and yearly horoscope pages for all zodiac signs, then get personalized Vedic guidance from your own chart.",
    heading: "Daily Horoscope",
    bullets: [
      "12 zodiac signs",
      "Daily to yearly periods",
      "Personalized Vedic forecast",
    ],
    cta: "/horoscope/aries/daily",
    links: signs.slice(0, 6).map((sign) => ({
      label: `${sign.charAt(0).toUpperCase() + sign.slice(1)} Horoscope`,
      href: `/horoscope/${sign}`,
    })),
  },
  {
    path: "/trust",
    title: "AstroYou Trust, Reviews, Testimonials, and Transparency",
    description:
      "Learn how AstroYou handles AI astrologers, real reviews, testimonials, prediction feedback, and transparent trust claims.",
    heading: "Trust and Transparency",
    bullets: [
      "AI astrologers are labelled",
      "Reviews and testimonials require real user submission",
      "Prediction feedback is tracked in aggregate",
    ],
    cta: "/trust",
    schemaType: "AboutPage",
    links: [
      { label: "Help Center", href: "/help" },
      { label: "Apply as Expert", href: "/experts/apply" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    path: "/sade-sati",
    title: "Sade Sati Meaning, Phases, Effects, and Remedies",
    description:
      "Learn what Sade Sati means in Vedic astrology, how Saturn phases work, and how to approach remedies without fear.",
    heading: "Sade Sati Guide",
    bullets: ["Saturn phases", "Moon sign timing", "Fear-free remedies"],
    cta: "/free-kundali",
  },
  {
    path: "/manglik",
    title: "Manglik Dosha Meaning, Matching, and Remedies",
    description:
      "Understand Manglik Dosha, how Mars affects marriage matching, and why the full chart matters more than fear-based labels.",
    heading: "Manglik Dosha Guide",
    bullets: ["Mars placement", "Marriage matching", "Full chart context"],
    cta: "/free-kundali-matching",
  },
  {
    path: "/nakshatra",
    title: "Nakshatra Meaning | 27 Lunar Mansions in Vedic Astrology",
    description:
      "Learn how Nakshatras shape personality, emotional rhythm, compatibility, dashas, and daily timing in Vedic astrology.",
    heading: "Nakshatra Guide",
    bullets: ["Birth star meaning", "Moon-based rhythm", "Dasha connection"],
    cta: "/free-kundali",
  },
  {
    path: "/planet",
    title: "Planets in Vedic Astrology | Graha Meanings and Remedies",
    description:
      "Explore the nine Vedic astrology planets, their meanings, house results, sign behavior, dashas, and practical remedy approach.",
    heading: "Planets in Vedic Astrology",
    bullets: [
      "Nine Grahas",
      "House and sign results",
      "Dasha and remedy context",
    ],
    cta: "/free-kundali",
    links: planetSeeds.map(([slug, name]) => ({
      label: name,
      href: `/planet/${slug}`,
    })),
  },
  {
    path: "/planet-in-house",
    title: "Planets in Houses | Vedic Astrology Results by Graha and Bhava",
    description:
      "Explore planet-in-house meanings for Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, and Ketu across all twelve Vedic houses.",
    heading: "Planets in Houses",
    bullets: ["Nine planets", "Twelve houses", "Full Kundali context"],
    cta: "/free-kundali",
    schemaType: "CollectionPage",
    links: planetSeeds.map(([slug, name]) => ({
      label: `${name} in Houses`,
      href: `/planet-in-house/${slug}/first-house`,
    })),
  },
  {
    path: "/house",
    title: "Houses in Vedic Astrology | 12 Bhavas, Lords, and Results",
    description:
      "Explore the twelve Vedic astrology houses, their meanings, house lords, planets placed in houses, and dasha results.",
    heading: "Houses in Vedic Astrology",
    bullets: [
      "Twelve Bhavas",
      "House lord reading",
      "Personal Kundali context",
    ],
    cta: "/free-kundali",
    links: houseSeeds.map(([slug, name]) => ({
      label: name,
      href: `/house/${slug}`,
    })),
  },
  {
    path: "/dasha",
    title: "Dasha System | Vedic Astrology Timing Explained",
    description:
      "Understand Mahadasha, Antardasha, and how Vedic astrology uses planetary periods to time career, relationships, and inner growth.",
    heading: "Dasha Timing Guide",
    bullets: ["Mahadasha", "Antardasha", "Personal timing"],
    cta: "/free-kundali",
  },
  {
    path: "/moon-sign-calculator",
    title: "Moon Sign Calculator | Find Your Vedic Rashi",
    description:
      "Calculate your Vedic Moon sign or Janma Rashi from birth details and learn why it matters for dashas, compatibility, Panchang, and daily guidance.",
    heading: "Moon Sign Calculator",
    bullets: ["Janma Rashi", "Emotional rhythm", "Personal horoscope context"],
    cta: "/free-kundali",
    links: [
      { label: "Free Kundali", href: "/free-kundali" },
      { label: "Daily Horoscope", href: "/daily-horoscope" },
      { label: "Nakshatra Finder", href: "/nakshatra-finder" },
    ],
  },
  {
    path: "/nakshatra-finder",
    title: "Nakshatra Finder | Find Your Birth Star and Pada",
    description:
      "Find your Vedic birth Nakshatra and Pada from birth details, then understand personality, dasha timing, naming syllables, and Panchang context.",
    heading: "Nakshatra Finder",
    bullets: ["Birth star", "Nakshatra Pada", "Dasha connection"],
    cta: "/free-kundali",
    links: [
      { label: "Free Kundali", href: "/free-kundali" },
      { label: "Nakshatra Guide", href: "/nakshatra" },
      { label: "Panchang Today", href: "/panchang-today" },
    ],
  },
  {
    path: "/sade-sati-calculator",
    title: "Sade Sati Calculator | Check Saturn Transit from Moon Sign",
    description:
      "Check Sade Sati timing from your Moon sign and understand Saturn's three phases with practical, fear-free Vedic guidance.",
    heading: "Sade Sati Calculator",
    bullets: ["Moon sign check", "Three Saturn phases", "Fear-free remedies"],
    cta: "/free-kundali",
    links: [
      { label: "Sade Sati Guide", href: "/sade-sati" },
      { label: "Moon Sign Calculator", href: "/moon-sign-calculator" },
      { label: "Free Kundali", href: "/free-kundali" },
    ],
  },
  {
    path: "/manglik-dosha-checker",
    title: "Manglik Dosha Checker | Free Mangal Dosha Matching Guide",
    description:
      "Check Manglik Dosha with birth details and understand Mars placement, matching context, Navamsa, Venus, Jupiter, and relationship timing.",
    heading: "Manglik Dosha Checker",
    bullets: ["Mars placement", "Marriage matching", "Full chart context"],
    cta: "/free-kundali-matching",
    links: [
      { label: "Manglik Guide", href: "/manglik" },
      { label: "Free Kundali Matching", href: "/free-kundali-matching" },
      { label: "Love Compatibility", href: "/love-compatibility" },
    ],
  },
  {
    path: "/dasha-calculator",
    title: "Dasha Calculator | Find Mahadasha and Antardasha",
    description:
      "Calculate your current Mahadasha and Antardasha from your birth chart and understand Vedic planetary periods for life timing.",
    heading: "Dasha Calculator",
    bullets: ["Mahadasha", "Antardasha", "Vimshottari timing"],
    cta: "/free-kundali",
    links: [
      { label: "Dasha Guide", href: "/dasha" },
      { label: "Free Kundali", href: "/free-kundali" },
      { label: "Ask AI Jyotish", href: "/synthesis" },
    ],
  },
  {
    path: "/panchang-today",
    title: "Panchang Today | Tithi, Nakshatra, Rahu Kaal, Muhurat",
    description:
      "Check Panchang today for Tithi, Nakshatra, Yoga, Karana, Rahu Kaal, and auspicious timing with practical daily guidance.",
    heading: "Panchang Today",
    bullets: ["Tithi", "Nakshatra", "Rahu Kaal"],
    cta: "/panchang",
    links: [
      { label: "Today Panchang", href: "/panchang" },
      { label: "Free Muhurat", href: "/muhurat" },
      { label: "Free Kundali", href: "/free-kundali" },
    ],
  },
  {
    path: "/kaal-sarp-dosha",
    title: "Kaal Sarp Dosha Meaning, Effects, and Remedies",
    description:
      "Understand Kaal Sarp Dosha, Rahu and Ketu chart pressure, and why full-chart context matters before remedies.",
    heading: "Kaal Sarp Dosha",
    bullets: ["Rahu and Ketu", "Full chart context", "Fear-free remedies"],
    cta: "/free-kundali",
  },
  {
    path: "/love-compatibility",
    title: "Love Compatibility by Kundali, Moon Sign, and Timing",
    description:
      "Learn how Vedic astrology reads love compatibility through Moon sign, Venus, seventh house, dashas, and Guna Milan.",
    heading: "Love Compatibility",
    bullets: ["Moon sign rhythm", "Guna Milan context", "Relationship timing"],
    cta: "/free-kundali-matching",
  },
  {
    path: "/vedic-astrology",
    title: "Vedic Astrology | Kundali, Dashas, Panchang, Transits",
    description:
      "A practical guide to Vedic astrology concepts including Kundali, dashas, panchang, yogas, transits, doshas, and remedies.",
    heading: "Vedic Astrology",
    bullets: ["Kundali basics", "Dashas and timing", "Panchang and remedies"],
    cta: "/free-kundali",
  },
  {
    path: "/gemstone-remedies",
    title: "Gemstone and Vedic Remedies | Mantra, Donation, Ritual",
    description:
      "Understand Vedic remedies, gemstones, mantras, donation, fasting, and when to avoid fear-based prescriptions.",
    heading: "Gemstone Remedies",
    bullets: [
      "Mantra and service",
      "Gemstone caution",
      "Low-risk remedies first",
    ],
    cta: "/remedies",
  },
  {
    path: "/business-muhurat",
    title: "Business Muhurat | Auspicious Time to Start Work or Company",
    description:
      "Learn how business Muhurat uses Panchang, Rahu Kaal, tithi, nakshatra, and personal chart timing for shop openings and launches.",
    heading: "Business Muhurat",
    bullets: ["Shop opening", "Company launch", "Personal timing"],
    cta: "/muhurat",
  },
  {
    path: "/property-muhurat",
    title: "Property Muhurat | Auspicious Timing for Home or Land",
    description:
      "Understand property Muhurat for buying a home, land, registration, renovation, or griha pravesh using Panchang and chart context.",
    heading: "Property Muhurat",
    bullets: ["Home buying", "Registration timing", "Griha pravesh"],
    cta: "/muhurat",
  },
  {
    path: "/marriage-muhurat",
    title: "Marriage Muhurat | Auspicious Wedding Dates and Timing",
    description:
      "Learn how marriage Muhurat uses Panchang, Nakshatra, Tithi, family context, and both partners' Kundalis before choosing a wedding date.",
    heading: "Marriage Muhurat",
    bullets: ["Wedding dates", "Partner charts", "Panchang filters"],
    cta: "/free-kundali-matching",
  },
  {
    path: "/baby-name-astrology",
    title: "Baby Name Astrology | Nakshatra, Rashi, and Naming Letters",
    description:
      "Understand how baby names are chosen from Nakshatra, Moon sign, syllables, family tradition, and practical modern naming needs.",
    heading: "Baby Name Astrology",
    bullets: ["Nakshatra syllables", "Moon sign", "Meaningful names"],
    cta: "/free-kundali",
  },
  {
    path: "/lucky-mobile-number",
    title: "Lucky Mobile Number | Numerology Meaning and Practical Check",
    description:
      "Learn how mobile number numerology is interpreted, what it can and cannot tell you, and when to use birth chart context.",
    heading: "Lucky Mobile Number",
    bullets: ["Number vibration", "Practical caution", "Birth chart context"],
    cta: "/numerology",
  },
];

const signPages = signs.flatMap((sign) =>
  periods.map((period) => {
    const signName = sign.charAt(0).toUpperCase() + sign.slice(1);
    const periodName = period.charAt(0).toUpperCase() + period.slice(1);
    return {
      path: `/horoscope/${sign}/${period}`,
      title: `${signName} ${periodName} Horoscope`,
      description: `Read ${signName} ${periodName.toLowerCase()} horoscope for free, then get personalized Vedic guidance from your own birth chart.`,
      heading: `${signName} ${periodName} Horoscope`,
      bullets: [
        `${signName} ${periodName.toLowerCase()} prediction`,
        "Free sign forecast",
        "Personal chart CTA",
      ],
      cta: "/free-kundali",
      schemaType: "Article",
      links: [
        { label: `${signName} Daily`, href: `/horoscope/${sign}/daily` },
        { label: `${signName} Weekly`, href: `/horoscope/${sign}/weekly` },
        { label: `${signName} Monthly`, href: `/horoscope/${sign}/monthly` },
        { label: `${signName} Yearly`, href: `/horoscope/${sign}/yearly` },
        { label: "Free Kundali", href: "/free-kundali" },
      ],
    };
  }),
);

const signIndexPages = signs.map((sign) => {
  const signName = sign.charAt(0).toUpperCase() + sign.slice(1);
  return {
    path: `/horoscope/${sign}`,
    title: `${signName} Horoscope | Daily, Weekly, Monthly, Yearly`,
    description: `Read ${signName} horoscope pages for daily, weekly, monthly, and yearly guidance, then create a personal Vedic forecast.`,
    heading: `${signName} Horoscope`,
    bullets: [
      "Daily forecast",
      "Weekly and monthly outlook",
      "Personal birth-chart reading",
    ],
    cta: `/horoscope/${sign}/daily`,
    schemaType: "CollectionPage",
    links: periods.map((period) => ({
      label: `${period.charAt(0).toUpperCase() + period.slice(1)} Horoscope`,
      href: `/horoscope/${sign}/${period}`,
    })),
  };
});

const panchangDatePages = futureDates.map((date) => ({
  path: `/panchang/${date}`,
  title: `Panchang ${date} | Tithi, Nakshatra, Rahu Kaal`,
  description: `Check Panchang for ${date}: tithi, nakshatra, yoga, karana, Rahu Kaal, and auspicious timing guidance.`,
  heading: `Panchang ${date}`,
  bullets: ["Tithi and Nakshatra", "Rahu Kaal timing", "Muhurat planning"],
  cta: "/panchang",
  schemaType: "Article",
  links: [
    { label: "Today Panchang", href: "/panchang" },
    { label: "Muhurat Finder", href: "/muhurat" },
    { label: "Free Kundali", href: "/free-kundali" },
  ],
}));

const muhuratCategoryPages = [
  [
    "business",
    "Business Muhurat",
    "shop, startup, contract, or company registration",
  ],
  ["marriage", "Marriage Muhurat", "wedding, engagement, or family ceremony"],
  [
    "property",
    "Property Muhurat",
    "home buying, registration, renovation, or griha pravesh",
  ],
  ["travel", "Travel Muhurat", "journey, relocation, or important movement"],
].map(([slug, label, useCase]) => ({
  path: `/muhurat/${slug}`,
  title: `${label} | Auspicious Timing Finder`,
  description: `Find practical ${label.toLowerCase()} guidance for ${useCase} using Panchang and personal chart timing.`,
  heading: label,
  bullets: ["Panchang filters", "Rahu Kaal avoidance", "Personal chart CTA"],
  cta: "/muhurat",
  schemaType: "Article",
  links: [
    { label: "Today Panchang", href: "/panchang" },
    { label: "Business Muhurat", href: "/muhurat/business" },
    { label: "Marriage Muhurat", href: "/muhurat/marriage" },
    { label: "Property Muhurat", href: "/muhurat/property" },
  ],
}));

const nakshatraPages = nakshatraSeeds.map(([slug, name]) => ({
  path: `/nakshatra/${slug}`,
  title: `${name} Nakshatra Meaning, Traits, Compatibility, and Remedies`,
  description: `Understand ${name} Nakshatra in Vedic astrology: traits, personality patterns, compatibility themes, career direction, and remedies.`,
  heading: `${name} Nakshatra`,
  bullets: ["Birth star meaning", "Compatibility themes", "Kundali context"],
  cta: "/free-kundali",
  schemaType: "Article",
  links: [
    { label: "Nakshatra Guide", href: "/nakshatra" },
    { label: "Free Kundali", href: "/free-kundali" },
    { label: "Today Panchang", href: "/panchang" },
  ],
}));

const planetPages = planetSeeds.map(([slug, name]) => ({
  path: `/planet/${slug}`,
  title: `${name} in Vedic Astrology | Meaning, Houses, Signs, Remedies`,
  description: `Learn what ${name} represents in Vedic astrology, how it behaves by house and sign, and how to read it with dasha and remedies.`,
  heading: `${name} in Vedic Astrology`,
  bullets: ["Graha meaning", "House and sign context", "Dasha and remedies"],
  cta: "/free-kundali",
  schemaType: "Article",
  links: [
    { label: "Kundali Guide", href: "/kundali" },
    { label: "Vedic Astrology", href: "/vedic-astrology" },
    { label: "Remedies", href: "/gemstone-remedies" },
  ],
}));

const housePages = houseSeeds.map(([slug, name]) => ({
  path: `/house/${slug}`,
  title: `${name} in Vedic Astrology | Meaning, Planets, Lord, Results`,
  description: `Understand the ${name.toLowerCase()} in Vedic astrology, including its life areas, planets placed there, house lord, and dasha results.`,
  heading: `${name} in Vedic Astrology`,
  bullets: ["Bhava meaning", "House lord reading", "Personal Kundali context"],
  cta: "/free-kundali",
  schemaType: "Article",
  links: [
    { label: "Kundali Guide", href: "/kundali" },
    { label: "Free Kundali", href: "/free-kundali" },
    { label: "Ask AI Jyotish", href: "/synthesis" },
  ],
}));

const planetHousePages = planetSeeds.flatMap(([planetSlug, planetName]) =>
  houseSeeds.map(([houseSlug, houseName]) => ({
    path: `/planet-in-house/${planetSlug}/${houseSlug}`,
    title: `${planetName} in ${houseName} | Vedic Astrology Meaning and Results`,
    description: `Understand ${planetName} in ${houseName} in Vedic astrology, including life themes, strengths, cautions, and full-chart context.`,
    heading: `${planetName} in ${houseName}`,
    bullets: [
      `${planetName} meaning`,
      `${houseName} themes`,
      "Dasha and transit context",
    ],
    cta: "/free-kundali",
    schemaType: "Article",
    links: [
      { label: `${planetName} Guide`, href: `/planet/${planetSlug}` },
      { label: `${houseName} Guide`, href: `/house/${houseSlug}` },
      { label: "Planets in Houses", href: "/planet-in-house" },
      { label: "Free Kundali", href: "/free-kundali" },
    ],
  })),
);

const pages = [
  ...seoPages,
  ...signIndexPages,
  ...signPages,
  ...panchangDatePages,
  ...muhuratCategoryPages,
  ...nakshatraPages,
  ...planetPages,
  ...housePages,
  ...planetHousePages,
];

const escapeHtml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const getPageFaqs = (page) =>
  page.faq || [
    {
      question: `What is ${page.heading}?`,
      answer: page.description,
    },
    {
      question: `How should I use this AstroYou guide?`,
      answer:
        "Use this as a starting point for self-awareness and timing. For important decisions, combine it with your full Kundali, dasha period, transits, and practical life context.",
    },
    {
      question: `Can AstroYou personalize ${page.heading}?`,
      answer:
        "Yes. After you create a birth profile, AstroYou can combine this topic with your chart, Moon sign, Ascendant, dashas, transits, and saved guidance history.",
    },
  ];

const setMeta = (html, selector, value) => {
  const escaped = escapeHtml(value);
  const pattern = new RegExp(`(<meta ${selector} content=")[^"]*(")`);
  if (pattern.test(html)) return html.replace(pattern, `$1${escaped}$2`);
  return html.replace(
    "</head>",
    `    <meta ${selector} content="${escaped}" />\n  </head>`,
  );
};

const renderBody = (page) => `
    <div id="root">
      <main style="min-height:100vh;background:#030308;color:#fff;font-family:Arial,sans-serif;padding:64px 24px;">
        <section style="max-width:840px;margin:0 auto;">
          <p style="color:#e5b96a;text-transform:uppercase;letter-spacing:.18em;font-size:12px;">AstroYou</p>
          <h1 style="font-size:42px;line-height:1.1;margin:16px 0 20px;">${escapeHtml(page.heading)}</h1>
          <p style="font-size:18px;line-height:1.7;color:rgba(255,255,255,.72);max-width:720px;">${escapeHtml(page.description)}</p>
          <ul style="margin:28px 0;padding:0;display:grid;gap:12px;list-style:none;">
            ${page.bullets
              .map(
                (bullet) =>
                  `<li style="border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:16px;background:rgba(255,255,255,.04);">${escapeHtml(bullet)}</li>`,
              )
              .join("")}
          </ul>
          <nav aria-label="Related astrology pages" style="margin:28px 0;display:flex;flex-wrap:wrap;gap:10px;">
            ${(page.links || defaultSeoLinks)
              .map(
                (link) =>
                  `<a href="${link.href}" style="color:#e5b96a;text-decoration:none;border:1px solid rgba(229,185,106,.28);border-radius:999px;padding:8px 12px;font-size:13px;">${escapeHtml(link.label)}</a>`,
              )
              .join("")}
          </nav>
          <section aria-label="Common questions" style="margin:32px 0;display:grid;gap:12px;">
            ${getPageFaqs(page)
              .map(
                (faq) =>
                  `<article style="border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:16px;background:rgba(255,255,255,.035);"><h2 style="font-size:18px;margin:0 0 8px;">${escapeHtml(faq.question)}</h2><p style="margin:0;line-height:1.6;color:rgba(255,255,255,.64);">${escapeHtml(faq.answer)}</p></article>`,
              )
              .join("")}
          </section>
          <a href="${page.cta}" style="display:inline-block;background:#e5b96a;color:#030308;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:12px;">Open AstroYou</a>
        </section>
      </main>
    </div>`;

const injectPage = (template, page) => {
  const canonical = `${baseUrl}${page.path}`;
  const faqs = getPageFaqs(page);
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": page.schemaType || "WebPage",
      name: page.title,
      headline: page.title,
      description: page.description,
      url: canonical,
      publisher: {
        "@type": "Organization",
        name: "AstroYou",
      },
    },
  ];

  if (faqs.length) {
    structuredData.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    });
  }

  let html = template
    .replace(
      /<title>.*?<\/title>/,
      `<title>${escapeHtml(page.title)} | AstroYou</title>`,
    )
    .replace(
      /<link rel="canonical" href="[^"]*" \/>/,
      `<link rel="canonical" href="${canonical}" />`,
    )
    .replace(/<div id="root"><\/div>/, renderBody(page));

  html = setMeta(html, 'name="description"', page.description);
  html = setMeta(html, 'property="og:title"', `${page.title} | AstroYou`);
  html = setMeta(html, 'property="og:description"', page.description);
  html = setMeta(html, 'property="og:url"', canonical);
  html = setMeta(html, 'name="twitter:title"', `${page.title} | AstroYou`);
  html = setMeta(html, 'name="twitter:description"', page.description);
  html = html.replace(
    "</head>",
    `    <script type="application/ld+json">${JSON.stringify(structuredData)}</script>\n  </head>`,
  );
  return html;
};

const writeRoute = async (page, html) => {
  const routeDir = path.join(distDir, page.path.replace(/^\//, ""));
  await mkdir(routeDir, { recursive: true });
  await writeFile(path.join(routeDir, "index.html"), html, "utf8");
};

const writeSitemap = async () => {
  const pageRoutes = pages.map((page) => ({
    path: page.path,
    changefreq:
      page.path.includes("horoscope") || page.path.startsWith("/panchang")
        ? "daily"
        : "weekly",
    priority: page.path.includes("free") ? "0.9" : "0.8",
  }));
  const routes = Array.from(
    new Map(
      [...staticRoutes, ...pageRoutes].map((route) => [route.path, route]),
    ).values(),
  );
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (route) => `  <url>
    <loc>${baseUrl}${route.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;
  await Promise.all([
    writeFile(path.join(distDir, "sitemap.xml"), xml, "utf8"),
    writeFile(path.resolve("public/sitemap.xml"), xml, "utf8"),
  ]);
};

const template = await readFile(path.join(distDir, "index.html"), "utf8");

// Fail the build loudly if the template is not the expected fresh Vite output.
// Without this guard, a missing/renamed root placeholder makes injectPage()'s
// .replace() a silent no-op and ships 400+ broken, empty SEO pages.
if (!template.includes('<div id="root"></div>')) {
  throw new Error(
    'prerender: dist/index.html is missing <div id="root"></div>. ' +
      "Was it already prerendered, or did the Vite build fail? Aborting to " +
      "avoid shipping broken SEO pages.",
  );
}

await Promise.all(
  pages.map((page) => writeRoute(page, injectPage(template, page))),
);
await writeSitemap();
console.log(`Prerendered ${pages.length} SEO pages.`);
