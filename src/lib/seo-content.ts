export interface SeoContentPage {
  slug: string;
  path: string;
  title: string;
  description: string;
  heading: string;
  intro: string;
  sections: Array<{ title: string; body: string }>;
  primaryCta: { label: string; to: string };
  secondaryCta: { label: string; to: string };
  keywords: string[];
  /**
   * Checkable numbers rendered as a key-value block. AI answer engines cite
   * pages with concrete figures far more often than pages of pure assertion,
   * so every page carries at least three verifiable classical values.
   */
  facts?: SeoContentFact[];
  /** Page-specific Q&A. Falls back to a topic-derived set when absent. */
  faq?: SeoContentFaq[];
  /** schema.org @type for the primary entity. Defaults to "Article". */
  schemaType?: string;
  /** ISO date of the last editorial review of this page's prose. */
  updated?: string;
  /** Rendered as a comparison table when present. */
  comparison?: SeoContentComparison;
}

export interface SeoContentFact {
  label: string;
  value: string;
  /** Where the number comes from, when it is not self-evident. */
  source?: string;
}

export interface SeoContentFaq {
  question: string;
  answer: string;
}

export interface SeoContentComparison {
  caption: string;
  columns: string[];
  rows: Array<{ criterion: string; values: string[] }>;
}

type SeoCluster =
  "nakshatra" | "planet" | "house" | "planetHouse" | "comparison";

/**
 * Editorial review date for the evergreen guides. Bump when the prose is
 * actually revised — it is emitted as schema.org `dateModified` and as a
 * visible "Reviewed" line, so a build-stamped date here would be a lie.
 */
export const SEO_CONTENT_REVIEWED = "2026-08-17";

/**
 * Authorship is attributed to the editorial desk as an Organization rather
 * than to an invented byline. If a credentialed Jyotish reviewer is added
 * later, promote this to a Person with `knowsAbout` and `sameAs`.
 */
export const SEO_AUTHOR = {
  name: "AstroYou Editorial",
  role: "Vedic astrology reference desk",
  statement:
    "Written by the AstroYou editorial desk against classical Jyotish sources — Brihat Parashara Hora Shastra for house and dasha rules, Surya Siddhanta-derived sidereal calculation, and the Lahiri ayanamsa used by the Indian government's Rashtriya Panchang. Planetary positions on AstroYou are computed, not hand-written.",
};

export const SEO_PUBLISHER = {
  name: "AstroYou",
  url: "https://astroyou.app",
  logo: "https://astroyou.app/icon-512.png",
  sameAs: ["https://astroyou.app/trust", "https://astroyou.app/help"],
};

/** Vimshottari mahadasha lengths in years. Total = 120. */
export const VIMSHOTTARI_YEARS: Record<string, number> = {
  Sun: 6,
  Moon: 10,
  Mars: 7,
  Rahu: 18,
  Jupiter: 16,
  Saturn: 19,
  Mercury: 17,
  Ketu: 7,
  Venus: 20,
};

const CORE_SEO_CONTENT_PAGES: SeoContentPage[] = [
  {
    slug: "kundali",
    path: "/kundali",
    title: "Kundali: Meaning, Birth Chart Houses, Planets, and Free Chart",
    description:
      "Learn what a Janam Kundali is, how Vedic birth charts use houses and planets, and generate a free Kundali online with AstroYou.",
    heading: "Kundali Guide",
    intro:
      "A Kundali is a Vedic map of your birth moment. It shows the Ascendant, Moon sign, planets, houses, dashas, yogas, and life themes that shape your timing and choices.",
    sections: [
      {
        title: "What a Kundali shows",
        body: "A birth chart combines the place, date, and time of birth to place planets across twelve houses. Each house describes an area of life like identity, family, work, relationships, learning, or spiritual growth.",
      },
      {
        title: "Why Moon sign and Ascendant matter",
        body: "The Moon sign describes inner rhythm and emotional needs. The Ascendant shows how life opens through the body, temperament, and first response to the world.",
      },
      {
        title: "How AstroYou uses it",
        body: "AstroYou turns the chart into a living companion by combining Kundali, dasha, panchang, transits, and personal memory for guidance that stays practical.",
      },
    ],
    primaryCta: { label: "Generate Free Kundali", to: "/free-kundali" },
    secondaryCta: { label: "Ask AI Jyotish", to: "/synthesis" },
    keywords: ["kundali", "janam kundali", "birth chart", "vedic astrology"],
  },
  {
    slug: "kundali-matching",
    path: "/kundali-matching",
    title: "Kundali Matching and Guna Milan: Free Compatibility Guide",
    description:
      "Understand Kundali matching, Ashtakoot Guna Milan, Mangal Dosha, and relationship compatibility before generating a free match report.",
    heading: "Kundali Matching",
    intro:
      "Kundali matching compares two charts to understand compatibility, emotional rhythm, family life, attraction, longevity, and shared growth.",
    sections: [
      {
        title: "What Guna Milan means",
        body: "Ashtakoot matching scores eight compatibility areas out of 36 points. The score is useful, but it should be read with chart context and relationship maturity.",
      },
      {
        title: "Beyond the score",
        body: "Real compatibility also needs Mangal Dosha, Venus, Jupiter, seventh-house strength, dasha timing, and communication patterns. A lower score can still be workable when both charts show maturity and repair capacity.",
      },
      {
        title: "Use it with care",
        body: "AstroYou presents compatibility as guidance, not fear. The goal is clarity, better conversation, and practical next steps.",
      },
    ],
    primaryCta: { label: "Check Free Match", to: "/free-kundali-matching" },
    secondaryCta: {
      label: "Consult Relationship Guide",
      to: "/consult/meera-devi/profile",
    },
    keywords: ["kundali matching", "guna milan", "compatibility", "manglik"],
  },
  {
    slug: "daily-horoscope",
    path: "/daily-horoscope",
    title: "Daily Horoscope by Zodiac Sign",
    description:
      "Read free daily, weekly, monthly, and yearly horoscope pages for all zodiac signs, then get personalized Vedic guidance from your own chart.",
    heading: "Daily Horoscope",
    intro:
      "Sign horoscopes are a simple way to understand the mood of the day. For deeper accuracy, combine the sign forecast with your birth chart, dasha, and current transits.",
    sections: [
      {
        title: "Start with your sign",
        body: "Choose Aries, Taurus, Gemini, Cancer, Leo, Virgo, Libra, Scorpio, Sagittarius, Capricorn, Aquarius, or Pisces for a quick reading.",
      },
      {
        title: "Personalized is stronger",
        body: "A general sign horoscope cannot see your Ascendant, Moon sign, dasha, or natal house placements. AstroYou adds that layer after you save your profile.",
      },
      {
        title: "Use it daily",
        body: "The best horoscope is not dramatic. It should help you plan the day, avoid reactive choices, and return to one useful action.",
      },
    ],
    primaryCta: { label: "Read Aries Horoscope", to: "/horoscope/aries/daily" },
    secondaryCta: { label: "Create Personal Forecast", to: "/free-kundali" },
    keywords: ["daily horoscope", "weekly horoscope", "zodiac signs"],
  },
  {
    slug: "sade-sati",
    path: "/sade-sati",
    title: "Sade Sati Meaning, Phases, Effects, and Remedies",
    description:
      "Learn what Sade Sati means in Vedic astrology, how Saturn phases work, and how to approach remedies without fear.",
    heading: "Sade Sati",
    intro:
      "Sade Sati is the Saturn transit around the natal Moon. It is often described with fear, but its deeper purpose is maturity, discipline, responsibility, and emotional strength.",
    sections: [
      {
        title: "The three phases",
        body: "Sade Sati begins when Saturn enters the sign before your Moon sign, continues over the Moon sign, and ends after Saturn leaves the next sign.",
      },
      {
        title: "What it asks from you",
        body: "Saturn highlights delayed responsibilities, boundaries, patience, work ethic, and emotional realism. It does not guarantee disaster.",
      },
      {
        title: "Better remedies",
        body: "The best remedy starts with steadiness: service, discipline, honest commitments, simple prayer, and practical decisions. Saturn responds better to consistency than panic, so small repeatable actions matter more than dramatic fear-based rituals.",
      },
    ],
    primaryCta: { label: "Generate My Kundali", to: "/free-kundali" },
    secondaryCta: {
      label: "Ask Saturn Guide",
      to: "/consult/pandit-raghunath/profile",
    },
    keywords: ["sade sati", "saturn transit", "shani", "vedic astrology"],
  },
  {
    slug: "manglik",
    path: "/manglik",
    title: "Manglik Dosha Meaning, Matching, and Remedies",
    description:
      "Understand Manglik Dosha, how Mars affects marriage matching, and why the full chart matters more than fear-based labels.",
    heading: "Manglik Dosha",
    intro:
      "Manglik Dosha is linked to Mars placement in certain houses. It needs careful chart reading, not panic or blanket rejection.",
    sections: [
      {
        title: "What Mars represents",
        body: "Mars shows drive, heat, assertion, courage, conflict style, and physical energy. In relationships, it can create passion or impatience depending on maturity and chart support.",
      },
      {
        title: "Matching needs context",
        body: "A Manglik label should be checked with house strength, Venus, Jupiter, seventh lord, navamsa, and dasha timing.",
      },
      {
        title: "No fear-based decisions",
        body: "AstroYou treats Manglik analysis as practical relationship guidance, not a fixed verdict on marriage. The useful question is how two people handle heat, conflict, desire, and repair in real life.",
      },
    ],
    primaryCta: { label: "Check Free Match", to: "/free-kundali-matching" },
    secondaryCta: {
      label: "Talk To Matching Guide",
      to: "/consult/meera-devi/profile",
    },
    keywords: ["manglik", "mangal dosha", "kundali matching"],
  },
  {
    slug: "nakshatra",
    path: "/nakshatra",
    title: "Nakshatra Meaning: 27 Lunar Mansions in Vedic Astrology",
    description:
      "Learn how Nakshatras shape personality, emotional rhythm, compatibility, dashas, and daily timing in Vedic astrology.",
    heading: "Nakshatra Guide",
    intro:
      "Nakshatras are the 27 lunar mansions of Vedic astrology. They add emotional texture and timing detail beyond zodiac signs.",
    sections: [
      {
        title: "Why Nakshatra matters",
        body: "The Moon's Nakshatra describes instincts, needs, habits, memory, and how the mind seeks safety. It often explains the emotional texture behind a person's choices better than broad sign descriptions alone.",
      },
      {
        title: "Nakshatra and dasha",
        body: "Vimshottari dasha timing begins from the birth Nakshatra, making it central to life-period predictions.",
      },
      {
        title: "Daily use",
        body: "Today's Nakshatra helps choose the right tone for learning, rest, repair, devotion, communication, or starting a task.",
      },
    ],
    primaryCta: { label: "Find My Nakshatra", to: "/free-kundali" },
    secondaryCta: { label: "View Today Panchang", to: "/panchang" },
    keywords: ["nakshatra", "birth star", "vedic astrology"],
  },
  {
    slug: "planet",
    path: "/planet",
    title:
      "Planets in Vedic Astrology: Graha Meanings, Houses, Signs, and Remedies",
    description:
      "Explore the nine Vedic astrology planets, their meanings, house results, sign behavior, dashas, and practical remedy approach.",
    heading: "Planets in Vedic Astrology",
    intro:
      "The nine Grahas describe active forces in a Kundali. Their results change by house, sign, dignity, aspect, conjunction, dasha, and personal context.",
    sections: [
      {
        title: "What Grahas represent",
        body: "Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, and Ketu each describe a different kind of life force, timing pressure, and karmic pattern.",
      },
      {
        title: "Why house and sign matter",
        body: "A planet never acts in isolation. Its result depends on where it sits, what it owns, who aspects it, and which planetary period is active.",
      },
      {
        title: "How to use this guide",
        body: "Start with the planet meaning, then generate your Kundali so AstroYou can read the Graha through your actual chart and current dasha.",
      },
    ],
    primaryCta: { label: "Generate Free Kundali", to: "/free-kundali" },
    secondaryCta: { label: "Ask AI Jyotish", to: "/synthesis" },
    keywords: ["planet", "graha", "vedic astrology", "kundali"],
  },
  {
    slug: "planet-in-house",
    path: "/planet-in-house",
    title: "Planets in Houses: Vedic Astrology Results by Graha and Bhava",
    description:
      "Explore planet-in-house meanings for Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, and Ketu across all twelve Vedic houses.",
    heading: "Planets in Houses",
    intro:
      "A planet's house placement shows where its energy becomes active in daily life. These guides explain each Graha through the Bhava it occupies, then point you back to the full Kundali for context.",
    sections: [
      {
        title: "Why house placement matters",
        body: "The same planet can behave very differently in the first house, seventh house, tenth house, or twelfth house. The house shows the life area where the planet must express itself.",
      },
      {
        title: "Never read one factor alone",
        body: "Planet-in-house meaning should be checked with sign dignity, aspects, conjunctions, house lord, divisional charts, and the active dasha before making a strong prediction.",
      },
      {
        title: "How AstroYou personalizes it",
        body: "AstroYou uses these meanings as a base layer, then combines them with your actual birth chart, dashas, transits, and saved life context.",
      },
    ],
    primaryCta: { label: "Generate Free Kundali", to: "/free-kundali" },
    secondaryCta: { label: "Read Planet Guide", to: "/planet" },
    keywords: [
      "planet in house",
      "graha in bhava",
      "vedic astrology",
      "kundali",
    ],
  },
  {
    slug: "house",
    path: "/house",
    title: "Houses in Vedic Astrology: 12 Bhavas, Lords, Planets, and Results",
    description:
      "Explore the twelve Vedic astrology houses, their meanings, house lords, planets placed in houses, and dasha results.",
    heading: "Houses in Vedic Astrology",
    intro:
      "The twelve houses, or Bhavas, show the life areas activated by planets, house lords, dashas, and transits in a Kundali.",
    sections: [
      {
        title: "What houses show",
        body: "Each house describes a field of experience: self, family, effort, home, children, health, marriage, transformation, dharma, career, gains, and release.",
      },
      {
        title: "House lord is important",
        body: "The planet ruling a house carries that house into another part of life. This is why house lord placement is central in Jyotish interpretation.",
      },
      {
        title: "Read with the whole chart",
        body: "A house result should be read with planets placed there, aspects, dignity, divisional charts, dasha timing, and practical life context.",
      },
    ],
    primaryCta: { label: "Generate Free Kundali", to: "/free-kundali" },
    secondaryCta: { label: "Read Kundali Guide", to: "/kundali" },
    keywords: ["house", "bhava", "kundali", "vedic astrology"],
  },
  {
    slug: "dasha",
    path: "/dasha",
    title: "Dasha System: Vedic Astrology Timing Explained",
    description:
      "Understand Mahadasha, Antardasha, and how Vedic astrology uses planetary periods to time career, relationships, and inner growth.",
    heading: "Dasha Timing",
    intro:
      "Dasha is the timing engine of Vedic astrology. It explains why the same chart can feel different across different life periods.",
    sections: [
      {
        title: "Mahadasha and Antardasha",
        body: "Mahadasha is the larger planetary chapter. Antardasha is the sub-period inside it. Together they describe the active themes of the moment.",
      },
      {
        title: "Why timing matters",
        body: "Dasha helps separate permanent chart tendencies from temporary seasons, making guidance more specific and less generic.",
      },
      {
        title: "AstroYou's approach",
        body: "The app combines dasha with transits, panchang, and Atman memory so guidance is tied to the user's actual phase of life. This helps separate temporary pressure from deeper long-term tendencies.",
      },
    ],
    primaryCta: { label: "Calculate My Dasha", to: "/free-kundali" },
    secondaryCta: {
      label: "Ask Career Guide",
      to: "/consult/arjun-sharma/profile",
    },
    keywords: ["dasha", "mahadasha", "antardasha", "vimshottari"],
  },
  {
    slug: "moon-sign-calculator",
    path: "/moon-sign-calculator",
    title: "Moon Sign Calculator: Find Your Vedic Rashi from Birth Details",
    description:
      "Use AstroYou's free Moon sign calculator guide to understand your Vedic Rashi, emotional rhythm, Nakshatra link, and why Moon sign matters more than sun sign in Jyotish.",
    heading: "Moon Sign Calculator",
    intro:
      "Your Moon sign, or Rashi, describes the mind, emotional rhythm, instincts, memory, and daily inner weather. In Vedic astrology it is central for dashas, compatibility, Panchang timing, and personal guidance.",
    sections: [
      {
        title: "What the calculator needs",
        body: "A reliable Moon sign calculation needs date of birth, time of birth, and place of birth. The Moon changes signs roughly every two and a half days, so birth time and location can matter when the Moon is near a sign boundary.",
      },
      {
        title: "Why Moon sign is useful",
        body: "Moon sign is used for daily horoscope timing, emotional compatibility, Sade Sati, and the starting point of Vimshottari dasha. It often explains how a person feels life before they can explain it logically.",
      },
      {
        title: "How AstroYou personalizes it",
        body: "After calculating your chart, AstroYou combines Moon sign with Ascendant, Nakshatra, dashas, transits, and remembered life context so the guidance is not just a generic sign paragraph.",
      },
    ],
    primaryCta: { label: "Calculate Moon Sign", to: "/free-kundali" },
    secondaryCta: { label: "Read Daily Horoscope", to: "/daily-horoscope" },
    keywords: [
      "moon sign calculator",
      "rashi calculator",
      "vedic moon sign",
      "janma rashi",
    ],
  },
  {
    slug: "nakshatra-finder",
    path: "/nakshatra-finder",
    title: "Nakshatra Finder: Find Your Birth Star and Pada",
    description:
      "Find your Vedic birth Nakshatra and learn how your lunar mansion shapes personality, dasha timing, compatibility, naming syllables, and daily Panchang guidance.",
    heading: "Nakshatra Finder",
    intro:
      "A Nakshatra finder identifies the lunar mansion occupied by the Moon at birth. This birth star adds detail to personality, instincts, timing, compatibility, and spiritual practice.",
    sections: [
      {
        title: "What Nakshatra tells you",
        body: "Nakshatra describes the Moon's finer placement beyond the zodiac sign. It can show emotional style, motivation, natural gifts, repeated reactions, and the kind of environment where the mind feels safe.",
      },
      {
        title: "Why Pada matters",
        body: "Each Nakshatra has four padas, or quarters, which refine the reading further. Pada can influence naming syllables, navamsa connection, and the way a Nakshatra expresses itself in daily life.",
      },
      {
        title: "Use it with your full chart",
        body: "A birth star is powerful, but it should be read with Moon sign, Ascendant, planetary strength, dasha, and transits. AstroYou calculates the full Kundali first so Nakshatra guidance stays grounded.",
      },
    ],
    primaryCta: { label: "Find My Nakshatra", to: "/free-kundali" },
    secondaryCta: { label: "Read Nakshatra Guide", to: "/nakshatra" },
    keywords: [
      "nakshatra finder",
      "birth star calculator",
      "nakshatra calculator",
      "pada",
    ],
  },
  {
    slug: "sade-sati-calculator",
    path: "/sade-sati-calculator",
    title: "Sade Sati Calculator: Check Saturn Transit from Your Moon Sign",
    description:
      "Check whether Sade Sati is active by calculating your Moon sign and Saturn transit phase, then understand the period with practical, fear-free Vedic guidance.",
    heading: "Sade Sati Calculator",
    intro:
      "A Sade Sati calculator checks Saturn's transit around your natal Moon sign. The result is useful only when read with maturity, because Saturn shows responsibility and refinement, not automatic disaster.",
    sections: [
      {
        title: "How Sade Sati is checked",
        body: "Sade Sati begins when Saturn enters the sign before your natal Moon, continues while Saturn crosses the Moon sign, and ends after Saturn leaves the next sign. This creates three broad phases across about seven and a half years.",
      },
      {
        title: "What the result means",
        body: "The phase can highlight pressure, discipline, emotional realism, duty, boundaries, and delayed responsibilities. Its actual effect depends on Saturn strength, dasha, house placement, and the person's life stage.",
      },
      {
        title: "How to use AstroYou",
        body: "Generate your Kundali first so AstroYou can calculate Moon sign and read Saturn timing with your dasha, current transits, and remembered life themes instead of giving a generic fear-based answer.",
      },
    ],
    primaryCta: { label: "Check Sade Sati", to: "/free-kundali" },
    secondaryCta: { label: "Read Sade Sati Guide", to: "/sade-sati" },
    keywords: [
      "sade sati calculator",
      "shani sade sati",
      "saturn transit",
      "moon sign",
    ],
  },
  {
    slug: "manglik-dosha-checker",
    path: "/manglik-dosha-checker",
    title: "Manglik Dosha Checker: Free Mangal Dosha and Matching Guide",
    description:
      "Check Manglik Dosha with birth details and learn why Mars placement, seventh house strength, Navamsa, Venus, Jupiter, and dasha context matter before marriage decisions.",
    heading: "Manglik Dosha Checker",
    intro:
      "A Manglik Dosha checker looks at Mars placement in relationship-sensitive houses. The result should guide better understanding, not create panic or a fixed verdict about marriage.",
    sections: [
      {
        title: "What is checked",
        body: "Most checks review Mars in houses such as the first, fourth, seventh, eighth, or twelfth from key reference points. A serious reading also considers chart strength, aspects, Venus, Jupiter, and Navamsa.",
      },
      {
        title: "Why matching context matters",
        body: "Manglik results are more useful when compared across both charts. Similar Mars intensity, maturity, communication habits, and dasha timing can change how the dosha is experienced in real life.",
      },
      {
        title: "AstroYou's approach",
        body: "AstroYou combines free matching with practical relationship guidance. The goal is to understand friction and repair patterns, not reduce a person to a single Mars label.",
      },
    ],
    primaryCta: { label: "Check Manglik Dosha", to: "/free-kundali-matching" },
    secondaryCta: { label: "Read Manglik Guide", to: "/manglik" },
    keywords: [
      "manglik dosha checker",
      "mangal dosha calculator",
      "manglik matching",
      "kundali matching",
    ],
  },
  {
    slug: "dasha-calculator",
    path: "/dasha-calculator",
    title: "Dasha Calculator: Find Your Mahadasha and Antardasha",
    description:
      "Calculate your current Mahadasha and Antardasha from your birth chart and learn how Vedic planetary periods shape career, relationships, health, and spiritual timing.",
    heading: "Dasha Calculator",
    intro:
      "A Dasha calculator identifies the active planetary period in your life. In Jyotish, this timing layer often explains why one chapter feels focused on work, another on relationships, and another on inner growth.",
    sections: [
      {
        title: "What the calculator needs",
        body: "Vimshottari dasha begins from the Moon's Nakshatra at birth, so accurate birth date, time, and place are important. The Mahadasha gives the larger chapter, while Antardasha shows the active sub-theme.",
      },
      {
        title: "How to read the result",
        body: "A dasha result is not good or bad by itself. The planet's house ownership, dignity, aspects, yogas, and relationship to the current transit decide how the period tends to unfold.",
      },
      {
        title: "How AstroYou makes it personal",
        body: "AstroYou combines dasha with Kundali, transit, Panchang, and Atman memory, so the guidance can connect timing with what is actually happening in the user's life.",
      },
    ],
    primaryCta: { label: "Calculate My Dasha", to: "/free-kundali" },
    secondaryCta: { label: "Read Dasha Guide", to: "/dasha" },
    keywords: [
      "dasha calculator",
      "mahadasha calculator",
      "antardasha",
      "vimshottari dasha",
    ],
  },
  {
    slug: "panchang-today",
    path: "/panchang-today",
    title: "Panchang Today: Tithi, Nakshatra, Rahu Kaal, and Muhurat",
    description:
      "Check Panchang today for Tithi, Nakshatra, Yoga, Karana, Rahu Kaal, and auspicious timing, then use it with your personal Kundali for better daily decisions.",
    heading: "Panchang Today",
    intro:
      "Today's Panchang describes the quality of the day through lunar and solar timing. It helps choose the right tone for work, prayer, travel, repair, learning, and important beginnings.",
    sections: [
      {
        title: "What Panchang includes",
        body: "A daily Panchang usually includes Tithi, Nakshatra, Yoga, Karana, weekday, sunrise, sunset, Rahu Kaal, and other timing windows. These signals describe the day's rhythm rather than a fixed prediction.",
      },
      {
        title: "How to use it practically",
        body: "Use Panchang to avoid reactive starts, choose calmer windows, and match the task to the day. For example, some timings support learning or repair better than aggressive launches.",
      },
      {
        title: "Personal timing is stronger",
        body: "General Panchang is useful for everyone, but major decisions should also consider your birth chart, dasha, current transit pressure, and practical readiness.",
      },
    ],
    primaryCta: { label: "Open Panchang Today", to: "/panchang" },
    secondaryCta: { label: "Generate My Kundali", to: "/free-kundali" },
    keywords: [
      "panchang today",
      "today tithi",
      "rahu kaal today",
      "nakshatra today",
    ],
  },
  {
    slug: "kaal-sarp-dosha",
    path: "/kaal-sarp-dosha",
    title: "Kaal Sarp Dosha Meaning, Effects, and Remedies",
    description:
      "Understand Kaal Sarp Dosha, how Rahu and Ketu shape chart interpretation, and why full-chart context matters before remedies.",
    heading: "Kaal Sarp Dosha",
    intro:
      "Kaal Sarp Dosha is discussed when planets sit between Rahu and Ketu. It should be read carefully with the full birth chart, not treated as a fear label.",
    sections: [
      {
        title: "What Rahu and Ketu show",
        body: "Rahu points to hunger, ambition, and unfamiliar territory. Ketu points to detachment, inherited skill, and spiritual release. Together they create karmic pressure and direction.",
      },
      {
        title: "Why context matters",
        body: "A serious reading checks house placement, planetary strength, yogas, dashas, and transits before judging the practical effect of any dosha.",
      },
      {
        title: "Remedies without fear",
        body: "Useful remedies are steady and simple: mantra, service, discipline, devotion, and decisions that reduce impulsive Rahu patterns.",
      },
    ],
    primaryCta: { label: "Generate My Kundali", to: "/free-kundali" },
    secondaryCta: {
      label: "Ask Traditional Guide",
      to: "/consult/pandit-raghunath/profile",
    },
    keywords: ["kaal sarp dosha", "rahu ketu", "vedic dosha", "remedies"],
  },
  {
    slug: "love-compatibility",
    path: "/love-compatibility",
    title: "Love Compatibility by Kundali, Moon Sign, and Relationship Timing",
    description:
      "Learn how Vedic astrology reads love compatibility through Moon sign, Venus, seventh house, dashas, and Guna Milan.",
    heading: "Love Compatibility",
    intro:
      "Love compatibility is more than one score. A careful reading combines emotional rhythm, attraction, family timing, communication patterns, and the maturity of both people.",
    sections: [
      {
        title: "The main relationship indicators",
        body: "Moon sign, Venus, Jupiter, seventh house, navamsa, and dasha timing all shape how two people bond, repair, and make long-term decisions.",
      },
      {
        title: "Why Guna Milan is not enough",
        body: "A 36-point score helps, but it does not fully explain emotional safety, shared values, conflict style, or timing for commitment.",
      },
      {
        title: "Better questions to ask",
        body: "Ask what needs care, what timing supports commitment, and what practical habits will make the relationship healthier. This turns compatibility into a living practice instead of a pass-or-fail label.",
      },
    ],
    primaryCta: { label: "Check Free Match", to: "/free-kundali-matching" },
    secondaryCta: {
      label: "Ask Relationship Guide",
      to: "/consult/meera-devi/profile",
    },
    keywords: [
      "love compatibility",
      "kundali matching",
      "relationship astrology",
    ],
  },
  {
    slug: "vedic-astrology",
    path: "/vedic-astrology",
    title: "Vedic Astrology: Kundali, Dashas, Panchang, Transits, and Remedies",
    description:
      "A practical guide to Vedic astrology concepts including Kundali, dashas, panchang, yogas, transits, doshas, and remedies.",
    heading: "Vedic Astrology",
    intro:
      "Vedic astrology reads life through the birth chart, planetary periods, daily panchang, transits, yogas, and remedies. The strongest guidance connects all of these to the person asking.",
    sections: [
      {
        title: "The chart is the base",
        body: "The Kundali shows houses, planets, signs, strengths, and patterns. It gives the structure, but timing decides when themes become active.",
      },
      {
        title: "Dashas make it personal",
        body: "Dashas show the active planetary chapter of life, which is why two people with similar charts can experience very different periods.",
      },
      {
        title: "Guidance should be practical",
        body: "A good reading should reduce confusion, suggest one useful next step, and avoid fear-based claims. It should leave the person more grounded, not more dependent on another prediction.",
      },
    ],
    primaryCta: { label: "Generate Free Kundali", to: "/free-kundali" },
    secondaryCta: { label: "Ask AI Jyotish", to: "/synthesis" },
    keywords: ["vedic astrology", "jyotish", "kundali", "dashas", "panchang"],
  },
  {
    slug: "gemstone-remedies",
    path: "/gemstone-remedies",
    title: "Gemstone and Vedic Remedies: Mantra, Donation, Ritual, and Care",
    description:
      "Understand Vedic remedies, gemstones, mantras, donation, fasting, and when to avoid fear-based or expensive prescriptions.",
    heading: "Gemstone Remedies",
    intro:
      "Vedic remedies should support steadiness and clarity. Gemstones are only one option, and they should be considered after chart context, not bought from fear.",
    sections: [
      {
        title: "Remedies are not shortcuts",
        body: "Mantra, donation, fasting, service, discipline, and prayer work best when paired with practical life changes.",
      },
      {
        title: "Gemstones need caution",
        body: "A gemstone strengthens a planetary influence. That is why the full chart, dasha, and current condition should be checked before wearing one.",
      },
      {
        title: "AstroYou's approach",
        body: "The platform prefers simple, low-risk remedies first and explains the reasoning behind each suggestion. Expensive or intense remedies should only appear when the chart logic and user context truly support them.",
      },
    ],
    primaryCta: { label: "Generate My Kundali", to: "/free-kundali" },
    secondaryCta: {
      label: "Ask Remedy Guide",
      to: "/consult/pandit-raghunath/profile",
    },
    keywords: [
      "gemstone remedies",
      "vedic remedies",
      "mantra",
      "jyotish remedies",
    ],
  },
  {
    slug: "business-muhurat",
    path: "/business-muhurat",
    title: "Business Muhurat: Auspicious Time to Start Work, Shop, or Company",
    description:
      "Learn how Vedic astrology checks business Muhurat using Panchang, Rahu Kaal, weekday, tithi, nakshatra, and personal chart timing.",
    heading: "Business Muhurat",
    intro:
      "A business Muhurat is used to choose a steady opening moment for a shop, company, project, launch, contract, or first transaction.",
    sections: [
      {
        title: "What is checked",
        body: "A first-pass Muhurat checks date, city, tithi, nakshatra, weekday, Rahu Kaal, and Abhijit Muhurat. A deeper reading also checks the founder's chart and dasha.",
      },
      {
        title: "What matters practically",
        body: "The chosen time should support clear paperwork, clean accounts, realistic commitments, and a calm first action rather than only a ceremonial start.",
      },
      {
        title: "Use personal timing",
        body: "General Panchang is useful, but personal chart timing is stronger for major investments, partnerships, loans, or business expansion.",
      },
    ],
    primaryCta: { label: "Find Free Muhurat", to: "/muhurat" },
    secondaryCta: {
      label: "Ask Career Guide",
      to: "/consult/arjun-sharma/profile",
    },
    keywords: [
      "business muhurat",
      "shop opening muhurat",
      "company registration muhurat",
    ],
  },
  {
    slug: "property-muhurat",
    path: "/property-muhurat",
    title: "Property Muhurat: Auspicious Timing for Buying Home or Land",
    description:
      "Understand property Muhurat for buying a home, land, vehicle, or signing documents using Panchang and personal chart context.",
    heading: "Property Muhurat",
    intro:
      "Property decisions carry money, family, and long-term stability. A Muhurat helps choose a calmer first step for purchase, registration, or moving.",
    sections: [
      {
        title: "Which steps can be timed",
        body: "People usually check timing for token payment, agreement signing, registration, griha pravesh, renovation start, or first overnight stay.",
      },
      {
        title: "What to avoid",
        body: "Avoid rushed decisions, unclear paperwork, and emotionally reactive commitments. Panchang can help filter the day, but due diligence still matters.",
      },
      {
        title: "Chart context",
        body: "For major property purchases, fourth house, Mars, Venus, Saturn, dasha timing, and current transits should be read with the Panchang. This keeps the timing advice connected to both the home and financial responsibility.",
      },
    ],
    primaryCta: { label: "Find Free Muhurat", to: "/muhurat" },
    secondaryCta: {
      label: "Ask Family Guide",
      to: "/consult/nanda-ji/profile",
    },
    keywords: ["property muhurat", "griha pravesh", "home buying muhurat"],
  },
  {
    slug: "marriage-muhurat",
    path: "/marriage-muhurat",
    title: "Marriage Muhurat: Auspicious Wedding Dates and Timing",
    description:
      "Learn how marriage Muhurat uses Panchang, Nakshatra, Tithi, family context, and both partners' Kundalis before choosing a wedding date.",
    heading: "Marriage Muhurat",
    intro:
      "Marriage Muhurat is not only a date search. It should respect Panchang, family logistics, and both partners' chart timing.",
    sections: [
      {
        title: "General filters",
        body: "A basic wedding-date filter checks tithi, nakshatra, weekday, lunar month, Rahu Kaal, and broad auspicious windows.",
      },
      {
        title: "Personal filters",
        body: "A serious Muhurat also checks both partners' dashas, Moon strength, Venus, Jupiter, seventh-house factors, and family priorities.",
      },
      {
        title: "Compatibility first",
        body: "Before choosing a date, compatibility and practical readiness should be understood so the Muhurat supports a real relationship foundation. A good wedding date cannot replace honest family alignment and mutual commitment.",
      },
    ],
    primaryCta: { label: "Check Free Match", to: "/free-kundali-matching" },
    secondaryCta: { label: "Find Free Muhurat", to: "/muhurat" },
    keywords: ["marriage muhurat", "wedding dates", "kundali matching"],
  },
  {
    slug: "baby-name-astrology",
    path: "/baby-name-astrology",
    title: "Baby Name Astrology: Nakshatra, Rashi, and Naming Letters",
    description:
      "Understand how baby names are chosen from Nakshatra, Moon sign, syllables, family tradition, and practical modern naming needs.",
    heading: "Baby Name Astrology",
    intro:
      "In Vedic naming, the birth Nakshatra and Moon sign can suggest starting syllables. The final name should also be easy, meaningful, and family-aligned.",
    sections: [
      {
        title: "Nakshatra syllables",
        body: "Each Nakshatra pada is associated with sound syllables. These sounds are used as a starting point for selecting a name.",
      },
      {
        title: "Meaning still matters",
        body: "A good name should carry a clear meaning, be easy to pronounce, and feel respectful across family and cultural settings.",
      },
      {
        title: "Use the birth profile",
        body: "AstroYou can first identify the child's Moon sign and Nakshatra from birth details, then guide the naming direction. This gives the family a traditional starting point without forcing a name that feels impractical.",
      },
    ],
    primaryCta: { label: "Generate Baby Kundali", to: "/free-kundali" },
    secondaryCta: {
      label: "Ask Family Guide",
      to: "/consult/nanda-ji/profile",
    },
    keywords: ["baby name astrology", "nakshatra names", "rashi name letters"],
  },
  {
    slug: "lucky-mobile-number",
    path: "/lucky-mobile-number",
    title: "Lucky Mobile Number: Numerology Meaning and Practical Check",
    description:
      "Learn how mobile number numerology is interpreted, what it can and cannot tell you, and when to use birth chart context.",
    heading: "Lucky Mobile Number",
    intro:
      "Mobile number numerology is a light-touch tool. It can be interesting for pattern reading, but it should not replace practical judgment or chart timing.",
    sections: [
      {
        title: "How numbers are read",
        body: "Numerology usually reduces digits to root numbers and reads repeated patterns, missing numbers, or total vibration.",
      },
      {
        title: "Avoid overclaiming",
        body: "A number cannot guarantee wealth, marriage, health, or success. It should be treated as a secondary signal, not a life decision engine.",
      },
      {
        title: "Stronger context",
        body: "For important choices, combine numerology with your birth chart, dasha, practical constraints, and personal intention. The number can be a supporting symbol, but the life decision still needs grounded judgment.",
      },
    ],
    primaryCta: { label: "Open Numerology", to: "/numerology" },
    secondaryCta: { label: "Ask AI Jyotish", to: "/synthesis" },
    keywords: ["lucky mobile number", "mobile number numerology", "numerology"],
  },
];

const NAKSHATRA_PAGE_SEEDS = [
  [
    "ashwini",
    "Ashwini",
    "Ashwini Kumars",
    "swift healing, quick starts, and rescue energy",
  ],
  [
    "bharani",
    "Bharani",
    "Yama",
    "endurance, responsibility, and intense transformation",
  ],
  [
    "krittika",
    "Krittika",
    "Agni",
    "truth, purification, sharp focus, and decisive action",
  ],
  [
    "rohini",
    "Rohini",
    "Brahma",
    "growth, beauty, fertility, comfort, and creative attraction",
  ],
  [
    "mrigashira",
    "Mrigashira",
    "Soma",
    "curiosity, searching, tenderness, and adaptive learning",
  ],
  [
    "ardra",
    "Ardra",
    "Rudra",
    "storms, release, emotional honesty, and rebuilding after pressure",
  ],
  [
    "punarvasu",
    "Punarvasu",
    "Aditi",
    "renewal, return, protection, and hope after disruption",
  ],
  [
    "pushya",
    "Pushya",
    "Brihaspati",
    "nourishment, discipline, teaching, devotion, and care",
  ],
  [
    "ashlesha",
    "Ashlesha",
    "Nagas",
    "psychology, binding patterns, instinct, and emotional depth",
  ],
  [
    "magha",
    "Magha",
    "Pitrs",
    "lineage, authority, ancestors, legacy, and inherited duty",
  ],
  [
    "purva-phalguni",
    "Purva Phalguni",
    "Bhaga",
    "pleasure, rest, romance, creativity, and social warmth",
  ],
  [
    "uttara-phalguni",
    "Uttara Phalguni",
    "Aryaman",
    "commitment, support, agreements, and steady loyalty",
  ],
  [
    "hasta",
    "Hasta",
    "Savitar",
    "skill, craft, hands-on intelligence, and practical manifestation",
  ],
  [
    "chitra",
    "Chitra",
    "Tvashtar",
    "design, beauty, structure, image, and precise refinement",
  ],
  [
    "swati",
    "Swati",
    "Vayu",
    "independence, movement, trade, flexibility, and self-direction",
  ],
  [
    "vishakha",
    "Vishakha",
    "Indra and Agni",
    "ambition, focus, devotion, and milestone achievement",
  ],
  [
    "anuradha",
    "Anuradha",
    "Mitra",
    "friendship, devotion, cooperation, and emotional loyalty",
  ],
  [
    "jyeshtha",
    "Jyeshtha",
    "Indra",
    "seniority, protection, strategy, pride, and responsibility",
  ],
  [
    "mula",
    "Mula",
    "Nirriti",
    "roots, truth seeking, dismantling, and deep karmic inquiry",
  ],
  [
    "purva-ashadha",
    "Purva Ashadha",
    "Apas",
    "conviction, cleansing, persuasion, and resilient optimism",
  ],
  [
    "uttara-ashadha",
    "Uttara Ashadha",
    "Vishvadevas",
    "enduring victory, ethics, leadership, and public duty",
  ],
  [
    "shravana",
    "Shravana",
    "Vishnu",
    "listening, learning, transmission, tradition, and guidance",
  ],
  [
    "dhanishta",
    "Dhanishta",
    "Vasus",
    "rhythm, wealth, community, performance, and shared resources",
  ],
  [
    "shatabhisha",
    "Shatabhisha",
    "Varuna",
    "healing, secrecy, systems, isolation, and truth recovery",
  ],
  [
    "purva-bhadrapada",
    "Purva Bhadrapada",
    "Aja Ekapada",
    "intensity, sacrifice, ideals, and spiritual fire",
  ],
  [
    "uttara-bhadrapada",
    "Uttara Bhadrapada",
    "Ahir Budhnya",
    "depth, patience, stability, and inner maturity",
  ],
  [
    "revati",
    "Revati",
    "Pushan",
    "protection, travel, nourishment, completion, and safe transitions",
  ],
] as const;

interface PlanetSeed {
  slug: string;
  name: string;
  sanskrit: string;
  theme: string;
  /** Classical benefic / malefic / shadow classification. */
  nature: "benefic" | "malefic" | "neutral" | "shadow";
  /** What the graha signifies as a natural karaka. */
  karaka: string;
  /** Signs owned, or "" for the shadow grahas which own none. */
  owns: string;
  exalted: string;
  debilitated: string;
  /** Special drishti beyond the universal 7th aspect. */
  aspects: string;
  /** Weekday and low-risk remedy direction. */
  remedy: string;
  /** A checkable astronomical or classical number. */
  fact: SeoContentFact;
}

const PLANET_PAGE_SEEDS: PlanetSeed[] = [
  {
    slug: "sun",
    name: "Sun",
    sanskrit: "Surya",
    theme: "identity, confidence, authority, father themes, and life force",
    nature: "malefic",
    karaka: "atma (soul), father, government, bone structure, and eyesight",
    owns: "Leo",
    exalted: "Aries, 10°",
    debilitated: "Libra, 10°",
    aspects: "the 7th house only",
    remedy:
      "Sunday discipline, sunrise water offering, and Aditya Hridayam recitation",
    fact: {
      label: "Vimshottari mahadasha",
      value: "6 years",
      source: "Shortest of the nine planetary periods",
    },
  },
  {
    slug: "moon",
    name: "Moon",
    sanskrit: "Chandra",
    theme: "mind, emotion, memory, mother themes, and daily inner rhythm",
    nature: "benefic",
    karaka: "manas (mind), mother, fluids, comfort, and public feeling",
    owns: "Cancer",
    exalted: "Taurus, 3°",
    debilitated: "Scorpio, 3°",
    aspects: "the 7th house only",
    remedy: "Monday routine, hydration, mother-care, and white-food simplicity",
    fact: {
      label: "Sign transit speed",
      value: "~2.25 days per rashi",
      source: "Full 12-sign cycle in about 27.3 days",
    },
  },
  {
    slug: "mars",
    name: "Mars",
    sanskrit: "Mangal",
    theme:
      "drive, courage, conflict style, land, siblings, and physical energy",
    nature: "malefic",
    karaka: "courage, younger siblings, land, surgery, and muscular strength",
    owns: "Aries and Scorpio",
    exalted: "Capricorn, 28°",
    debilitated: "Cancer, 28°",
    aspects: "the 4th, 7th, and 8th houses",
    remedy:
      "Tuesday physical outlet, Hanuman Chalisa, and deliberately slowed reactions",
    fact: {
      label: "Vimshottari mahadasha",
      value: "7 years",
      source:
        "Equal to Ketu; shorter than every non-node period except the Sun",
    },
  },
  {
    slug: "mercury",
    name: "Mercury",
    sanskrit: "Budha",
    theme: "speech, learning, trade, analytics, writing, and nervous energy",
    nature: "neutral",
    karaka: "speech, intellect, commerce, skin, and nervous system",
    owns: "Gemini and Virgo",
    exalted: "Virgo, 15°",
    debilitated: "Pisces, 15°",
    aspects: "the 7th house only",
    remedy:
      "Wednesday study habit, honest speech audit, and green-shade simplicity",
    fact: {
      label: "Dignity note",
      value: "Only graha exalted in a sign it also owns",
      source: "Virgo is both Mercury's own sign and its exaltation sign",
    },
  },
  {
    slug: "jupiter",
    name: "Jupiter",
    sanskrit: "Guru",
    theme: "wisdom, teachers, children, faith, ethics, and expansion",
    nature: "benefic",
    karaka: "wisdom, children, wealth, teachers, and dharma",
    owns: "Sagittarius and Pisces",
    exalted: "Cancer, 5°",
    debilitated: "Capricorn, 5°",
    aspects: "the 5th, 7th, and 9th houses",
    remedy: "Thursday learning, teacher respect, and consistent honest counsel",
    fact: {
      label: "Orbital period",
      value: "11.86 years",
      source: "Roughly one zodiac sign per year of transit",
    },
  },
  {
    slug: "venus",
    name: "Venus",
    sanskrit: "Shukra",
    theme: "relationships, beauty, comfort, art, marriage, and material taste",
    nature: "benefic",
    karaka: "marriage, spouse, vehicles, art, and sensory pleasure",
    owns: "Taurus and Libra",
    exalted: "Pisces, 27°",
    debilitated: "Virgo, 27°",
    aspects: "the 7th house only",
    remedy:
      "Friday aesthetic care, relationship repair, and restraint in excess",
    fact: {
      label: "Vimshottari mahadasha",
      value: "20 years",
      source: "The longest of the nine planetary periods",
    },
  },
  {
    slug: "saturn",
    name: "Saturn",
    sanskrit: "Shani",
    theme: "discipline, karma, delay, duty, endurance, and long-term maturity",
    nature: "malefic",
    karaka: "longevity, labour, grief, discipline, and the elderly",
    owns: "Capricorn and Aquarius",
    exalted: "Libra, 20°",
    debilitated: "Aries, 20°",
    aspects: "the 3rd, 7th, and 10th houses",
    remedy:
      "Saturday service, respect for workers, and finishing what was begun",
    fact: {
      label: "Sidereal period",
      value: "29.5 years",
      source: "Sets the 7.5-year span of each Sade Sati",
    },
  },
  {
    slug: "rahu",
    name: "Rahu",
    sanskrit: "Rahu",
    theme:
      "ambition, obsession, foreignness, disruption, and unconventional growth",
    nature: "shadow",
    karaka: "obsession, foreign contact, technology, and sudden elevation",
    owns: "no sign of its own",
    exalted: "Taurus or Gemini, depending on the school",
    debilitated: "Scorpio or Sagittarius, depending on the school",
    aspects: "the 5th, 7th, and 9th houses in most traditions",
    remedy:
      "Digital restraint, Durga or Bhairava practice, and honest disclosure",
    fact: {
      label: "Nodal cycle",
      value: "18.6 years",
      source: "Time for the lunar nodes to return to the same sidereal point",
    },
  },
  {
    slug: "ketu",
    name: "Ketu",
    sanskrit: "Ketu",
    theme:
      "detachment, past-life skill, spirituality, release, and inward focus",
    nature: "shadow",
    karaka: "moksha, past-life skill, sudden loss, and piercing insight",
    owns: "no sign of its own",
    exalted: "Scorpio or Sagittarius, depending on the school",
    debilitated: "Taurus or Gemini, depending on the school",
    aspects: "the 5th, 7th, and 9th houses in most traditions",
    remedy:
      "Silence practice, Ganesha worship, and reduced possession-clinging",
    fact: {
      label: "Position",
      value: "Always 180° from Rahu",
      source: "The two nodes are opposite intersections of the same orbit",
    },
  },
];

interface HouseSeed {
  slug: string;
  name: string;
  ordinal: number;
  sanskrit: string;
  theme: string;
  /** Classical structural grouping — drives the interpretation rules below. */
  kind: "kendra" | "trikona" | "dusthana" | "upachaya" | "panapara";
  /** True for houses that are both kendra and something else, etc. */
  alsoKnownAs: string;
  naturalSign: string;
  karaka: string;
  fact: SeoContentFact;
}

const HOUSE_PAGE_SEEDS: HouseSeed[] = [
  {
    slug: "first-house",
    name: "First House",
    ordinal: 1,
    sanskrit: "Tanu Bhava",
    theme: "self, body, personality, vitality, and first response to life",
    kind: "kendra",
    alsoKnownAs: "both a kendra (angle) and a trikona (trine)",
    naturalSign: "Aries",
    karaka: "Sun",
    fact: {
      label: "Structural role",
      value: "The only house that is both kendra and trikona",
      source: "Makes its lord uniquely benefic for any ascendant",
    },
  },
  {
    slug: "second-house",
    name: "Second House",
    ordinal: 2,
    sanskrit: "Dhana Bhava",
    theme: "wealth, speech, family values, food, savings, and stability",
    kind: "panapara",
    alsoKnownAs: "a maraka (life-limiting) house in longevity reading",
    naturalSign: "Taurus",
    karaka: "Jupiter",
    fact: {
      label: "Maraka status",
      value: "One of two maraka houses",
      source: "Paired with the 7th in classical longevity analysis",
    },
  },
  {
    slug: "third-house",
    name: "Third House",
    ordinal: 3,
    sanskrit: "Sahaja Bhava",
    theme: "courage, siblings, effort, communication, skills, and short travel",
    kind: "upachaya",
    alsoKnownAs: "an upachaya (growing) house where malefics improve over time",
    naturalSign: "Gemini",
    karaka: "Mars",
    fact: {
      label: "Upachaya effect",
      value: "Malefics here tend to strengthen with age",
      source: "Shared by the 3rd, 6th, 10th, and 11th houses",
    },
  },
  {
    slug: "fourth-house",
    name: "Fourth House",
    ordinal: 4,
    sanskrit: "Sukha Bhava",
    theme: "home, mother, property, comfort, vehicles, and emotional grounding",
    kind: "kendra",
    alsoKnownAs: "a kendra (angle) governing inner security",
    naturalSign: "Cancer",
    karaka: "Moon",
    fact: {
      label: "Chaturasra position",
      value: "The nadir of the chart",
      source: "Directly opposite the 10th house of public visibility",
    },
  },
  {
    slug: "fifth-house",
    name: "Fifth House",
    ordinal: 5,
    sanskrit: "Putra Bhava",
    theme:
      "children, intelligence, creativity, romance, mantra, and past merit",
    kind: "trikona",
    alsoKnownAs: "a trikona (trine) carrying purva punya, or stored merit",
    naturalSign: "Leo",
    karaka: "Jupiter",
    fact: {
      label: "Trikona status",
      value: "One of three trine houses",
      source: "The 1st, 5th, and 9th are the chart's fortune-bearing angles",
    },
  },
  {
    slug: "sixth-house",
    name: "Sixth House",
    ordinal: 6,
    sanskrit: "Ari Bhava",
    theme:
      "health routines, debt, competition, service, discipline, and obstacles",
    kind: "dusthana",
    alsoKnownAs: "both a dusthana (difficult house) and an upachaya",
    naturalSign: "Virgo",
    karaka: "Mars and Saturn",
    fact: {
      label: "Dual classification",
      value: "Dusthana and upachaya at once",
      source: "Difficulty here converts into competitive capability over time",
    },
  },
  {
    slug: "seventh-house",
    name: "Seventh House",
    ordinal: 7,
    sanskrit: "Kalatra Bhava",
    theme: "marriage, partnerships, clients, contracts, and public interaction",
    kind: "kendra",
    alsoKnownAs: "a kendra and the second maraka house",
    naturalSign: "Libra",
    karaka: "Venus",
    fact: {
      label: "Universal aspect",
      value: "Every graha aspects its own 7th",
      source: "The one drishti shared by all nine planets",
    },
  },
  {
    slug: "eighth-house",
    name: "Eighth House",
    ordinal: 8,
    sanskrit: "Ayur Bhava",
    theme: "sudden change, secrets, longevity, inheritance, and transformation",
    kind: "dusthana",
    alsoKnownAs: "the principal dusthana, and the house of longevity itself",
    naturalSign: "Scorpio",
    karaka: "Saturn",
    fact: {
      label: "Longevity reading",
      value: "Primary house for ayur (lifespan)",
      source: "Read with Saturn as the karaka of longevity",
    },
  },
  {
    slug: "ninth-house",
    name: "Ninth House",
    ordinal: 9,
    sanskrit: "Bhagya Bhava",
    theme: "dharma, fortune, father, teachers, pilgrimage, and higher learning",
    kind: "trikona",
    alsoKnownAs: "the strongest trikona, often called the house of fortune",
    naturalSign: "Sagittarius",
    karaka: "Jupiter and Sun",
    fact: {
      label: "Classical rank",
      value: "Considered the most auspicious bhava",
      source: "Its lord is the primary yoga-karaka indicator for fortune",
    },
  },
  {
    slug: "tenth-house",
    name: "Tenth House",
    ordinal: 10,
    sanskrit: "Karma Bhava",
    theme: "career, status, authority, public work, and visible responsibility",
    kind: "kendra",
    alsoKnownAs: "both a kendra and an upachaya",
    naturalSign: "Capricorn",
    karaka: "Sun, Mercury, Jupiter, and Saturn",
    fact: {
      label: "Karaka count",
      value: "Four natural significators",
      source: "More than any other house in classical texts",
    },
  },
  {
    slug: "eleventh-house",
    name: "Eleventh House",
    ordinal: 11,
    sanskrit: "Labha Bhava",
    theme: "income, gains, networks, friends, ambitions, and elder siblings",
    kind: "upachaya",
    alsoKnownAs: "the strongest upachaya, governing realised gain",
    naturalSign: "Aquarius",
    karaka: "Jupiter",
    fact: {
      label: "Income pairing",
      value: "Read against the 2nd house",
      source: "The 11th shows inflow; the 2nd shows what is retained",
    },
  },
  {
    slug: "twelfth-house",
    name: "Twelfth House",
    ordinal: 12,
    sanskrit: "Vyaya Bhava",
    theme: "sleep, expenses, solitude, foreign lands, moksha, and release",
    kind: "dusthana",
    alsoKnownAs: "a dusthana, and the final house of liberation",
    naturalSign: "Pisces",
    karaka: "Saturn and Ketu",
    fact: {
      label: "Moksha trikona",
      value: "Completes the 4th–8th–12th axis",
      source: "The three houses governing release in classical grouping",
    },
  },
];

const NATURE_LABEL: Record<PlanetSeed["nature"], string> = {
  benefic: "a natural benefic",
  malefic: "a natural malefic",
  neutral: "naturally neutral, taking the character of its company",
  shadow: "a chhaya graha, or shadow planet",
};

/**
 * The interpretive rule that makes each of the 108 planet-in-house pages
 * genuinely different: classical texts read a placement primarily through
 * the graha's benefic/malefic nature crossed with the bhava's structural
 * class. A benefic in a trikona is not the same statement as a malefic in a
 * dusthana, and neither is the same as a node in a kendra.
 */
function readPlacement(planet: PlanetSeed, house: HouseSeed): string {
  const { nature } = planet;
  const { kind } = house;

  if (nature === "shadow" && kind === "dusthana") {
    return `${planet.name} in a dusthana is one of the few placements classical texts treat as quietly workable. The ${house.sanskrit} already deals in loss and upheaval, and a shadow graha placed there often describes someone who becomes unusually competent at situations others avoid — provided the rest of the chart supplies stability.`;
  }
  if (nature === "shadow" && kind === "kendra") {
    return `A chhaya graha in a kendra is loud. ${planet.name} in an angular house tends to make ${house.theme.split(",")[0]} the most visible theme in the life, sometimes out of proportion to the rest of the chart. The usual caution is to check whether ambition here is genuinely chosen or merely compulsive.`;
  }
  if (nature === "shadow") {
    return `${planet.name} here bends the ${house.sanskrit} rather than strengthening or damaging it outright. Expect unconventional routes into ${house.theme.split(",")[0]} — foreign, late, inherited, or arrived at sideways — which is characteristic of a graha that owns no sign and borrows its behaviour from its dispositor.`;
  }
  if (nature === "benefic" && kind === "trikona") {
    return `${planet.name} in the ${house.sanskrit} is among the more supportive combinations in a chart. A natural benefic in a trikona lets ${planet.name}'s ${planet.karaka.split(",")[0]} flow into ${house.theme.split(",")[0]} with relatively little friction, and it is one of the standard ingredients of a raja yoga when the lord of the ${house.name.toLowerCase()} cooperates.`;
  }
  if (nature === "benefic" && kind === "dusthana") {
    return `Classical reading of ${planet.name} in the ${house.sanskrit} is mixed. A benefic in a dusthana protects the house but can dilute its own significations — the well-known "wasted benefic" caution. The practical reading is that ${house.theme.split(",")[0]} is defended, while ${planet.name}'s ${planet.karaka.split(",")[0]} may ask for conscious attention elsewhere in the chart.`;
  }
  if (nature === "malefic" && kind === "upachaya") {
    return `${planet.name} in the ${house.sanskrit} is the placement upachaya houses exist to describe. A natural malefic in a growing house typically starts as friction and converts into capability: struggle with ${house.theme.split(",")[0]} early, ${planet.name}-flavoured competence later. Age tends to help this placement rather than hurt it.`;
  }
  if (nature === "malefic" && kind === "dusthana") {
    return `${planet.name} in the ${house.sanskrit} can produce viparita raja yoga — a reversal in which difficulty in ${house.theme.split(",")[0]} becomes the exact source of later strength, carrying ${planet.name}'s signature of ${planet.karaka.split(",")[0]}. The yoga is conditional, not automatic; it needs the lord of the ${house.name.toLowerCase()} and the other dusthana lords to cooperate before the reversal actually lands.`;
  }
  if (nature === "malefic" && kind === "kendra") {
    return `A malefic in an angle carries weight rather than ease. ${planet.name} in the ${house.sanskrit} tends to make ${house.theme.split(",")[0]} a duty the person cannot delegate, coloured by ${planet.name}'s ${planet.karaka.split(",")[0]}. Handled well this reads as authority; handled poorly it reads as rigidity.`;
  }
  if (nature === "malefic" && kind === "trikona") {
    return `A natural malefic in a trine is less damaging than its nature suggests, because the ${house.sanskrit} is itself fortunate. ${planet.name} adds effort and edge to ${house.theme.split(",")[0]} — results usually arrive, but rarely without ${planet.name}-style work first.`;
  }
  if (nature === "neutral") {
    return `${planet.name} takes on the character of whatever it sits with, so this placement is read almost entirely from company and dispositor. Alone in the ${house.sanskrit}, it gives an analytical, verbal, transactional flavour to ${house.theme.split(",")[0]}.`;
  }
  return `${planet.name}, a natural benefic, generally supports the ${house.sanskrit} and its themes of ${house.theme.split(",")[0]}, bringing ${planet.karaka.split(",")[0]} to bear on them. The size of the benefit depends on ${planet.name}'s dignity, the condition of the ${house.name.toLowerCase()} lord, and whether ${planet.name} is itself under affliction.`;
}

/** Dignity note that differs per planet-house pair via the natural zodiac. */
function readDignity(planet: PlanetSeed, house: HouseSeed): string {
  const ownsNaturalSign = planet.owns.includes(house.naturalSign);
  const exaltedHere = planet.exalted.startsWith(house.naturalSign);
  const debilitatedHere = planet.debilitated.startsWith(house.naturalSign);

  if (exaltedHere) {
    return `Note the natural-zodiac echo: ${house.naturalSign} is ${planet.name}'s exaltation sign (${planet.exalted}). In a chart where the ${house.name.toLowerCase()} actually falls in ${house.naturalSign} — an Aries ascendant counting from the first house — this placement gains real dignity rather than a symbolic one. Confirm the actual sign before treating it as strong.`;
  }
  if (debilitatedHere) {
    return `Note the natural-zodiac echo: ${house.naturalSign} is ${planet.name}'s debilitation sign (${planet.debilitated}). This does not make the placement weak by itself — the house is not the sign — but if the ${house.name.toLowerCase()} does fall in ${house.naturalSign} in the actual chart, check for neecha bhanga (cancellation) before reading it as damaged.`;
  }
  if (ownsNaturalSign) {
    return `In the natural zodiac the ${house.name.toLowerCase()} corresponds to ${house.naturalSign}, which ${planet.name} owns. Charts where this alignment holds literally give the placement a settled, at-home quality. Elsewhere it is only a background resonance and the real sign governs.`;
  }
  return `The natural zodiac gives ${house.naturalSign} to the ${house.name.toLowerCase()}, which is neither ${planet.name}'s own sign nor its exaltation or debilitation — so there is no shortcut here. Read dignity from the actual chart: check whether ${planet.name} is in its own sign (${planet.owns || "not applicable for a node"}), exalted (${planet.exalted}), debilitated (${planet.debilitated}), or in a friend's sign before deciding how strongly it delivers in the ${house.sanskrit}.`;
}

const PLANET_HOUSE_SEO_CONTENT_PAGES: SeoContentPage[] =
  PLANET_PAGE_SEEDS.flatMap((planet) =>
    HOUSE_PAGE_SEEDS.map((house) => {
      const dashaYears = VIMSHOTTARI_YEARS[planet.name];
      const primaryTheme = house.theme.split(",")[0];
      return {
        slug: `planet-in-house/${planet.slug}/${house.slug}`,
        path: `/planet-in-house/${planet.slug}/${house.slug}`,
        title: `${planet.name} in ${house.name}: Vedic Astrology Meaning and Results`,
        description: `${planet.name} in the ${house.name.toLowerCase()} (${house.sanskrit}) in Vedic astrology — what the placement means for ${primaryTheme}, how it behaves during the ${dashaYears}-year ${planet.name} mahadasha, and what to check before reading it as strong or weak.`,
        heading: `${planet.name} in ${house.name}`,
        intro: `${planet.name} (${planet.sanskrit}) is ${NATURE_LABEL[planet.nature]}, signifying ${planet.karaka}. The ${house.name.toLowerCase()} is ${house.alsoKnownAs}, covering ${house.theme}. This page reads what happens when the two meet.`,
        sections: [
          {
            title: `What ${planet.name} in the ${house.sanskrit} means`,
            body: readPlacement(planet, house),
          },
          {
            title: "Dignity check before you judge it",
            body: readDignity(planet, house),
          },
          {
            title: `When it becomes active`,
            body: `A placement is dormant until something switches it on. The main triggers are the ${dashaYears}-year ${planet.name} mahadasha, any ${planet.name} antardasha inside another period, and transits of ${planet.name} over the ${house.name.toLowerCase()} or its lord. ${planet.name} also aspects ${planet.aspects}, so its influence is not confined to the house it occupies.`,
          },
          {
            title: "What the placement does not decide",
            body: `${planet.name} in the ${house.name.toLowerCase()} is one factor among many. The lord of the ${house.name.toLowerCase()}, its condition in the D-9 Navamsa, aspects onto the house, conjunctions, and the ascendant all modify the outcome — often more than the occupying graha does. Treat this page as one input to a full reading, not a verdict.`,
          },
          {
            title: "Remedy direction",
            body: `Where ${planet.name} in the ${house.sanskrit} causes genuine friction, classical remedy order runs from behaviour to ritual to material. For ${planet.name} that means ${planet.remedy} — before any gemstone. Because the pressure shows up through ${house.theme.split(",")[0]}, the behavioural work is most useful when applied there directly. Gemstones amplify a graha; amplifying a badly placed ${planet.name} can make the problem louder rather than quieter.`,
          },
        ],
        facts: [
          {
            label: `${planet.name} mahadasha`,
            value: `${dashaYears} years`,
            source: "Vimshottari system, 120-year total cycle",
          },
          {
            label: `${house.name} classification`,
            value: house.alsoKnownAs.replace(/^(both |a |an |the )/, ""),
            source: `Sanskrit name: ${house.sanskrit}`,
          },
          {
            label: `${planet.name} aspects`,
            value: planet.aspects,
          },
          {
            label: `Natural karaka of the ${house.name.toLowerCase()}`,
            value: house.karaka,
          },
        ],
        faq: [
          {
            question: `Is ${planet.name} in the ${house.name.toLowerCase()} good or bad?`,
            answer: `Neither on its own. ${planet.name} is ${NATURE_LABEL[planet.nature]} and the ${house.name.toLowerCase()} is ${house.alsoKnownAs}, so the combination leans a particular way — but sign dignity, the house lord's strength, aspects, and the active dasha decide the actual result. Classical texts never read a single placement in isolation.`,
          },
          {
            question: `When will ${planet.name} in the ${house.name.toLowerCase()} give results?`,
            answer: `Most visibly during the ${dashaYears}-year ${planet.name} mahadasha or a ${planet.name} antardasha, and during transits of ${planet.name} across the ${house.name.toLowerCase()}. Outside those windows the placement usually stays in the background.`,
          },
          {
            question: `Which houses does ${planet.name} aspect from here?`,
            answer: `${planet.name} aspects ${planet.aspects}. Counting from the ${house.name.toLowerCase()}, that determines which additional areas of life carry this graha's signature even though it does not sit there.`,
          },
          {
            question: `What remedy suits ${planet.name} in the ${house.name.toLowerCase()}?`,
            answer: `Start with ${planet.remedy}, applied where the ${house.sanskrit} actually shows pressure — ${house.theme.split(",")[0]}. Behavioural and service-based remedies carry no downside risk. A gemstone for ${planet.name} should only follow a full chart reading, because strengthening an afflicted graha intensifies the very pattern you are trying to soften.`,
          },
        ],
        primaryCta: { label: "Generate Free Kundali", to: "/free-kundali" },
        secondaryCta: {
          label: `Read ${planet.name} Guide`,
          to: `/planet/${planet.slug}`,
        },
        keywords: [
          "planet in house",
          "graha in bhava",
          planet.name.toLowerCase(),
          house.name.toLowerCase(),
          house.sanskrit.toLowerCase(),
          "vedic astrology",
          "kundali",
        ],
        updated: SEO_CONTENT_REVIEWED,
      };
    }),
  );

const NAKSHATRA_SEO_CONTENT_PAGES: SeoContentPage[] = NAKSHATRA_PAGE_SEEDS.map(
  ([slug, name, deity, theme], index) => {
    const startDegree = index * (40 / 3);
    const padaLord = [
      "Ketu",
      "Venus",
      "Sun",
      "Moon",
      "Mars",
      "Rahu",
      "Jupiter",
      "Saturn",
      "Mercury",
    ][index % 9];
    const dashaYears = VIMSHOTTARI_YEARS[padaLord];
    const degreeLabel = `${Math.floor(startDegree)}°${Math.round((startDegree % 1) * 60)}'`;
    return {
      slug: `nakshatra/${slug}`,
      path: `/nakshatra/${slug}`,
      title: `${name} Nakshatra: Meaning, Traits, Pada, Compatibility, and Remedies`,
      description: `${name} Nakshatra spans ${degreeLabel} of the sidereal zodiac and is ruled by ${padaLord}. Its deity is ${deity}. Learn the traits, dasha implications, compatibility notes, and remedies.`,
      heading: `${name} Nakshatra`,
      intro: `${name} is the ${ordinal(index + 1)} of the 27 Nakshatras, beginning at ${degreeLabel} of the sidereal zodiac. Each Nakshatra covers exactly 13°20', and the Moon crosses one in roughly a day. Its ruling graha is ${padaLord} and its presiding deity is ${deity}.`,
      sections: [
        {
          title: "Position and ruler",
          body: `${name} occupies a 13°20' segment starting at ${degreeLabel}, measured with the Lahiri ayanamsa. Its dispositor in the Vimshottari system is ${padaLord}, which means anyone born with the Moon here begins life in a ${padaLord} mahadasha — a period of ${dashaYears} years — with the balance at birth determined by how far the Moon had already travelled through the segment.`,
        },
        {
          title: "Character and deity",
          body: `${name} is presided over by ${deity}, and its working themes are ${theme}. In practice this describes the mind's default reflex: what the person reaches for first under pressure, before reasoning catches up. This is why the birth Nakshatra is read from the Moon rather than the ascendant.`,
        },
        {
          title: "The four padas",
          body: `Every Nakshatra divides into four padas of 3°20' each, and each pada maps onto a different Navamsa sign. Two people born under ${name} on the same day can therefore read quite differently. The pada is what connects the Nakshatra to the D-9 chart, which is why serious matching work uses pada rather than Nakshatra alone.`,
        },
        {
          title: "Compatibility use",
          body: `In Ashtakoot Guna Milan, ${name} feeds several of the eight kootas directly — including Nadi (8 points), Bhakoot (7 points), and Gana (6 points), which together account for 21 of the 36 available points. This is why Nakshatra matching carries disproportionate weight in traditional marriage assessment, and also why a single Nakshatra mismatch should not end a conversation on its own.`,
        },
        {
          title: "Practical remedies",
          body: `Remedies keyed to ${name} usually work through its ruler ${padaLord} and its deity ${deity} — mantra on the ruling weekday, service aligned to the deity's character, and restraint in the areas where ${theme.split(",")[0]} tends to overrun. Behavioural remedies come first; anything expensive should follow a full chart reading.`,
        },
      ],
      facts: [
        {
          label: "Zodiac span",
          value: `13°20', starting at ${degreeLabel}`,
          source: "Lahiri ayanamsa",
        },
        {
          label: "Ruling graha",
          value: padaLord,
          source: `${dashaYears}-year Vimshottari mahadasha`,
        },
        { label: "Presiding deity", value: deity },
        { label: "Position", value: `${ordinal(index + 1)} of 27 Nakshatras` },
      ],
      faq: [
        {
          question: `What is ${name} Nakshatra?`,
          answer: `${name} is the ${ordinal(index + 1)} lunar mansion of the 27-fold sidereal zodiac, spanning 13°20' from ${degreeLabel}. It is ruled by ${padaLord}, presided over by ${deity}, and associated with ${theme}.`,
        },
        {
          question: `Which planet rules ${name} Nakshatra?`,
          answer: `${padaLord} rules ${name}. In the Vimshottari dasha system that gives it a ${dashaYears}-year mahadasha, and a person born under ${name} starts life inside a partially elapsed ${padaLord} period.`,
        },
        {
          question: `How do I find out if ${name} is my birth Nakshatra?`,
          answer: `Your Moon must fall between ${degreeLabel} and the end of ${name}'s 13°20' segment at the moment of birth. That is set by sidereal longitude, not by your Sun sign, so you need date, exact time, and place. AstroYou calculates whether ${name} is your birth star free from those three inputs.`,
        },
        {
          question: `Does ${name} Nakshatra affect marriage compatibility?`,
          answer: `Yes, substantially. ${name} feeds Nadi, Bhakoot, and Gana, which together contribute 21 of the 36 points in Ashtakoot Guna Milan, and its ruler ${padaLord} shapes Graha Maitri. The score is a filter rather than a verdict — dasha timing, Mangal Dosha, and the 7th house matter alongside it.`,
        },
      ],
      primaryCta: { label: "Find My Nakshatra", to: "/free-kundali" },
      secondaryCta: { label: "Read Nakshatra Guide", to: "/nakshatra" },
      keywords: [
        "nakshatra",
        "birth star",
        "vedic astrology",
        name.toLowerCase(),
      ],
      updated: SEO_CONTENT_REVIEWED,
    };
  },
);

const PLANET_SEO_CONTENT_PAGES: SeoContentPage[] = PLANET_PAGE_SEEDS.map(
  (planet) => {
    const dashaYears = VIMSHOTTARI_YEARS[planet.name];
    const share = ((dashaYears / 120) * 100).toFixed(1);
    return {
      slug: `planet/${planet.slug}`,
      path: `/planet/${planet.slug}`,
      title: `${planet.name} (${planet.sanskrit}) in Vedic Astrology: Meaning, Dignity, Dasha, Remedies`,
      description: `${planet.name} is ${NATURE_LABEL[planet.nature]} signifying ${planet.karaka}. It owns ${planet.owns || "no sign"}, exalts in ${planet.exalted}, and runs a ${dashaYears}-year mahadasha. Full reading guide.`,
      heading: `${planet.name} in Vedic Astrology`,
      intro: `${planet.name}, called ${planet.sanskrit} in Sanskrit, is ${NATURE_LABEL[planet.nature]}. As a natural karaka it signifies ${planet.karaka}, and it governs ${planet.theme}.`,
      sections: [
        {
          title: "Dignity: where it is strong and weak",
          body: `${planet.name} owns ${planet.owns || "no sign — it is a shadow graha and borrows character from its dispositor"}. It is exalted in ${planet.exalted} and debilitated in ${planet.debilitated}. Dignity is the first thing to check, because the same house placement reads very differently depending on the sign underneath it.`,
        },
        {
          title: "Aspects and reach",
          body: `${planet.name} aspects ${planet.aspects}. Every graha aspects its own 7th house; the additional drishti listed here are what make ${planet.name}'s influence extend past the house it occupies. When judging a house, count aspects onto it as well as occupants.`,
        },
        {
          title: "Timing through the dasha",
          body: `In the Vimshottari system, ${planet.name} runs a ${dashaYears}-year mahadasha — ${share}% of the 120-year cycle. That period is when its signification moves from background to foreground. Antardashas of ${planet.name} inside other mahadashas produce shorter, milder versions of the same theme.`,
        },
        {
          title: "How to read it in a Kundali",
          body: `Judge ${planet.name} by five things in order: sign dignity, house position, which houses it lords for that ascendant, aspects and conjunctions onto it, and its condition in the D-9 Navamsa. A graha strong in the rashi chart but weak in the Navamsa often promises more than it delivers.`,
        },
        {
          title: "Remedy approach",
          body: `For ${planet.name}, low-risk remedies come first: ${planet.remedy}. Classical remedy order runs behaviour, then mantra and service, then charity, and only then gemstones. Gemstones amplify a graha rather than correct it, so a stone for an afflicted ${planet.name} can intensify the difficulty it was meant to relieve.`,
        },
      ],
      facts: [
        { label: "Sanskrit name", value: planet.sanskrit },
        {
          label: "Vimshottari mahadasha",
          value: `${dashaYears} years (${share}% of 120)`,
        },
        { label: "Owns", value: planet.owns || "No sign" },
        {
          label: "Exalted / debilitated",
          value: `${planet.exalted} / ${planet.debilitated}`,
        },
        { label: "Aspects", value: planet.aspects },
        planet.fact,
      ],
      faq: [
        {
          question: `What does ${planet.name} represent in Vedic astrology?`,
          answer: `${planet.name} (${planet.sanskrit}) is ${NATURE_LABEL[planet.nature]}. As a natural karaka it signifies ${planet.karaka}, and in a chart it governs ${planet.theme}.`,
        },
        {
          question: `Where is ${planet.name} strong and where is it weak?`,
          answer: `${planet.name} is exalted in ${planet.exalted} and debilitated in ${planet.debilitated}. It owns ${planet.owns || "no sign, being a shadow graha"}. A debilitated placement can still be cancelled by neecha bhanga, so check that before reading it as weak.`,
        },
        {
          question: `How long is the ${planet.name} mahadasha?`,
          answer: `The ${planet.name} mahadasha runs ${dashaYears} years, which is ${share}% of the full 120-year Vimshottari cycle. Whether you live through a ${planet.name} period at all depends on where you start in the sequence at birth, which is set by your Moon's Nakshatra.`,
        },
        {
          question: `What is the best remedy for ${planet.name}?`,
          answer: `Begin with ${planet.remedy}. These carry no downside. A gemstone for ${planet.name} should only be considered after a full reading, since it strengthens the graha indiscriminately — including whatever difficulty it is currently producing.`,
        },
      ],
      primaryCta: { label: "Generate Free Kundali", to: "/free-kundali" },
      secondaryCta: { label: "Ask AI Jyotish", to: "/synthesis" },
      keywords: [
        "planet",
        "graha",
        "vedic astrology",
        planet.name.toLowerCase(),
        planet.sanskrit.toLowerCase(),
      ],
      updated: SEO_CONTENT_REVIEWED,
    };
  },
);

const HOUSE_SEO_CONTENT_PAGES: SeoContentPage[] = HOUSE_PAGE_SEEDS.map(
  (house) => ({
    slug: `house/${house.slug}`,
    path: `/house/${house.slug}`,
    title: `${house.name} (${house.sanskrit}) in Vedic Astrology: Meaning, Lord, Planets, Results`,
    description: `The ${house.name.toLowerCase()} or ${house.sanskrit} governs ${house.theme}. It is ${house.alsoKnownAs}, its natural karaka is ${house.karaka}, and it corresponds to ${house.naturalSign} in the natural zodiac.`,
    heading: `${house.name} in Vedic Astrology`,
    intro: `The ${house.name.toLowerCase()}, called ${house.sanskrit} in Sanskrit, is ${house.alsoKnownAs}. It governs ${house.theme}, and its natural significator is ${house.karaka}.`,
    sections: [
      {
        title: "What this house governs",
        body: `The ${house.sanskrit} covers ${house.theme}. In the natural zodiac it corresponds to ${house.naturalSign}, and its natural karaka is ${house.karaka} — the graha whose condition anywhere in the chart colours this area of life regardless of what sits in the house itself.`,
      },
      {
        title: "Structural class and why it matters",
        body: `The ${house.name.toLowerCase()} is ${house.alsoKnownAs}. That classification is not decorative: it determines how a benefic or malefic behaves here. Kendras give weight and duty, trikonas give fortune, dusthanas give friction that can convert into resilience, and upachayas improve with age.`,
      },
      {
        title: "Reading the house lord",
        body: `The occupant of a house shows tendency; the house lord shows outcome. To read the ${house.name.toLowerCase()} properly, find which sign falls on it for the given ascendant, locate that sign's lord, and judge that graha's dignity, house, and dasha. A strong lord placed well usually outweighs a difficult occupant.`,
      },
      {
        title: "When results appear",
        body: `Results for the ${house.name.toLowerCase()} surface during the mahadasha or antardasha of its lord, of planets placed in it, and of ${house.karaka} as natural karaka. Saturn and Jupiter transits over the house or its lord are the other common triggers, since those are the slow-moving grahas whose passage lasts long enough to register.`,
      },
      {
        title: "Divisional confirmation",
        body: `Before treating a ${house.name.toLowerCase()} reading as settled, confirm it in the relevant divisional chart. The D-9 Navamsa is the general strength test for any house; specific varga charts refine particular topics. A promise visible only in the rashi chart and absent from the vargas usually under-delivers.`,
      },
    ],
    facts: [
      { label: "Sanskrit name", value: house.sanskrit },
      { label: "House number", value: `${house.ordinal} of 12` },
      {
        label: "Classification",
        value: house.alsoKnownAs.replace(/^(both |a |an |the )/, ""),
      },
      {
        label: "Natural sign",
        value: `${house.naturalSign} (${house.ordinal}${house.ordinal === 1 ? "st" : house.ordinal === 2 ? "nd" : house.ordinal === 3 ? "rd" : "th"} sign)`,
      },
      { label: "Natural karaka", value: house.karaka },
      house.fact,
    ],
    faq: [
      {
        question: `What does the ${house.name.toLowerCase()} represent in Vedic astrology?`,
        answer: `The ${house.name.toLowerCase()}, or ${house.sanskrit}, governs ${house.theme}. It is ${house.alsoKnownAs}, and its natural significator is ${house.karaka}.`,
      },
      {
        question: `Which sign rules the ${house.name.toLowerCase()}?`,
        answer: `That depends on your ascendant. In the natural zodiac the ${house.name.toLowerCase()} corresponds to ${house.naturalSign}, but in an actual chart the sign on this house shifts with the rising sign — which is why an exact birth time matters.`,
      },
      {
        question: `What happens when a malefic sits in the ${house.name.toLowerCase()}?`,
        answer: `It depends on the house's class. The ${house.name.toLowerCase()} is ${house.alsoKnownAs}, so a malefic here ${house.kind === "upachaya" ? "typically converts friction into competence as the person ages" : house.kind === "dusthana" ? "may produce a viparita reversal in which difficulty becomes a source of later strength" : house.kind === "trikona" ? "is softened by the fortunate nature of the house, though effort is still required" : "adds duty and weight rather than ease"}. Confirm with the house lord's condition.`,
      },
      {
        question: `When do ${house.name.toLowerCase()} results show up?`,
        answer: `${house.name} results surface during the dasha of its lord, of any planet placed in it, or of its natural karaka ${house.karaka}. Slow transits of Saturn and Jupiter across the ${house.sanskrit} or its lord are the other reliable triggers.`,
      },
    ],
    primaryCta: { label: "Generate Free Kundali", to: "/free-kundali" },
    secondaryCta: { label: "Read Kundali Guide", to: "/kundali" },
    keywords: [
      "house",
      "bhava",
      "kundali",
      "vedic astrology",
      house.name.toLowerCase(),
      house.sanskrit.toLowerCase(),
    ],
    updated: SEO_CONTENT_REVIEWED,
  }),
);

function ordinal(n: number): string {
  const suffix =
    n % 100 >= 11 && n % 100 <= 13
      ? "th"
      : n % 10 === 1
        ? "st"
        : n % 10 === 2
          ? "nd"
          : n % 10 === 3
            ? "rd"
            : "th";
  return `${n}${suffix}`;
}

/**
 * Facts and page-specific Q&A for the hand-written core guides.
 *
 * Kept as a patch map rather than inlined into CORE_SEO_CONTENT_PAGES so the
 * prose above stays readable. Every number here is a classical or astronomical
 * constant that a reader can check independently — that verifiability is the
 * point, both for trust and because answer engines cite pages with concrete
 * figures far more readily than pages of pure assertion.
 */
const CORE_PAGE_ENRICHMENT: Record<
  string,
  { facts: SeoContentFact[]; faq: SeoContentFaq[] }
> = {
  kundali: {
    facts: [
      { label: "Houses in a Kundali", value: "12 bhavas of 30° each" },
      { label: "Grahas placed", value: "9 — seven planets plus Rahu and Ketu" },
      {
        label: "Required inputs",
        value: "Date, exact time, and place of birth",
      },
      {
        label: "Ayanamsa",
        value: "Lahiri (Chitrapaksha)",
        source: "The standard used by India's Rashtriya Panchang",
      },
    ],
    faq: [
      {
        question: "What is a Janam Kundali?",
        answer:
          "A Janam Kundali is a sidereal chart of the sky at your exact moment of birth, dividing it into 12 houses of 30° each and placing the nine grahas within them. It is calculated from date, exact time, and place — all three are required.",
      },
      {
        question: "Why does birth time matter so much for a Kundali?",
        answer:
          "The ascendant advances about one degree every four minutes and changes sign roughly every two hours. An inaccurate time shifts every house cusp, and most Vedic interpretation is house-based. Planetary signs and the Moon's Nakshatra survive a rough time; house analysis does not.",
      },
      {
        question:
          "What is the difference between a Kundali and a Western birth chart?",
        answer:
          "Both plot the same sky. Vedic charts use the sidereal zodiac with an ayanamsa correction of roughly 24°, while Western charts use the tropical zodiac. That offset means your Vedic Sun sign is usually the one before your Western sign. Vedic also adds dashas, Nakshatras, and divisional charts.",
      },
      {
        question: "Is a free Kundali as accurate as a paid one?",
        answer:
          "For calculation, yes — the mathematics is deterministic and does not improve with payment. What paid readings add is interpretation and synthesis. AstroYou generates the full chart, Nakshatra, and dasha sequence free.",
      },
    ],
  },
  "kundali-matching": {
    facts: [
      { label: "Ashtakoot total", value: "36 points across 8 kootas" },
      { label: "Highest-weighted koota", value: "Nadi, at 8 points" },
      {
        label: "Commonly cited threshold",
        value: "18 of 36",
        source: "A convention, not a rule from classical texts",
      },
      {
        label: "Nakshatra-derived points",
        value: "21 of 36",
        source: "Nadi, Bhakoot, and Gana combined",
      },
    ],
    faq: [
      {
        question: "What is a good Guna Milan score?",
        answer:
          "18 out of 36 is the commonly cited minimum, but that threshold is convention rather than a rule from the classical texts. Scores above 18 are considered workable and above 25 favourable. A low score with strong dasha compatibility and a well-placed 7th house often reads better than a high score without them.",
      },
      {
        question: "What are the 8 kootas in Ashtakoot matching?",
        answer:
          "Varna (1 point), Vashya (2), Tara (3), Yoni (4), Graha Maitri (5), Gana (6), Bhakoot (7), and Nadi (8) — totalling 36. Nadi carries the most weight, and Nadi dosha is the most common reason for a sharp score drop.",
      },
      {
        question: "Can a marriage work with a low Guna Milan score?",
        answer:
          "Yes. Guna Milan measures a specific set of Moon-based compatibilities and ignores dasha timing, the 7th house condition, Venus and Jupiter placement, and everything non-astrological. Treat a low score as a prompt for closer analysis, not a verdict.",
      },
      {
        question: "Is Nadi dosha a serious problem?",
        answer:
          "It is the heaviest single deduction at 8 points, but classical texts also list several cancellation conditions — same rashi with different Nakshatras, or the same Nakshatra with different padas, among others. Check for cancellation before treating it as disqualifying.",
      },
    ],
  },
  "daily-horoscope": {
    facts: [
      { label: "Signs covered", value: "12 rashis of 30° each" },
      { label: "Moon's transit speed", value: "About 2.25 days per sign" },
      {
        label: "Basis",
        value: "Moon sign (Janma Rashi), not Sun sign",
        source: "Standard Vedic practice",
      },
    ],
    faq: [
      {
        question: "Should I read my daily horoscope by Sun sign or Moon sign?",
        answer:
          "Moon sign, in Vedic practice. The Moon governs the mind and moves through a sign in about 2.25 days, making it the faster and more relevant indicator for daily guidance. Your Vedic Moon sign is usually different from the Sun sign you know from Western horoscopes.",
      },
      {
        question: "How accurate are daily horoscopes?",
        answer:
          "A sign-based horoscope applies to roughly a twelfth of the population, so it can only describe general transit weather. It cannot account for your ascendant, dasha period, or house placements. Useful as a mood indicator; not a substitute for chart-based timing.",
      },
      {
        question: "Why is my Vedic sign different from my Western sign?",
        answer:
          "Vedic astrology uses the sidereal zodiac, corrected by an ayanamsa of roughly 24°. Western astrology uses the tropical zodiac. That offset shifts most people back one sign — a tropical Leo is usually a sidereal Cancer.",
      },
      {
        question: "What's more reliable than a daily horoscope?",
        answer:
          "Your current mahadasha and antardasha, plus transits of Saturn and Jupiter over your natal points. These operate on timescales of months to years and are specific to your chart rather than to a twelfth of the world.",
      },
    ],
  },
  "sade-sati": {
    facts: [
      { label: "Total duration", value: "7.5 years" },
      { label: "Phases", value: "3, of 2.5 years each" },
      {
        label: "Saturn's sidereal period",
        value: "29.5 years",
        source: "Sets the recurrence interval",
      },
      { label: "Typical occurrences in a life", value: "2 to 3" },
    ],
    faq: [
      {
        question: "What is Sade Sati?",
        answer:
          "Sade Sati is the 7.5-year period during which Saturn transits the sign before your Moon sign, your Moon sign itself, and the sign after. It divides into three phases of about 2.5 years each, corresponding to Saturn's roughly 2.5-year transit through one sign.",
      },
      {
        question: "How often does Sade Sati occur?",
        answer:
          "Roughly every 29.5 years, matching Saturn's sidereal orbital period. Most people experience it two or three times in a lifetime — typically in their twenties, fifties, and eighties, depending on their Moon sign.",
      },
      {
        question: "Is Sade Sati always bad?",
        answer:
          "No. It is a period of pressure and consolidation rather than misfortune. The classical reading is that Saturn removes what was not built properly. People with strong Saturn placements, or with Saturn as a functional benefic for their ascendant, often report it as a productive period.",
      },
      {
        question: "Which phase of Sade Sati is hardest?",
        answer:
          "Traditionally the second, when Saturn transits your Moon sign directly, because it presses on the mind and emotional baseline. The first phase tends to affect finances and family, the third affects health and expenditure. Individual results depend on Saturn's natal condition.",
      },
    ],
  },
  manglik: {
    facts: [
      {
        label: "Houses that create the dosha",
        value: "1st, 2nd, 4th, 7th, 8th, and 12th",
      },
      { label: "Karaka involved", value: "Mars (Mangal)" },
      {
        label: "Ashtakoot weight",
        value: "Assessed separately from the 36 points",
        source: "Mangal Dosha is not one of the 8 kootas",
      },
    ],
    faq: [
      {
        question: "What makes a person Manglik?",
        answer:
          "Mars placed in the 1st, 2nd, 4th, 7th, 8th, or 12th house from the ascendant — and in some traditions, counted from the Moon or Venus as well. Which reference point is used varies by school, which is one reason two astrologers can disagree on whether the same person is Manglik.",
      },
      {
        question: "Is Manglik Dosha cancelled in some charts?",
        answer:
          "Yes, and cancellation conditions are numerous — Mars in its own or exaltation sign, Mars aspected by Jupiter, both partners being Manglik, Mars in certain signs regardless of house, and age-based mitigation after 28 in some traditions. Cancellation is common enough that an uncancelled dosha should be confirmed carefully.",
      },
      {
        question: "Can a Manglik marry a non-Manglik?",
        answer:
          "Yes. The traditional concern is specific — Mars affecting the 7th house area of life — and it is one factor among many. The 7th house lord's condition, Venus, Jupiter, and dasha timing all bear on marriage more comprehensively than a single Mars placement.",
      },
      {
        question: "Is Mangal Dosha part of the 36-point Guna Milan score?",
        answer:
          "No. Ashtakoot Guna Milan scores eight Moon-based kootas totalling 36 points; Mangal Dosha is assessed separately from Mars's house position. A chart can score well on Guna Milan and still carry Mangal Dosha, or the reverse.",
      },
    ],
  },
  nakshatra: {
    facts: [
      { label: "Number of Nakshatras", value: "27" },
      { label: "Span of each", value: "13°20'" },
      { label: "Padas per Nakshatra", value: "4, of 3°20' each" },
      { label: "Moon's crossing time", value: "About one day per Nakshatra" },
    ],
    faq: [
      {
        question: "What is a Nakshatra?",
        answer:
          "A Nakshatra is one of 27 lunar mansions dividing the sidereal zodiac into segments of 13°20' each. Your birth Nakshatra is determined by the Moon's position at birth, and it sets your starting point in the Vimshottari dasha sequence.",
      },
      {
        question: "How is a Nakshatra different from a zodiac sign?",
        answer:
          "Signs divide the zodiac into 12 segments of 30°; Nakshatras divide the same circle into 27 segments of 13°20'. Nakshatras are finer-grained and are read from the Moon, which is why they carry more weight in Vedic practice than the Sun sign does.",
      },
      {
        question: "What is a Nakshatra pada?",
        answer:
          "Each Nakshatra divides into four padas of 3°20'. Each pada maps to a different Navamsa sign, so two people born under the same Nakshatra on the same day can read differently. Pada is what links the Nakshatra to the D-9 chart.",
      },
      {
        question: "Why do Nakshatras matter for marriage matching?",
        answer:
          "Because Nadi, Bhakoot, and Gana — three Nakshatra-derived kootas — account for 21 of the 36 points in Ashtakoot Guna Milan. That is well over half the score, which is why Nakshatra compatibility dominates traditional matching.",
      },
    ],
  },
  planet: {
    facts: [
      {
        label: "Grahas in Jyotish",
        value: "9 — seven planets plus two lunar nodes",
      },
      { label: "Total dasha cycle", value: "120 years" },
      { label: "Longest mahadasha", value: "Venus, 20 years" },
      { label: "Shortest mahadasha", value: "Sun, 6 years" },
    ],
    faq: [
      {
        question: "How many planets are there in Vedic astrology?",
        answer:
          "Nine grahas: Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, and the two lunar nodes Rahu and Ketu. Uranus, Neptune, and Pluto are not used in classical Jyotish. Rahu and Ketu are shadow points rather than physical bodies.",
      },
      {
        question: "Which planets are benefic and which are malefic?",
        answer:
          "Naturally: Jupiter, Venus, and a waxing Moon are benefic; Sun, Mars, Saturn, Rahu, and Ketu are malefic; Mercury takes the character of its company. But functional nature depends on the ascendant — a natural malefic can be the most helpful graha in a chart if it lords the right houses.",
      },
      {
        question: "What are Rahu and Ketu?",
        answer:
          "The two points where the Moon's orbit crosses the ecliptic — the north and south lunar nodes, always exactly 180° apart. They have no physical body, own no sign in most traditions, and borrow their behaviour from their dispositor and their house.",
      },
      {
        question: "How long do planetary periods last?",
        answer:
          "The Vimshottari cycle totals 120 years: Venus 20, Saturn 19, Rahu 18, Mercury 17, Jupiter 16, Moon 10, Mars 7, Ketu 7, Sun 6. Which one you are in depends on your Moon's Nakshatra at birth.",
      },
    ],
  },
  "planet-in-house": {
    facts: [
      {
        label: "Possible combinations",
        value: "108 — 9 grahas across 12 bhavas",
      },
      {
        label: "Universal aspect",
        value: "Every graha aspects its own 7th house",
      },
      {
        label: "Special aspects",
        value: "Mars 4/7/8, Jupiter 5/7/9, Saturn 3/7/10",
      },
    ],
    faq: [
      {
        question: "How many planet-in-house combinations are there?",
        answer:
          "108 — nine grahas across twelve bhavas. Each reads differently depending on the graha's natural benefic or malefic character crossed with the house's structural class (kendra, trikona, dusthana, or upachaya).",
      },
      {
        question: "Does the house or the sign matter more?",
        answer:
          "Both, and they answer different questions. The house says which area of life is involved; the sign says how strongly the graha can act there. A planet in a favourable house but a debilitated sign promises more than it delivers.",
      },
      {
        question:
          "What is more important — the planet in a house, or the house lord?",
        answer:
          "Generally the house lord. The occupant shows tendency and flavour; the lord shows outcome. A house with a difficult occupant but a strong, well-placed lord usually delivers better than the reverse.",
      },
      {
        question: "Do planets affect houses they are not in?",
        answer:
          "Yes, through drishti. Every graha aspects its own 7th house. Mars additionally aspects the 4th and 8th, Jupiter the 5th and 9th, and Saturn the 3rd and 10th. When judging a house, count aspects onto it as well as occupants.",
      },
    ],
  },
  house: {
    facts: [
      { label: "Houses in a chart", value: "12 bhavas of 30° each" },
      { label: "Kendras (angles)", value: "1st, 4th, 7th, 10th" },
      { label: "Trikonas (trines)", value: "1st, 5th, 9th" },
      { label: "Dusthanas", value: "6th, 8th, 12th" },
      { label: "Upachayas", value: "3rd, 6th, 10th, 11th" },
    ],
    faq: [
      {
        question: "What are the 12 houses in Vedic astrology?",
        answer:
          "Tanu (self), Dhana (wealth), Sahaja (courage), Sukha (home), Putra (children), Ari (obstacles), Kalatra (partnership), Ayur (longevity), Bhagya (fortune), Karma (career), Labha (gains), and Vyaya (loss and release).",
      },
      {
        question: "What is the difference between kendra and trikona houses?",
        answer:
          "Kendras — the 1st, 4th, 7th, and 10th — are the angles, giving weight, structure, and duty. Trikonas — the 1st, 5th, and 9th — are the trines, giving fortune and merit. The 1st house is both, which is why its lord is uniquely benefic for any ascendant.",
      },
      {
        question: "Are the 6th, 8th, and 12th houses always bad?",
        answer:
          "No. They are dusthanas, meaning they deal with difficulty, but the 6th is also an upachaya where malefics improve with age, and malefics in dusthanas can produce viparita raja yoga — a reversal where difficulty becomes the source of later strength.",
      },
      {
        question: "How do I know which sign rules which house in my chart?",
        answer:
          "It depends entirely on your ascendant, which is set by your exact birth time. The ascendant sign occupies the 1st house and the remaining signs follow in order. This is why two people born the same day can have completely different house readings.",
      },
    ],
  },
  dasha: {
    facts: [
      { label: "Vimshottari total", value: "120 years" },
      { label: "Number of mahadashas", value: "9" },
      {
        label: "Starting point",
        value: "Set by the Moon's Nakshatra at birth",
      },
      {
        label: "Sub-period levels",
        value: "5 — maha, antar, pratyantar, sookshma, prana",
      },
    ],
    faq: [
      {
        question: "What is a Mahadasha?",
        answer:
          "A mahadasha is a major planetary period in the Vimshottari system, ranging from 6 years (Sun) to 20 years (Venus) and totalling 120 years across all nine grahas. The graha ruling your mahadasha sets the dominant theme of that stretch of life.",
      },
      {
        question: "How is my starting Dasha determined?",
        answer:
          "By the Moon's Nakshatra at birth. Each Nakshatra is ruled by a graha, and you begin life in that graha's mahadasha — already partly elapsed, in proportion to how far the Moon had travelled through the Nakshatra.",
      },
      {
        question: "What is an Antardasha?",
        answer:
          "A sub-period within a mahadasha. Each mahadasha subdivides into nine antardashas in the same planetary order, proportional to their dasha lengths. The combination of mahadasha and antardasha lords is what most timing work actually reads.",
      },
      {
        question: "Is Vimshottari the only dasha system?",
        answer:
          "No, but it is the most widely used. Ashtottari, Yogini, Chara, and Kalachakra dashas exist and are applied in specific conditions or lineages. Most practitioners read Vimshottari first and consult others for confirmation.",
      },
    ],
  },
  "moon-sign-calculator": {
    facts: [
      { label: "Moon's transit speed", value: "About 2.25 days per rashi" },
      { label: "Full zodiac cycle", value: "27.3 days" },
      {
        label: "Required inputs",
        value: "Date, exact time, and place of birth",
      },
    ],
    faq: [
      {
        question: "What is my Moon sign or Janma Rashi?",
        answer:
          "The sidereal sign the Moon occupied at your birth. Because the Moon moves through a sign in about 2.25 days, calculating it needs your date, time, and place — not just your birthday.",
      },
      {
        question:
          "Is the Moon sign more important than the Sun sign in Vedic astrology?",
        answer:
          "Yes. Vedic practice reads daily guidance, dasha sequence, and marriage compatibility primarily from the Moon. The Moon governs manas — mind and emotion — which is what most predictive work concerns.",
      },
      {
        question: "Why is my Vedic Moon sign different from what I expected?",
        answer:
          "Vedic astrology uses the sidereal zodiac with an ayanamsa correction of roughly 24°, while Western astrology uses the tropical zodiac. That offset commonly shifts a placement back by one sign.",
      },
      {
        question: "Do I need my exact birth time for a Moon sign?",
        answer:
          "Not always, but often. The Moon changes sign every 2.25 days, so if you were born near a boundary the time matters. If not, the date and place are usually enough.",
      },
    ],
  },
  "nakshatra-finder": {
    facts: [
      { label: "Nakshatras", value: "27, each 13°20' wide" },
      { label: "Padas", value: "4 per Nakshatra, 3°20' each" },
      {
        label: "Determined by",
        value: "The Moon's sidereal longitude at birth",
      },
    ],
    faq: [
      {
        question: "How do I find my birth Nakshatra?",
        answer:
          "From the Moon's sidereal longitude at your moment of birth. Divide the 360° zodiac into 27 segments of 13°20'; whichever contains your Moon is your birth star. You need date, exact time, and place.",
      },
      {
        question: "What is my Nakshatra pada?",
        answer:
          "The quarter of your Nakshatra your Moon falls in — each pada is 3°20'. The pada determines your Navamsa placement, which is why it matters for marriage matching and for reading chart strength.",
      },
      {
        question: "Can I find my Nakshatra without a birth time?",
        answer:
          "Approximately. The Moon crosses one Nakshatra in about a day, so a date alone narrows it to one or two candidates. Pada, however, needs the time — a pada lasts roughly six hours.",
      },
      {
        question: "What does my Nakshatra determine?",
        answer:
          "Your starting mahadasha in the Vimshottari sequence, your naming syllables in traditional practice, and a large share of your marriage compatibility score — Nakshatra-derived kootas contribute 21 of Guna Milan's 36 points.",
      },
    ],
  },
  "sade-sati-calculator": {
    facts: [
      { label: "Duration", value: "7.5 years across 3 phases" },
      { label: "Saturn per sign", value: "About 2.5 years" },
      { label: "Calculated from", value: "Your Moon sign, not your Sun sign" },
    ],
    faq: [
      {
        question: "How is Sade Sati calculated?",
        answer:
          "From your Moon sign. Sade Sati runs while Saturn transits the sign before your Moon sign, your Moon sign, and the sign after — three signs at roughly 2.5 years each, totalling 7.5 years.",
      },
      {
        question: "Am I in Sade Sati right now?",
        answer:
          "You are if Saturn currently occupies your Moon sign or either adjacent sign. Because it depends on your Janma Rashi, you need your Moon sign first — which requires date, exact time, and place of birth.",
      },
      {
        question: "How long until my next Sade Sati?",
        answer:
          "Saturn returns to the same position roughly every 29.5 years, so Sade Sati recurs on approximately that cycle. Most people go through it two or three times.",
      },
      {
        question: "What should I actually do during Sade Sati?",
        answer:
          "Classical guidance is structural rather than ritual: reduce overcommitment, finish outstanding obligations, maintain health routines, and avoid speculative risk. Saturday service and Shani or Hanuman practice are the traditional supports. Nothing here requires expensive remedies.",
      },
    ],
  },
  "manglik-dosha-checker": {
    facts: [
      { label: "Dosha-forming houses", value: "1st, 2nd, 4th, 7th, 8th, 12th" },
      {
        label: "Reference points used",
        value: "Ascendant, Moon, and Venus, varying by school",
      },
      { label: "Graha involved", value: "Mars (Mangal)" },
    ],
    faq: [
      {
        question: "How do I check if I am Manglik?",
        answer:
          "Find Mars's house position from your ascendant. If it occupies the 1st, 2nd, 4th, 7th, 8th, or 12th house, the dosha is indicated. Some traditions also count from the Moon and from Venus, which is why results can differ between sources.",
      },
      {
        question: "Why do different sites give different Manglik results?",
        answer:
          "Because schools differ on the reference point — ascendant only, or ascendant plus Moon, or all three including Venus — and on which cancellation rules apply. The underlying calculation is identical; the interpretive convention is not.",
      },
      {
        question: "What cancels Manglik Dosha?",
        answer:
          "Common cancellations include Mars in its own sign or exaltation, Jupiter's aspect on Mars, both partners carrying the dosha, and Mars in specific signs regardless of house. Cancellation is common enough that an uncancelled dosha warrants a careful second look.",
      },
      {
        question: "Does Manglik Dosha affect the Guna Milan score?",
        answer:
          "No. Guna Milan scores eight Moon-based kootas out of 36; Mangal Dosha is assessed separately. A pair can score well on Guna Milan and still show Mangal Dosha, or the reverse.",
      },
    ],
  },
  "dasha-calculator": {
    facts: [
      { label: "Vimshottari cycle", value: "120 years across 9 grahas" },
      {
        label: "Starting dasha",
        value: "Set by the Moon's Nakshatra at birth",
      },
      {
        label: "Required inputs",
        value: "Date, exact time, and place of birth",
      },
    ],
    faq: [
      {
        question: "How do I calculate my current Mahadasha?",
        answer:
          "Find your Moon's Nakshatra at birth, which sets the starting graha and how much of that period had already elapsed. From there the nine mahadashas run in fixed Vimshottari order for a 120-year total. AstroYou computes the full sequence free.",
      },
      {
        question: "What is my current Antardasha?",
        answer:
          "The sub-period running inside your mahadasha. Each mahadasha divides into nine antardashas in the same planetary order, proportional to their lengths. Most practical timing reads the mahadasha and antardasha lords together.",
      },
      {
        question: "Do I need my exact birth time for a dasha calculation?",
        answer:
          "Yes, for precision. The Moon moves about 13° per day, so an hour's error shifts the balance of your starting dasha by weeks or months — enough to misdate a period transition.",
      },
      {
        question: "Which dasha period is the best?",
        answer:
          "There is no universally good period. A mahadasha is favourable when its lord is well placed and lords good houses for your ascendant. The same Saturn mahadasha can be the most productive stretch of one life and the hardest of another.",
      },
    ],
  },
  "panchang-today": {
    facts: [
      {
        label: "Panchang limbs",
        value: "5 — tithi, nakshatra, yoga, karana, vara",
      },
      { label: "Tithis in a lunar month", value: "30" },
      { label: "Rahu Kaal duration", value: "About 90 minutes daily" },
      {
        label: "Location dependence",
        value: "Values shift with sunrise, so they are city-specific",
      },
    ],
    faq: [
      {
        question: "What are the five limbs of Panchang?",
        answer:
          "Tithi (lunar day), Nakshatra (lunar mansion), Yoga (Sun-Moon combination), Karana (half-tithi), and Vara (weekday). Panchang literally means 'five limbs'. Together they describe the quality of a given day.",
      },
      {
        question: "What is Rahu Kaal?",
        answer:
          "An inauspicious window of roughly 90 minutes that occurs daily, its timing set by the weekday and by local sunrise and sunset. Traditional practice avoids starting new ventures during it. Because it is derived from sunrise, it differs by city.",
      },
      {
        question: "Why does Panchang differ between cities?",
        answer:
          "Because tithi, Rahu Kaal, and muhurat windows are calculated from local sunrise and sunset. A Panchang computed for Delhi does not apply precisely in Chennai. Always check the location a Panchang was generated for.",
      },
      {
        question: "What is Abhijit Muhurat?",
        answer:
          "A roughly 48-minute auspicious window around local solar noon, considered favourable for most activities. It is one of the few muhurats available every day, which makes it a practical default when a specific auspicious window cannot be found.",
      },
    ],
  },
  "kaal-sarp-dosha": {
    facts: [
      { label: "Condition", value: "All 7 planets between Rahu and Ketu" },
      { label: "Named types", value: "12, one per axis position" },
      { label: "Nodal axis", value: "Rahu and Ketu always 180° apart" },
      {
        label: "Classical status",
        value: "Not found in Brihat Parashara Hora Shastra",
        source: "A later addition to the tradition",
      },
    ],
    faq: [
      {
        question: "What is Kaal Sarp Dosha?",
        answer:
          "A configuration in which all seven planets fall on one side of the Rahu-Ketu axis, leaving the other half of the chart empty. Twelve named variants exist depending on which houses the nodes occupy.",
      },
      {
        question: "Is Kaal Sarp Dosha mentioned in classical texts?",
        answer:
          "Not in Brihat Parashara Hora Shastra, the foundational text for most of what is practised as Vedic astrology. It appears in later material. This is worth knowing, because it is one of the doshas most heavily used to sell expensive remedies.",
      },
      {
        question: "How serious is Kaal Sarp Dosha?",
        answer:
          "Contested. Many practitioners read it as a pattern of delayed results and concentrated effort rather than misfortune, and it is common enough in the population that a purely negative reading is hard to sustain. Check the rest of the chart before treating it as significant.",
      },
      {
        question: "What remedies are suggested for Kaal Sarp Dosha?",
        answer:
          "Traditional suggestions centre on Rahu and Ketu practice, Shiva worship, and Nag Panchami observance. Be cautious with anyone prescribing costly rituals on the strength of this dosha alone — its classical footing is weaker than its commercial prominence suggests.",
      },
    ],
  },
  "love-compatibility": {
    facts: [
      { label: "Ashtakoot total", value: "36 points across 8 kootas" },
      { label: "Primary relationship house", value: "7th (Kalatra Bhava)" },
      {
        label: "Relationship karaka",
        value: "Venus for men's charts, Jupiter for women's",
        source: "Classical convention",
      },
    ],
    faq: [
      {
        question: "How does Vedic astrology assess love compatibility?",
        answer:
          "Through several layers: Ashtakoot Guna Milan scoring 36 points across eight Moon-based kootas, the condition of both 7th houses and their lords, Venus and Jupiter placement, Mangal Dosha, and whether the two dasha timelines align.",
      },
      {
        question: "Is Guna Milan enough to judge a relationship?",
        answer:
          "No. It measures a specific set of Moon-based compatibilities and says nothing about dasha timing, the 7th house, or emotional maturity. It is a useful filter and a poor verdict.",
      },
      {
        question: "Which house governs relationships in a birth chart?",
        answer:
          "The 7th house, Kalatra Bhava, covers marriage and partnership. The 5th governs romance and attraction, and the 2nd governs family life after marriage. A full compatibility reading looks at all three.",
      },
      {
        question: "Can astrology predict if a relationship will last?",
        answer:
          "It can identify timing pressures and structural tensions — difficult dasha overlaps, an afflicted 7th house, incompatible temperaments by Moon sign. It cannot account for how two people actually behave. Treat it as one input among several.",
      },
    ],
  },
  "vedic-astrology": {
    facts: [
      {
        label: "Zodiac used",
        value: "Sidereal, with an ayanamsa correction of about 24°",
      },
      { label: "Grahas", value: "9" },
      { label: "Nakshatras", value: "27" },
      { label: "Primary dasha system", value: "Vimshottari, 120 years" },
      { label: "Foundational text", value: "Brihat Parashara Hora Shastra" },
    ],
    faq: [
      {
        question: "What is Vedic astrology?",
        answer:
          "Jyotish, the Indian astrological tradition, which uses the sidereal zodiac corrected by an ayanamsa of roughly 24°, nine grahas, twelve houses, twenty-seven Nakshatras, and planetary period systems — primarily the 120-year Vimshottari dasha — for timing.",
      },
      {
        question: "How is Vedic astrology different from Western astrology?",
        answer:
          "Three main differences: Vedic uses the sidereal zodiac while Western uses the tropical, which offsets most placements by a sign; Vedic adds Nakshatras and divisional charts; and Vedic uses dasha systems for timing where Western relies mainly on transits and progressions.",
      },
      {
        question: "Which text is Vedic astrology based on?",
        answer:
          "Brihat Parashara Hora Shastra is the principal reference for houses, yogas, and the Vimshottari dasha. Jaimini Sutras, Phaladeepika, and Saravali are other widely used classical sources. Later material exists but carries less authority.",
      },
      {
        question: "Is Vedic astrology scientific?",
        answer:
          "The astronomical calculations are — planetary positions, ayanamsa correction, and dasha arithmetic are precise and verifiable. The interpretive layer is not empirically validated and should be approached as a framework for reflection rather than as prediction. Treat any source claiming proven predictive accuracy with caution.",
      },
    ],
  },
  "gemstone-remedies": {
    facts: [
      {
        label: "Classical remedy order",
        value: "Behaviour, mantra, service, charity, then gemstone",
      },
      {
        label: "Gemstone effect",
        value: "Amplifies a graha rather than correcting it",
      },
      {
        label: "Risk",
        value: "Strengthening an afflicted graha can intensify the problem",
      },
    ],
    faq: [
      {
        question: "Do gemstones actually work in Vedic astrology?",
        answer:
          "Classical texts place gemstones last in the remedy sequence, after behaviour, mantra, service, and charity. The stated mechanism is amplification of a graha's effect — which is why prescribing one for an afflicted planet can make its difficulty louder rather than quieter.",
      },
      {
        question: "What is the correct order of Vedic remedies?",
        answer:
          "Behavioural change first, then mantra and discipline, then service and charity aligned to the graha, and only then material remedies like gemstones. The first four carry no financial or astrological downside, which is why they come first.",
      },
      {
        question: "Should I buy a gemstone recommended online?",
        answer:
          "Not without a full chart reading from someone who explains which graha it strengthens and why strengthening is appropriate. Gemstone recommendation is the most commonly monetised remedy in the market and the easiest to prescribe without justification.",
      },
      {
        question: "What are low-risk remedies?",
        answer:
          "Mantra recitation, weekday observance, fasting, donation, and service aligned to the relevant graha. They cost nothing, cannot backfire, and are what classical texts emphasise most. Start there.",
      },
    ],
  },
  "business-muhurat": {
    facts: [
      {
        label: "Panchang limbs checked",
        value: "5 — tithi, nakshatra, yoga, karana, vara",
      },
      {
        label: "Rahu Kaal",
        value: "About 90 minutes daily, avoided for new starts",
      },
      {
        label: "Abhijit Muhurat",
        value: "About 48 minutes around local solar noon",
      },
    ],
    faq: [
      {
        question: "How do I choose an auspicious time to start a business?",
        answer:
          "Filter on Panchang first — favourable tithi and nakshatra, weekday suited to the activity, avoiding Rahu Kaal — then check your own dasha and the 10th and 11th house condition. Abhijit Muhurat is a reasonable default when nothing better is available.",
      },
      {
        question: "Which Nakshatras are considered good for business?",
        answer:
          "Traditionally the fixed and movable Nakshatras suit different activities — fixed ones like Rohini and Uttara Phalguni for lasting establishment, movable ones for trade and travel-linked work. Match the Nakshatra's character to what you are actually starting.",
      },
      {
        question: "Does Muhurat matter more than the business plan?",
        answer:
          "No, and any practitioner suggesting otherwise is overselling. Muhurat is a timing filter applied to a decision you have already made on practical grounds. It cannot substitute for capital, demand, or competence.",
      },
      {
        question: "Should I avoid Rahu Kaal for a business launch?",
        answer:
          "Traditional practice avoids it for beginnings. It runs about 90 minutes daily, with timing set by the weekday and local sunrise, so it differs by city. Avoiding it is cheap and requires no expert input.",
      },
    ],
  },
  "property-muhurat": {
    facts: [
      { label: "Primary house", value: "4th (Sukha Bhava)" },
      {
        label: "Karakas involved",
        value: "Mars for land, Venus for comfort, Saturn for structure",
      },
      {
        label: "Panchang filters",
        value: "Tithi, nakshatra, weekday, and Rahu Kaal",
      },
    ],
    faq: [
      {
        question: "What is the best Muhurat for buying property?",
        answer:
          "A day with a favourable tithi and nakshatra, outside Rahu Kaal, with your own 4th house and its lord unafflicted by transit. Registration and griha pravesh are usually timed separately from the agreement itself.",
      },
      {
        question: "Which house governs property in a Kundali?",
        answer:
          "The 4th house, Sukha Bhava, covers home, land, and vehicles. Mars is the natural karaka for land specifically, Venus for comfort and vehicles, and Saturn for built structure.",
      },
      {
        question: "Is there a good Muhurat for griha pravesh?",
        answer:
          "Traditionally yes, and it is timed separately from purchase or registration. Standard practice checks tithi, nakshatra, weekday, and avoids Rahu Kaal, with additional attention to the lunar month.",
      },
      {
        question: "Does Muhurat matter for a property already bought?",
        answer:
          "Less than for the purchase itself. Griha pravesh timing is the remaining decision. Due diligence on title and structure matters considerably more than any timing choice.",
      },
    ],
  },
  "marriage-muhurat": {
    facts: [
      { label: "Charts consulted", value: "Both partners' Kundalis" },
      { label: "Primary house", value: "7th (Kalatra Bhava)" },
      {
        label: "Panchang filters",
        value: "Tithi, nakshatra, weekday, and lunar month",
      },
      {
        label: "Commonly avoided",
        value: "Chaturmas and certain lunar months",
        source: "Regional practice varies",
      },
    ],
    faq: [
      {
        question: "How is a wedding Muhurat chosen?",
        answer:
          "By filtering Panchang for favourable tithi, nakshatra, weekday, and lunar month, avoiding Rahu Kaal, then checking both partners' dashas and the condition of both 7th houses. Family logistics realistically constrain the search as much as astrology does.",
      },
      {
        question: "Which months are avoided for marriage in Vedic tradition?",
        answer:
          "Practice varies by region, but Chaturmas — the four-month period when Vishnu is traditionally held to be resting — is widely avoided, as are certain lunar months and periods when Venus or Jupiter are combust. Regional and community convention differs.",
      },
      {
        question: "Do both partners' charts matter for the Muhurat?",
        answer:
          "Yes. A date favourable in one chart and difficult in the other defeats the purpose. Both dasha periods and both 7th houses should be checked before fixing a date.",
      },
      {
        question: "Can a good Muhurat fix an incompatible match?",
        answer:
          "No. Muhurat times an event; it does not alter the underlying compatibility. Matching and honest family alignment come first — the date is chosen after, not instead.",
      },
    ],
  },
  "baby-name-astrology": {
    facts: [
      { label: "Syllables per Nakshatra", value: "4, one per pada" },
      { label: "Nakshatras", value: "27, giving 108 naming syllables" },
      {
        label: "Determined by",
        value: "The Moon's Nakshatra and pada at birth",
      },
    ],
    faq: [
      {
        question: "How is a baby's name chosen in Vedic astrology?",
        answer:
          "From the birth Nakshatra and pada. Each of the 27 Nakshatras has four padas, each associated with a starting syllable — 108 in total. The child's Moon position at birth identifies which syllable traditionally begins the name.",
      },
      {
        question: "What is a Rashi name?",
        answer:
          "A name beginning with the syllable indicated by the birth Nakshatra pada, sometimes kept privately for ritual use alongside a different everyday name. The practice varies by family and region.",
      },
      {
        question: "Do I need the exact birth time to find the naming syllable?",
        answer:
          "Yes. The pada — a quarter of a Nakshatra — lasts roughly six hours, and the syllable is pada-specific. Without the time you can narrow it to a Nakshatra but not to a single syllable.",
      },
      {
        question: "Must a name follow the Nakshatra syllable?",
        answer:
          "It is tradition, not obligation. A name the child can carry easily, with a meaning the family values, matters more in practice. Many families use the syllable for a ritual name and choose the everyday name freely.",
      },
    ],
  },
  "lucky-mobile-number": {
    facts: [
      { label: "Method", value: "Digit reduction to a root number, 1 to 9" },
      {
        label: "Classical basis",
        value: "Not part of Jyotish",
        source: "Numerology is a separate system with its own lineage",
      },
      {
        label: "Chart-based alternative",
        value: "Vimshottari dasha, a 120-year cycle",
        source: "Calculated from verifiable planetary positions",
      },
    ],
    faq: [
      {
        question: "How is a lucky mobile number calculated?",
        answer:
          "By reducing the digits to a single root number between 1 and 9 and reading repeated patterns or missing digits. Different numerology schools assign different meanings to the same root, which is worth knowing before treating any single reading as authoritative.",
      },
      {
        question: "Is mobile number numerology part of Vedic astrology?",
        answer:
          "No. Numerology is a separate system with its own lineage. It is often sold alongside Jyotish, but it does not appear in the classical astrological texts and does not draw on your birth chart unless a practitioner deliberately combines them.",
      },
      {
        question: "Can changing my mobile number change my luck?",
        answer:
          "There is no basis for expecting it to. If a number bothers you, changing it costs little and may help how you feel — but treat anyone charging significantly for a number recommendation with scepticism.",
      },
      {
        question: "What is more reliable than number numerology?",
        answer:
          "Your birth chart and current dasha, which are calculated from verifiable astronomical positions rather than from digit arithmetic. If you want a timing signal, start there.",
      },
    ],
  },
};

/** Apply enrichment and the editorial review date to the core guides. */
const ENRICHED_CORE_SEO_CONTENT_PAGES: SeoContentPage[] =
  CORE_SEO_CONTENT_PAGES.map((page) => ({
    ...page,
    updated: page.updated ?? SEO_CONTENT_REVIEWED,
    ...(CORE_PAGE_ENRICHMENT[page.slug] ?? {}),
  }));

/**
 * Comparison pages. Comparison content is the single highest-cited format in
 * AI answer engines, and it is also the format most easily written unfairly.
 * The rule applied here: state only what is verifiable about other products
 * (their model, not invented numbers), state AstroYou's own figures exactly,
 * and name the cases where a competitor is the better choice. An obviously
 * one-sided comparison gets discounted by answer engines and by readers.
 */
const COMPARISON_SEO_CONTENT_PAGES: SeoContentPage[] = [
  {
    slug: "ai-astrologer-vs-human-astrologer",
    path: "/ai-astrologer-vs-human-astrologer",
    title:
      "AI Astrologer vs Human Astrologer: What Each One Is Actually Good At",
    description:
      "An honest comparison of AI and human astrologers across accuracy, cost, availability, memory, and emotional judgement — including where a human is clearly the better choice.",
    heading: "AI Astrologer vs Human Astrologer",
    intro:
      "Both read the same chart. The difference is not accuracy of calculation — software has computed planetary positions more precisely than any human for decades — but what happens after the calculation: interpretation, memory, availability, and judgement about when astrology is the wrong tool entirely.",
    schemaType: "Article",
    sections: [
      {
        title: "Where the two are equivalent",
        body: "Chart calculation is solved. Ephemeris data, ayanamsa correction, house division, dasha arithmetic, and Ashtakoot scoring are deterministic. A competent human astrologer and any serious software will produce the same Kundali from the same birth data. Anyone claiming an accuracy edge at the calculation stage is selling something.",
      },
      {
        title: "Where AI is genuinely better",
        body: "Availability at 3am, cost per interaction, and memory. An AI reading costs a fraction of a per-minute human consultation and does not vary with the practitioner's mood or workload. More importantly, it can hold your entire history — every prior question, your dasha timeline, your stated patterns — without you re-explaining. Most human consultations start from zero because the astrologer sees hundreds of clients.",
      },
      {
        title: "Where a human is genuinely better",
        body: "Grief, crisis, and any situation where the real need is to be heard rather than analysed. A skilled human astrologer reads the room — they notice when a question about career timing is actually about a failing marriage, and they know when to stop giving astrological answers and suggest a doctor, a lawyer, or a therapist. If you are in acute distress, talk to a person. This is not a limitation AI is close to solving.",
      },
      {
        title: "The transparency problem in the market",
        body: "Several large astrology marketplaces route some conversations to scripted or automated responses without disclosure, and users often cannot tell. Whatever you choose, the question worth asking is whether the platform tells you what you are talking to. AstroYou labels every AI astrologer as AI on its consultation profiles; that policy is documented on the trust page.",
      },
      {
        title: "How to decide",
        body: "Use AI for routine questions, chart learning, daily timing, and anything you want to revisit over months. Use a human for major life decisions where you want a second consciousness in the room, and for emotional weight. Many people reasonably use both — AI for frequency, a trusted human astrologer once or twice a year for depth.",
      },
    ],
    comparison: {
      caption:
        "AI astrologer vs human astrologer across the criteria that actually differ",
      columns: ["AI astrologer", "Human astrologer"],
      rows: [
        {
          criterion: "Chart calculation accuracy",
          values: ["Identical — deterministic", "Identical — deterministic"],
        },
        {
          criterion: "Typical cost",
          values: [
            "Per-message or low per-minute",
            "Per-minute, varies widely by practitioner",
          ],
        },
        {
          criterion: "Availability",
          values: ["Immediate, any hour", "Scheduled or queued"],
        },
        {
          criterion: "Memory of your history",
          values: [
            "Complete, if the product stores it",
            "Depends on the practitioner's notes",
          ],
        },
        {
          criterion: "Emotional judgement",
          values: ["Limited", "The main advantage"],
        },
        {
          criterion: "Knows when to refer you elsewhere",
          values: ["Only if designed to", "A good practitioner does this well"],
        },
        {
          criterion: "Consistency between sessions",
          values: ["High", "Varies with mood and workload"],
        },
      ],
    },
    facts: [
      {
        label: "AstroYou AI disclosure",
        value: "Every AI astrologer is labelled as AI",
        source: "Documented on /trust",
      },
      { label: "AstroYou free tier", value: "15 credits, no card required" },
      {
        label: "AstroYou consultation rate",
        value: "From 5 credits per minute",
      },
    ],
    faq: [
      {
        question: "Is an AI astrologer as accurate as a human astrologer?",
        answer:
          "For chart calculation, yes — identical, because the mathematics is deterministic. For interpretation, they differ in kind rather than quality: AI is more consistent and remembers everything; a skilled human brings emotional judgement and knows when to stop giving astrological answers.",
      },
      {
        question: "Are the astrologers on astrology apps real people?",
        answer:
          "It varies by platform and is often not disclosed. Some marketplaces route conversations to scripted or automated systems without telling the user. Ask the platform directly, and prefer ones that label AI as AI. AstroYou does so on every consultation profile.",
      },
      {
        question: "When should I choose a human astrologer over AI?",
        answer:
          "In grief, acute crisis, or any situation where being heard matters more than being analysed. Also when you want someone who will tell you astrology is the wrong tool for the question and point you to a doctor, lawyer, or therapist instead.",
      },
      {
        question: "Is AI astrology cheaper?",
        answer:
          "Substantially, yes. Human per-minute consultation on Indian astrology marketplaces typically runs many multiples of AI consultation cost. AstroYou starts at 5 credits per minute with a free tier of 15 credits.",
      },
    ],
    primaryCta: { label: "Try Free AI Jyotish", to: "/free-kundali" },
    secondaryCta: { label: "Read Our Trust Policy", to: "/trust" },
    keywords: [
      "ai astrologer",
      "human astrologer",
      "comparison",
      "online astrology",
      "vedic astrology",
    ],
    updated: SEO_CONTENT_REVIEWED,
  },
  {
    slug: "astrotalk-alternatives",
    path: "/astrotalk-alternatives",
    title: "AstroTalk Alternatives: How the Main Options Actually Differ",
    description:
      "A practical comparison of AstroTalk alternatives for Indian astrology consultation — marketplace model versus AI companion versus free calculators — and which fits which need.",
    heading: "AstroTalk Alternatives",
    intro:
      "AstroTalk popularised per-minute consultation with a large roster of astrologers, and it does that job well. People look for alternatives for three recurring reasons: cost at frequency, uncertainty about who is on the other end, and starting from scratch in every conversation. Different alternatives solve different ones.",
    schemaType: "Article",
    sections: [
      {
        title: "What AstroTalk does well",
        body: "Scale and choice. A large roster means language coverage, specialisation, and availability at most hours, and per-minute billing is easy to understand. If what you want is to speak to a specific human practitioner in your own language and you consult occasionally, the marketplace model is a reasonable fit and worth keeping.",
      },
      {
        title: "Why people look for something else",
        body: "Three complaints recur: per-minute cost adds up quickly for anyone who wants weekly guidance rather than an annual reading; users are frequently unsure whether a given chat is a human or an automated system, since disclosure practices across the category vary; and each consultation restarts from zero, so you re-explain your situation every time.",
      },
      {
        title: "Alternative 1: an AI companion that keeps context",
        body: "This is AstroYou's model. One AI astrologer that holds your chart, your dasha timeline, and every prior conversation, at a fraction of per-minute human cost, with AI status disclosed on every profile. The trade-off is real: you are not talking to a human, and for grief or crisis that matters. Free tier is 15 credits with no card; consultation runs from 5 credits per minute.",
      },
      {
        title: "Alternative 2: free calculator sites",
        body: "Sites offering free Kundali generation, matching, and dosha checks. Genuinely useful for one-off calculations and they cost nothing. The limitation is that they compute rather than interpret — you get a chart and a table, not an answer to your actual question, and no continuity between visits.",
      },
      {
        title: "Alternative 3: an independent human astrologer",
        body: "Booking a practitioner directly, often through referral. Usually the highest quality per consultation and the highest cost, with no platform layer between you and the astrologer. Worth it for major decisions. Hardest to evaluate before you commit, since there is no review system.",
      },
      {
        title: "Which to choose",
        body: "If you consult a few times a year and value speaking to a person, stay with a marketplace or find an independent practitioner. If you want frequent, low-cost guidance that remembers your history, an AI companion fits better. If you only need a chart calculated, use a free calculator and stop there.",
      },
    ],
    comparison: {
      caption:
        "AstroTalk alternatives compared by model, not by marketing claim",
      columns: [
        "Marketplace",
        "AI companion (AstroYou)",
        "Free calculator",
        "Independent astrologer",
      ],
      rows: [
        {
          criterion: "Who you talk to",
          values: [
            "Human roster; disclosure varies",
            "AI, labelled as AI",
            "Nobody — output only",
            "One known human",
          ],
        },
        {
          criterion: "Cost model",
          values: [
            "Per minute, varies by astrologer",
            "From 5 credits/min; 15 free credits",
            "Free",
            "Per session, usually highest",
          ],
        },
        {
          criterion: "Remembers your history",
          values: [
            "Rarely",
            "Yes, across all sessions",
            "No",
            "Depends on practitioner",
          ],
        },
        {
          criterion: "Best for frequent use",
          values: ["Cost adds up", "Yes", "Limited value", "No"],
        },
        {
          criterion: "Best for crisis or grief",
          values: ["Yes", "No — see a human", "No", "Yes"],
        },
        {
          criterion: "Language choice",
          values: ["Wide", "Limited", "Varies", "One"],
        },
      ],
    },
    facts: [
      { label: "AstroYou free tier", value: "15 credits, no card required" },
      {
        label: "AstroYou consultation rate",
        value: "From 5 credits per minute",
      },
      {
        label: "AI disclosure policy",
        value: "Every AI astrologer labelled as AI",
        source: "Documented on /trust",
      },
    ],
    faq: [
      {
        question: "What is the best AstroTalk alternative?",
        answer:
          "It depends on frequency. For occasional consultation with a human in your own language, another marketplace or an independent astrologer fits. For frequent guidance that remembers your chart and history at lower cost, an AI companion like AstroYou fits. For one-off chart calculation, a free calculator is sufficient.",
      },
      {
        question: "Is there a cheaper alternative to AstroTalk?",
        answer:
          "Yes. AI-based consultation costs substantially less per interaction than human per-minute billing. AstroYou starts at 5 credits per minute and includes 15 free credits with no card. Free calculator sites cost nothing at all but do not interpret.",
      },
      {
        question: "Are AstroTalk astrologers real people?",
        answer:
          "AstroTalk lists human astrologers. Across the category generally, disclosure practices vary and some platforms route conversations to automated systems without clearly saying so. If it matters to you, ask the platform directly and prefer ones that state their policy in writing.",
      },
      {
        question: "Should I use an AI astrology app instead?",
        answer:
          "If you want frequent, low-cost guidance with continuity, yes. If you are dealing with grief or a crisis, no — talk to a human. Many people use both: AI for regular questions and a trusted human astrologer once or twice a year.",
      },
    ],
    primaryCta: { label: "Try AstroYou Free", to: "/free-kundali" },
    secondaryCta: {
      label: "Compare AI vs Human",
      to: "/ai-astrologer-vs-human-astrologer",
    },
    keywords: [
      "astrotalk alternatives",
      "astrology app",
      "online astrology consultation",
      "comparison",
      "ai astrologer",
    ],
    updated: SEO_CONTENT_REVIEWED,
  },
  {
    slug: "astrosage-alternatives",
    path: "/astrosage-alternatives",
    title:
      "AstroSage Alternatives: Free Kundali Tools and What Comes After Them",
    description:
      "Comparing AstroSage alternatives for free Kundali, matching, and Panchang — which tools calculate well, which interpret, and where each approach stops being useful.",
    heading: "AstroSage Alternatives",
    intro:
      "AstroSage is the reference point for free Vedic astrology calculation in India, and its tools are comprehensive. The gap people run into is not calculation quality — it is that a generated chart answers 'what is in my Kundali', not 'what should I do about it'.",
    schemaType: "Article",
    sections: [
      {
        title: "What AstroSage does well",
        body: "Breadth and cost. Free Kundali generation, Guna Milan, dosha checks, Panchang, and a large library of reference articles, backed by two decades of accumulated material. For looking up a definition or generating a chart, it is hard to beat and there is no reason to pay for those functions elsewhere.",
      },
      {
        title: "Where calculator-first tools stop",
        body: "A generated Kundali is a data structure — planets, houses, degrees, dasha tables. Turning that into a decision requires synthesis across dasha, transit, divisional charts, and your actual circumstances. Static tools present the data and leave the synthesis to you, which is fine if you read Jyotish and frustrating if you do not.",
      },
      {
        title: "Alternative 1: AI interpretation over the same calculations",
        body: "AstroYou computes the same sidereal chart with the same Lahiri ayanamsa, then synthesises across dasha, transits, and your stated situation, and keeps the context between conversations. Kundali generation, matching, and Panchang remain free. The trade-off is a smaller reference library than a twenty-year-old site.",
      },
      {
        title: "Alternative 2: consultation marketplaces",
        body: "Platforms offering per-minute access to human astrologers. These solve interpretation through a person rather than software. Higher cost per interaction, and quality varies by practitioner, but a good human reading remains the benchmark for a major decision.",
      },
      {
        title: "Alternative 3: learning to read it yourself",
        body: "The most durable option and the slowest. Free calculators plus classical study — Brihat Parashara Hora Shastra as the primary source — will eventually make you independent of every tool on this list. Worth starting if astrology is a long-term interest rather than an occasional need.",
      },
      {
        title: "Which to choose",
        body: "Use free calculators for calculation; there is no reason to pay for that. Add AI interpretation when you want the chart explained in the context of a specific decision and want that context retained. Book a human for the decisions that genuinely warrant one.",
      },
    ],
    comparison: {
      caption:
        "Free calculators, AI interpretation, and human consultation compared",
      columns: [
        "Free calculator sites",
        "AI companion (AstroYou)",
        "Human consultation",
      ],
      rows: [
        {
          criterion: "Chart calculation",
          values: ["Free and accurate", "Free and accurate", "Accurate"],
        },
        {
          criterion: "Interpretation",
          values: [
            "Generic or absent",
            "Synthesised to your question",
            "Personal and situational",
          ],
        },
        {
          criterion: "Remembers prior questions",
          values: ["No", "Yes", "Depends on practitioner"],
        },
        {
          criterion: "Reference library depth",
          values: ["Extensive", "Growing", "In the practitioner's head"],
        },
        {
          criterion: "Cost",
          values: [
            "Free",
            "15 free credits, then from 5/min",
            "Per minute or per session",
          ],
        },
        {
          criterion: "Best for",
          values: [
            "Looking things up",
            "Recurring decisions",
            "Major decisions",
          ],
        },
      ],
    },
    facts: [
      {
        label: "Ayanamsa used by AstroYou",
        value: "Lahiri (Chitrapaksha)",
        source: "The standard adopted by India's Rashtriya Panchang",
      },
      { label: "Free on AstroYou", value: "Kundali, matching, and Panchang" },
      { label: "Free tier", value: "15 credits, no card required" },
    ],
    faq: [
      {
        question: "What is a good alternative to AstroSage for free Kundali?",
        answer:
          "AstroYou generates a free Janam Kundali from date, exact time, and place of birth using the same Lahiri ayanamsa, and adds AI interpretation on top. For pure calculation, several free tools including AstroSage itself work equally well — the difference is what happens after the chart is generated.",
      },
      {
        question: "Do different astrology sites produce different charts?",
        answer:
          "They should not, if they use the same ayanamsa. Differences almost always trace to ayanamsa choice (Lahiri versus Raman versus KP) or to house division method, not to calculation error. Check which ayanamsa a tool uses before assuming one is wrong.",
      },
      {
        question: "Is AstroYou free like AstroSage?",
        answer:
          "Kundali generation, Kundali matching, and Panchang are free on AstroYou, plus 15 starter credits with no card required. Extended AI consultation and PDF reports are paid, starting at 5 credits per minute.",
      },
      {
        question: "Which ayanamsa should I use?",
        answer:
          "Lahiri (Chitrapaksha) is the standard for most Indian Vedic practice and is what India's official Rashtriya Panchang uses. Unless you are following a specific lineage that specifies otherwise, Lahiri is the safe default.",
      },
    ],
    primaryCta: { label: "Generate Free Kundali", to: "/free-kundali" },
    secondaryCta: {
      label: "Check Free Matching",
      to: "/free-kundali-matching",
    },
    keywords: [
      "astrosage alternatives",
      "free kundali",
      "kundali software",
      "comparison",
      "vedic astrology",
    ],
    updated: SEO_CONTENT_REVIEWED,
  },
  {
    slug: "best-ai-astrology-app",
    path: "/best-ai-astrology-app",
    title: "Best AI Astrology App: What to Check Before You Trust One",
    description:
      "How to evaluate AI astrology apps — calculation transparency, AI disclosure, memory, pricing clarity, and the warning signs that separate a real tool from a horoscope generator.",
    heading: "Best AI Astrology App",
    intro:
      "Most apps marketed as AI astrology are horoscope text generators with a chart drawing attached. A small number actually compute a sidereal chart and reason over it. These are the five checks that separate them, and they are all things you can verify in a few minutes before paying anything.",
    schemaType: "Article",
    sections: [
      {
        title: "Check 1: does it ask for your birth time and place?",
        body: "If an app gives readings from your date of birth alone, it cannot know your ascendant, your house positions, or your Moon's Nakshatra — which means it is producing sun-sign content, not a chart reading. Exact time and place are non-negotiable inputs for genuine Vedic work. An app that skips them has told you what it is.",
      },
      {
        title: "Check 2: does it state its ayanamsa?",
        body: "Sidereal astrology requires an ayanamsa correction, currently around 24° and increasing by roughly 50 arcseconds a year. Lahiri is the Indian standard. An app that cannot tell you which ayanamsa it uses either does not know or is not calculating at all.",
      },
      {
        title: "Check 3: does it disclose what is AI?",
        body: "This is the clearest integrity signal in the category. Platforms that present AI output as a human astrologer are making a choice about honesty that extends to everything else they tell you. Look for an explicit written policy, not an absence of claims.",
      },
      {
        title: "Check 4: does it remember?",
        body: "An AI reading that starts from zero every session is a chatbot with an ephemeris. The advantage AI actually has over a human practitioner is perfect recall of your chart, your dasha timeline, and everything you have already said. If the app cannot reference last month's conversation, it is not using its main structural advantage.",
      },
      {
        title: "Check 5: can you see the pricing before signing up?",
        body: "Pricing behind a signup wall or a 'contact us' is a reliable predictor of pricing you will not like. Rates, credit costs, and what the free tier actually includes should be readable before you create an account.",
      },
      {
        title: "How AstroYou scores on its own checklist",
        body: "AstroYou requires date, exact time, and place; uses the Lahiri ayanamsa; labels every AI astrologer as AI on its consultation profiles; retains chart, dasha, and conversation history between sessions; and publishes full pricing at /pricing and in a machine-readable file at /pricing.md. Where it is weaker: fewer languages than the large marketplaces, and no human astrologers on the roster.",
      },
    ],
    comparison: {
      caption: "The five checks, and what a failing answer looks like",
      columns: ["Check", "Good answer", "Warning sign"],
      rows: [
        {
          criterion: "Birth data required",
          values: ["Date, exact time, place", "Date of birth only"],
        },
        {
          criterion: "Ayanamsa stated",
          values: ["Lahiri, or clearly named", "Not stated anywhere"],
        },
        {
          criterion: "AI disclosure",
          values: ["Written policy, AI labelled", "Ambiguous personas"],
        },
        {
          criterion: "Session memory",
          values: ["References prior conversations", "Starts fresh each time"],
        },
        {
          criterion: "Pricing visibility",
          values: ["Public before signup", "Behind a wall"],
        },
      ],
    },
    facts: [
      {
        label: "Current Lahiri ayanamsa",
        value: "Approximately 24°",
        source: "Increases about 50 arcseconds per year",
      },
      {
        label: "Inputs required for a real chart",
        value: "Date, exact time, and place",
      },
      {
        label: "AstroYou pricing",
        value: "Public at /pricing and /pricing.md",
      },
    ],
    faq: [
      {
        question: "What is the best AI astrology app?",
        answer:
          "Judge by five checks rather than marketing: does it require exact birth time and place, does it state its ayanamsa, does it disclose what is AI, does it remember prior conversations, and is pricing visible before signup. Any app failing the first two is producing sun-sign content rather than chart readings.",
      },
      {
        question: "Are AI astrology apps accurate?",
        answer:
          "The calculation is as accurate as the ephemeris and ayanamsa they use — which for a serious app means identical to what a human astrologer would compute. Interpretation quality varies enormously, and an app that does not collect birth time is not doing chart interpretation at all.",
      },
      {
        question: "Is there a free AI astrology app?",
        answer:
          "AstroYou offers free Kundali generation, free Kundali matching, free Panchang, and 15 starter credits without a card. Extended AI consultation is paid from 5 credits per minute, with full rates published before signup.",
      },
      {
        question: "Can AI replace a real astrologer?",
        answer:
          "For routine questions, chart learning, and timing, it is a reasonable substitute at much lower cost with better memory. For grief, crisis, or decisions with heavy emotional weight, it is not — a skilled human reads context an AI misses and knows when to refer you elsewhere.",
      },
    ],
    primaryCta: { label: "Try AstroYou Free", to: "/free-kundali" },
    secondaryCta: { label: "Read Our Trust Policy", to: "/trust" },
    keywords: [
      "best ai astrology app",
      "ai astrology",
      "astrology app comparison",
      "vedic astrology app",
    ],
    updated: SEO_CONTENT_REVIEWED,
  },
  {
    slug: "free-kundali-apps-compared",
    path: "/free-kundali-apps-compared",
    title: "Free Kundali Apps Compared: What 'Free' Actually Covers",
    description:
      "A comparison of free Kundali generators on what matters — required birth inputs, ayanamsa, divisional charts, dasha depth, matching, and where the paywall actually falls.",
    heading: "Free Kundali Apps Compared",
    intro:
      "Nearly every Vedic astrology product advertises a free Kundali. They differ enormously in what that includes — some give a full chart with dashas and divisional charts, others give a drawing and hold the interpretation behind a payment. These are the dimensions worth comparing.",
    schemaType: "Article",
    sections: [
      {
        title: "What a complete free Kundali should include",
        body: "At minimum: the D-1 rashi chart with all nine grahas and the ascendant, house cusps, the Moon's Nakshatra and pada, and the Vimshottari dasha sequence with current mahadasha and antardasha. Anything less is a partial chart. Divisional charts beyond the D-9 Navamsa are a reasonable paid boundary; the D-9 itself is basic enough that most serious tools include it.",
      },
      {
        title: "Where the paywall usually falls",
        body: "Three common patterns: the chart is free but interpretation is paid; the chart and a generic reading are free but matching or dosha analysis is paid; or everything is free but the product monetises through consultation upsell. The third is the most common in the Indian market and generally the most user-friendly, since the free tier stays genuinely useful.",
      },
      {
        title: "Ayanamsa and why charts sometimes disagree",
        body: "If two tools give you different charts, ayanamsa is almost always the reason. Lahiri is the Indian standard, currently around 24° and drifting about 50 arcseconds a year. Raman and Krishnamurti ayanamsas differ by fractions of a degree, which is usually irrelevant but can shift a planet across a sign boundary if it sits near the edge. Check which one a tool uses before concluding it is wrong.",
      },
      {
        title: "Birth time accuracy matters more than tool choice",
        body: "The ascendant advances roughly one degree every four minutes, so a full sign changes about every two hours. A birth time off by fifteen minutes can shift house cusps enough to change the reading; off by two hours can change the ascendant entirely. No tool compensates for bad input. If your recorded time is uncertain, birth-time rectification matters more than which app you pick.",
      },
      {
        title: "What AstroYou includes free",
        body: "Full D-1 chart, ascendant, Nakshatra and pada, Vimshottari dasha sequence, D-9 Navamsa, Kundali matching with Ashtakoot scoring, Manglik check, and daily Panchang — plus 15 credits of AI consultation without a card. Paid tiers start at ₹499/month; consultation runs from 5 credits per minute. Full rates are at /pricing.",
      },
    ],
    comparison: {
      caption: "What to check in any free Kundali tool",
      columns: ["Dimension", "What good looks like"],
      rows: [
        {
          criterion: "Required inputs",
          values: ["Date, exact time, place — all three"],
        },
        {
          criterion: "Ayanamsa",
          values: ["Stated explicitly; Lahiri for Indian practice"],
        },
        {
          criterion: "Free chart depth",
          values: ["D-1, ascendant, Nakshatra, full dasha sequence"],
        },
        {
          criterion: "Divisional charts",
          values: ["D-9 Navamsa included free"],
        },
        {
          criterion: "Matching",
          values: ["Ashtakoot 36-point with per-koota breakdown"],
        },
        {
          criterion: "Interpretation",
          values: ["Some free; not a pure paywall tease"],
        },
      ],
    },
    facts: [
      {
        label: "Ascendant drift",
        value: "About 1° every 4 minutes",
        source: "A full sign changes roughly every 2 hours",
      },
      { label: "Ayanamsa drift", value: "About 50 arcseconds per year" },
      { label: "Ashtakoot total", value: "36 points across 8 kootas" },
      {
        label: "AstroYou paid tiers",
        value: "From ₹499/month",
        source: "Full rates at /pricing",
      },
    ],
    faq: [
      {
        question: "Which free Kundali app is most accurate?",
        answer:
          "Accuracy differences between serious tools are almost always ayanamsa differences, not errors. Any tool using Lahiri and requiring exact birth time and place will produce the same chart. The bigger accuracy risk is your recorded birth time, not the software.",
      },
      {
        question: "Why do two Kundali apps show different charts?",
        answer:
          "Usually a different ayanamsa (Lahiri versus Raman versus KP) or a different house division method. The difference is fractions of a degree, which only matters when a planet sits near a sign boundary — in which case it can appear to change signs entirely.",
      },
      {
        question: "Do I need my exact birth time for a Kundali?",
        answer:
          "Yes. The ascendant moves about one degree every four minutes and changes sign roughly every two hours. Without accurate time you can still read planetary signs and the Moon's Nakshatra, but house positions and the ascendant — which most interpretation depends on — become unreliable.",
      },
      {
        question: "What does AstroYou include for free?",
        answer:
          "The D-1 chart, ascendant, Nakshatra and pada, full Vimshottari dasha sequence, D-9 Navamsa, Kundali matching with Ashtakoot scoring, Manglik check, daily Panchang, and 15 AI consultation credits with no card required.",
      },
    ],
    primaryCta: { label: "Generate Free Kundali", to: "/free-kundali" },
    secondaryCta: { label: "See Pricing", to: "/pricing" },
    keywords: [
      "free kundali app",
      "kundali comparison",
      "janam kundali",
      "birth chart app",
      "vedic astrology",
    ],
    updated: SEO_CONTENT_REVIEWED,
  },
];

export const SEO_CONTENT_PAGES: SeoContentPage[] = [
  ...ENRICHED_CORE_SEO_CONTENT_PAGES,
  ...COMPARISON_SEO_CONTENT_PAGES,
  ...NAKSHATRA_SEO_CONTENT_PAGES,
  ...PLANET_SEO_CONTENT_PAGES,
  ...HOUSE_SEO_CONTENT_PAGES,
  ...PLANET_HOUSE_SEO_CONTENT_PAGES,
];

const SEO_CLUSTER_TITLES: Record<SeoCluster, string> = {
  nakshatra: "Explore all Nakshatras",
  planet: "Explore all planets",
  house: "Explore all houses",
  planetHouse: "Explore this planet across houses",
  comparison: "Compare your options",
};

const COMPARISON_SLUGS = COMPARISON_SEO_CONTENT_PAGES.map((page) => page.slug);

export function getSeoClusterPages(slug: string) {
  const cluster = getSeoCluster(slug);
  if (!cluster) return [];
  if (cluster === "comparison") {
    return COMPARISON_SEO_CONTENT_PAGES;
  }
  if (cluster === "planetHouse") {
    const planetSlug = getPlanetHousePlanetSlug(slug);
    if (!planetSlug) {
      return SEO_CONTENT_PAGES.filter((page) =>
        page.slug.startsWith("planet-in-house/"),
      );
    }
    return SEO_CONTENT_PAGES.filter((page) =>
      page.slug.startsWith(`planet-in-house/${planetSlug}/`),
    );
  }
  return SEO_CONTENT_PAGES.filter((page) =>
    page.slug.startsWith(`${cluster}/`),
  );
}

export function getSeoClusterTitle(slug: string) {
  const cluster = getSeoCluster(slug);
  return cluster ? SEO_CLUSTER_TITLES[cluster] : "";
}

export function getSeoContentPage(slug: string) {
  return SEO_CONTENT_PAGES.find((page) => page.slug === slug);
}

export function getRelatedSeoContentPages(slug: string, limit = 4) {
  const current = getSeoContentPage(slug);
  if (!current) return [];
  return SEO_CONTENT_PAGES.filter((page) => page.slug !== slug)
    .map((page) => ({
      page,
      score: page.keywords.filter((keyword) =>
        current.keywords.includes(keyword),
      ).length,
    }))
    .sort(
      (a, b) => b.score - a.score || a.page.title.localeCompare(b.page.title),
    )
    .slice(0, limit)
    .map((item) => item.page);
}

export function getSeoContentFaqs(
  pageOrSlug: SeoContentPage | string,
): SeoContentFaq[] {
  const page =
    typeof pageOrSlug === "string" ? getSeoContentPage(pageOrSlug) : pageOrSlug;
  if (!page) return [];

  // Page-authored Q&A wins. The generic fallback below is only for the older
  // core guides that have not been given their own questions yet — it used to
  // apply to every page, which meant two of three answers were byte-identical
  // across the whole site and worth nothing as extractable content.
  if (page.faq?.length) return page.faq;

  const cluster = getSeoCluster(page.slug);
  const guideLabel = getSeoGuideLabel(cluster);
  const topic = page.heading;

  return [
    {
      question: `What is ${topic}?`,
      answer: page.intro,
    },
    {
      question: `How should I use this ${guideLabel}?`,
      answer:
        "Use it as a starting point for self-awareness and timing. For serious decisions, read it with your full Kundali, dasha period, current transits, and practical life context.",
    },
    {
      question: `Can AstroYou personalize ${topic}?`,
      answer:
        "Yes. After you create a birth profile, AstroYou can combine this topic with your chart, Moon sign, Ascendant, dashas, transits, and saved guidance history.",
    },
  ];
}

function getSeoCluster(slug: string): SeoCluster | null {
  if (slug === "nakshatra" || slug.startsWith("nakshatra/")) return "nakshatra";
  if (slug === "planet" || slug.startsWith("planet/")) return "planet";
  if (slug === "house" || slug.startsWith("house/")) return "house";
  if (slug === "planet-in-house" || slug.startsWith("planet-in-house/"))
    return "planetHouse";
  if (COMPARISON_SLUGS.includes(slug)) return "comparison";
  return null;
}

function getSeoGuideLabel(cluster: SeoCluster | null) {
  if (cluster === "nakshatra") return "Nakshatra guide";
  if (cluster === "planet") return "planet guide";
  if (cluster === "house") return "house guide";
  if (cluster === "planetHouse") return "planet-in-house guide";
  return "Vedic astrology guide";
}

function getPlanetHousePlanetSlug(slug: string) {
  const [, planetSlug] = slug.split("/");
  return planetSlug || "";
}
