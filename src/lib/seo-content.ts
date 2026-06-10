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
}

export interface SeoContentFaq {
  question: string;
  answer: string;
}

type SeoCluster = "nakshatra" | "planet" | "house" | "planetHouse";

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
        body: "Real compatibility also needs Mangal Dosha, Venus, Jupiter, seventh-house strength, dasha timing, and communication patterns.",
      },
      {
        title: "Use it with care",
        body: "AstroYou presents compatibility as guidance, not fear. The goal is clarity, better conversation, and practical next steps.",
      },
    ],
    primaryCta: { label: "Check Free Match", to: "/free-kundali-matching" },
    secondaryCta: { label: "Consult Relationship Guide", to: "/consult/meera-devi/profile" },
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
        body: "The best remedy starts with steadiness: service, discipline, honest commitments, simple prayer, and practical decisions.",
      },
    ],
    primaryCta: { label: "Generate My Kundali", to: "/free-kundali" },
    secondaryCta: { label: "Ask Saturn Guide", to: "/consult/pandit-raghunath/profile" },
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
        body: "AstroYou treats Manglik analysis as practical relationship guidance, not a fixed verdict on marriage.",
      },
    ],
    primaryCta: { label: "Check Free Match", to: "/free-kundali-matching" },
    secondaryCta: { label: "Talk To Matching Guide", to: "/consult/meera-devi/profile" },
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
        body: "The Moon's Nakshatra describes instincts, needs, habits, memory, and how the mind seeks safety.",
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
    title: "Planets in Vedic Astrology: Graha Meanings, Houses, Signs, and Remedies",
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
    keywords: ["planet in house", "graha in bhava", "vedic astrology", "kundali"],
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
        body: "The app combines dasha with transits, panchang, and Atman memory so guidance is tied to the user's actual phase of life.",
      },
    ],
    primaryCta: { label: "Calculate My Dasha", to: "/free-kundali" },
    secondaryCta: { label: "Ask Career Guide", to: "/consult/arjun-sharma/profile" },
    keywords: ["dasha", "mahadasha", "antardasha", "vimshottari"],
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
    secondaryCta: { label: "Ask Traditional Guide", to: "/consult/pandit-raghunath/profile" },
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
        body: "Ask what needs care, what timing supports commitment, and what practical habits will make the relationship healthier.",
      },
    ],
    primaryCta: { label: "Check Free Match", to: "/free-kundali-matching" },
    secondaryCta: { label: "Ask Relationship Guide", to: "/consult/meera-devi/profile" },
    keywords: ["love compatibility", "kundali matching", "relationship astrology"],
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
        body: "A good reading should reduce confusion, suggest one useful next step, and avoid fear-based claims.",
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
        body: "The platform prefers simple, low-risk remedies first and explains the reasoning behind each suggestion.",
      },
    ],
    primaryCta: { label: "Generate My Kundali", to: "/free-kundali" },
    secondaryCta: { label: "Ask Remedy Guide", to: "/consult/pandit-raghunath/profile" },
    keywords: ["gemstone remedies", "vedic remedies", "mantra", "jyotish remedies"],
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
    secondaryCta: { label: "Ask Career Guide", to: "/consult/arjun-sharma/profile" },
    keywords: ["business muhurat", "shop opening muhurat", "company registration muhurat"],
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
        body: "For major property purchases, fourth house, Mars, Venus, Saturn, dasha timing, and current transits should be read with the Panchang.",
      },
    ],
    primaryCta: { label: "Find Free Muhurat", to: "/muhurat" },
    secondaryCta: { label: "Ask Family Guide", to: "/consult/nanda-ji/profile" },
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
        body: "Before choosing a date, compatibility and practical readiness should be understood so the Muhurat supports a real relationship foundation.",
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
        body: "AstroYou can first identify the child's Moon sign and Nakshatra from birth details, then guide the naming direction.",
      },
    ],
    primaryCta: { label: "Generate Baby Kundali", to: "/free-kundali" },
    secondaryCta: { label: "Ask Family Guide", to: "/consult/nanda-ji/profile" },
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
        body: "For important choices, combine numerology with your birth chart, dasha, practical constraints, and personal intention.",
      },
    ],
    primaryCta: { label: "Open Numerology", to: "/numerology" },
    secondaryCta: { label: "Ask AI Jyotish", to: "/synthesis" },
    keywords: ["lucky mobile number", "mobile number numerology", "numerology"],
  },
];

const NAKSHATRA_PAGE_SEEDS = [
  ["ashwini", "Ashwini", "Ashwini Kumars", "swift healing, quick starts, and rescue energy"],
  ["bharani", "Bharani", "Yama", "endurance, responsibility, and intense transformation"],
  ["krittika", "Krittika", "Agni", "truth, purification, sharp focus, and decisive action"],
  ["rohini", "Rohini", "Brahma", "growth, beauty, fertility, comfort, and creative attraction"],
  ["mrigashira", "Mrigashira", "Soma", "curiosity, searching, tenderness, and adaptive learning"],
  ["ardra", "Ardra", "Rudra", "storms, release, emotional honesty, and rebuilding after pressure"],
  ["punarvasu", "Punarvasu", "Aditi", "renewal, return, protection, and hope after disruption"],
  ["pushya", "Pushya", "Brihaspati", "nourishment, discipline, teaching, devotion, and care"],
  ["ashlesha", "Ashlesha", "Nagas", "psychology, binding patterns, instinct, and emotional depth"],
  ["magha", "Magha", "Pitrs", "lineage, authority, ancestors, legacy, and inherited duty"],
  ["purva-phalguni", "Purva Phalguni", "Bhaga", "pleasure, rest, romance, creativity, and social warmth"],
  ["uttara-phalguni", "Uttara Phalguni", "Aryaman", "commitment, support, agreements, and steady loyalty"],
  ["hasta", "Hasta", "Savitar", "skill, craft, hands-on intelligence, and practical manifestation"],
  ["chitra", "Chitra", "Tvashtar", "design, beauty, structure, image, and precise refinement"],
  ["swati", "Swati", "Vayu", "independence, movement, trade, flexibility, and self-direction"],
  ["vishakha", "Vishakha", "Indra and Agni", "ambition, focus, devotion, and milestone achievement"],
  ["anuradha", "Anuradha", "Mitra", "friendship, devotion, cooperation, and emotional loyalty"],
  ["jyeshtha", "Jyeshtha", "Indra", "seniority, protection, strategy, pride, and responsibility"],
  ["mula", "Mula", "Nirriti", "roots, truth seeking, dismantling, and deep karmic inquiry"],
  ["purva-ashadha", "Purva Ashadha", "Apas", "conviction, cleansing, persuasion, and resilient optimism"],
  ["uttara-ashadha", "Uttara Ashadha", "Vishvadevas", "enduring victory, ethics, leadership, and public duty"],
  ["shravana", "Shravana", "Vishnu", "listening, learning, transmission, tradition, and guidance"],
  ["dhanishta", "Dhanishta", "Vasus", "rhythm, wealth, community, performance, and shared resources"],
  ["shatabhisha", "Shatabhisha", "Varuna", "healing, secrecy, systems, isolation, and truth recovery"],
  ["purva-bhadrapada", "Purva Bhadrapada", "Aja Ekapada", "intensity, sacrifice, ideals, and spiritual fire"],
  ["uttara-bhadrapada", "Uttara Bhadrapada", "Ahir Budhnya", "depth, patience, stability, and inner maturity"],
  ["revati", "Revati", "Pushan", "protection, travel, nourishment, completion, and safe transitions"],
] as const;

const PLANET_PAGE_SEEDS = [
  ["sun", "Sun", "identity, confidence, authority, father themes, and life force"],
  ["moon", "Moon", "mind, emotion, memory, mother themes, and daily inner rhythm"],
  ["mars", "Mars", "drive, courage, conflict style, land, siblings, and physical energy"],
  ["mercury", "Mercury", "speech, learning, trade, analytics, writing, and nervous energy"],
  ["jupiter", "Jupiter", "wisdom, teachers, children, faith, ethics, and expansion"],
  ["venus", "Venus", "relationships, beauty, comfort, art, marriage, and material taste"],
  ["saturn", "Saturn", "discipline, karma, delay, duty, endurance, and long-term maturity"],
  ["rahu", "Rahu", "ambition, obsession, foreignness, disruption, and unconventional growth"],
  ["ketu", "Ketu", "detachment, past-life skill, spirituality, release, and inward focus"],
] as const;

const HOUSE_PAGE_SEEDS = [
  ["first-house", "First House", "self, body, personality, vitality, and first response to life"],
  ["second-house", "Second House", "wealth, speech, family values, food, savings, and stability"],
  ["third-house", "Third House", "courage, siblings, effort, communication, skills, and short travel"],
  ["fourth-house", "Fourth House", "home, mother, property, comfort, vehicles, and emotional grounding"],
  ["fifth-house", "Fifth House", "children, intelligence, creativity, romance, mantra, and past merit"],
  ["sixth-house", "Sixth House", "health routines, debt, competition, service, discipline, and obstacles"],
  ["seventh-house", "Seventh House", "marriage, partnerships, clients, contracts, and public interaction"],
  ["eighth-house", "Eighth House", "sudden change, secrets, longevity, inheritance, and transformation"],
  ["ninth-house", "Ninth House", "dharma, fortune, father, teachers, pilgrimage, and higher learning"],
  ["tenth-house", "Tenth House", "career, status, authority, public work, and visible responsibility"],
  ["eleventh-house", "Eleventh House", "income, gains, networks, friends, ambitions, and elder siblings"],
  ["twelfth-house", "Twelfth House", "sleep, expenses, solitude, foreign lands, moksha, and release"],
] as const;

const NAKSHATRA_SEO_CONTENT_PAGES: SeoContentPage[] = NAKSHATRA_PAGE_SEEDS.map(
  ([slug, name, deity, theme]) => ({
    slug: `nakshatra/${slug}`,
    path: `/nakshatra/${slug}`,
    title: `${name} Nakshatra Meaning, Traits, Compatibility, and Remedies`,
    description: `Understand ${name} Nakshatra in Vedic astrology: deity, traits, personality patterns, compatibility themes, career direction, and remedies.`,
    heading: `${name} Nakshatra`,
    intro: `${name} Nakshatra is read through the Moon's birth star and adds a finer layer to personality, emotional rhythm, instinct, and timing.`,
    sections: [
      {
        title: "Core meaning",
        body: `${name} is associated with ${deity}. Its themes include ${theme}. These qualities show how the mind responds when life asks for action, trust, repair, or growth.`,
      },
      {
        title: "Personality and relationships",
        body: `In compatibility, ${name} should be read with Moon sign, Venus, seventh house, Guna Milan, and dasha timing. The Nakshatra alone gives texture, not a final verdict.`,
      },
      {
        title: "How to use it",
        body: `Use ${name} as a practical self-awareness signal. AstroYou combines birth Nakshatra with Kundali, dasha, transit, and Atman memory before giving personal guidance.`,
      },
    ],
    primaryCta: { label: "Find My Nakshatra", to: "/free-kundali" },
    secondaryCta: { label: "Read Nakshatra Guide", to: "/nakshatra" },
    keywords: ["nakshatra", "birth star", "vedic astrology", name.toLowerCase()],
  }),
);

const PLANET_SEO_CONTENT_PAGES: SeoContentPage[] = PLANET_PAGE_SEEDS.map(
  ([slug, name, theme]) => ({
    slug: `planet/${slug}`,
    path: `/planet/${slug}`,
    title: `${name} in Vedic Astrology: Meaning, Houses, Signs, and Remedies`,
    description: `Learn what ${name} represents in Vedic astrology, how it behaves by house and sign, and how to read it with dasha and remedies.`,
    heading: `${name} in Vedic Astrology`,
    intro: `${name} is one of the main chart forces used to understand timing, temperament, karma, and practical life themes.`,
    sections: [
      {
        title: "What it represents",
        body: `In Jyotish, ${name} describes ${theme}. Its result changes by sign, house, dignity, aspects, conjunctions, and the active dasha.`,
      },
      {
        title: "Reading it in a Kundali",
        body: `A strong or challenged ${name} should not be judged alone. Read it with the Ascendant, Moon, house lordship, yogas, divisional charts, and current transits.`,
      },
      {
        title: "Remedy approach",
        body: `Remedies for ${name} should start with behavior, discipline, mantra, service, and low-risk practices before considering expensive or forceful prescriptions.`,
      },
    ],
    primaryCta: { label: "Generate Free Kundali", to: "/free-kundali" },
    secondaryCta: { label: "Ask AI Jyotish", to: "/synthesis" },
    keywords: ["planet", "graha", "vedic astrology", name.toLowerCase()],
  }),
);

const HOUSE_SEO_CONTENT_PAGES: SeoContentPage[] = HOUSE_PAGE_SEEDS.map(
  ([slug, name, theme]) => ({
    slug: `house/${slug}`,
    path: `/house/${slug}`,
    title: `${name} in Vedic Astrology: Meaning, Planets, Lord, and Results`,
    description: `Understand the ${name.toLowerCase()} in Vedic astrology, including its life areas, planets placed there, house lord, and dasha results.`,
    heading: `${name} in Vedic Astrology`,
    intro: `The ${name.toLowerCase()} is one of the twelve Kundali houses and shows a specific field of life that becomes active through planets, lordship, dasha, and transit.`,
    sections: [
      {
        title: "Life areas",
        body: `The ${name.toLowerCase()} describes ${theme}. It should be read as a living area of experience, not a single fixed prediction.`,
      },
      {
        title: "Planets and lordship",
        body: `Planets placed here show active tendencies. The house lord shows how this area behaves across life, especially during its dasha or important transit periods.`,
      },
      {
        title: "Personal interpretation",
        body: `AstroYou reads the ${name.toLowerCase()} with the full Kundali, divisional charts, dashas, and personal context before turning it into guidance.`,
      },
    ],
    primaryCta: { label: "Generate Free Kundali", to: "/free-kundali" },
    secondaryCta: { label: "Read Kundali Guide", to: "/kundali" },
    keywords: ["house", "bhava", "kundali", "vedic astrology", name.toLowerCase()],
  }),
);

const PLANET_HOUSE_SEO_CONTENT_PAGES: SeoContentPage[] = PLANET_PAGE_SEEDS.flatMap(
  ([planetSlug, planetName, planetTheme]) =>
    HOUSE_PAGE_SEEDS.map(([houseSlug, houseName, houseTheme]) => ({
      slug: `planet-in-house/${planetSlug}/${houseSlug}`,
      path: `/planet-in-house/${planetSlug}/${houseSlug}`,
      title: `${planetName} in ${houseName}: Vedic Astrology Meaning and Results`,
      description: `Understand ${planetName} in ${houseName} in Vedic astrology, including life themes, dasha results, strengths, cautions, and full-chart context.`,
      heading: `${planetName} in ${houseName}`,
      intro: `${planetName} in ${houseName} connects ${planetTheme} with ${houseTheme}. It can show where this planetary force becomes visible in practical life.`,
      sections: [
        {
          title: "Core meaning",
          body: `This placement brings ${planetName}'s themes of ${planetTheme} into the house of ${houseTheme}. The result can be supportive, demanding, or mixed depending on the full Kundali.`,
        },
        {
          title: "Timing and dasha",
          body: `${planetName} may become more noticeable during its dasha, antardasha, major transits, or when this house is activated by life events. Timing decides when a placement feels loud.`,
        },
        {
          title: "Read with chart context",
          body: `Check sign dignity, aspects, conjunctions, house lord strength, divisional charts, and current transits before treating ${planetName} in ${houseName} as a final prediction.`,
        },
      ],
      primaryCta: { label: "Generate Free Kundali", to: "/free-kundali" },
      secondaryCta: { label: `Read ${planetName} Guide`, to: `/planet/${planetSlug}` },
      keywords: [
        "planet in house",
        "graha in bhava",
        planetName.toLowerCase(),
        houseName.toLowerCase(),
        "vedic astrology",
        "kundali",
      ],
    })),
);

export const SEO_CONTENT_PAGES: SeoContentPage[] = [
  ...CORE_SEO_CONTENT_PAGES,
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
};

export function getSeoClusterPages(slug: string) {
  const cluster = getSeoCluster(slug);
  if (!cluster) return [];
  if (cluster === "planetHouse") {
    const planetSlug = getPlanetHousePlanetSlug(slug);
    if (!planetSlug) {
      return SEO_CONTENT_PAGES.filter((page) => page.slug.startsWith("planet-in-house/"));
    }
    return SEO_CONTENT_PAGES.filter((page) =>
      page.slug.startsWith(`planet-in-house/${planetSlug}/`),
    );
  }
  return SEO_CONTENT_PAGES.filter((page) => page.slug.startsWith(`${cluster}/`));
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
  return SEO_CONTENT_PAGES
    .filter((page) => page.slug !== slug)
    .map((page) => ({
      page,
      score: page.keywords.filter((keyword) => current.keywords.includes(keyword)).length,
    }))
    .sort((a, b) => b.score - a.score || a.page.title.localeCompare(b.page.title))
    .slice(0, limit)
    .map((item) => item.page);
}

export function getSeoContentFaqs(pageOrSlug: SeoContentPage | string): SeoContentFaq[] {
  const page =
    typeof pageOrSlug === "string" ? getSeoContentPage(pageOrSlug) : pageOrSlug;
  if (!page) return [];

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
  if (slug === "planet-in-house" || slug.startsWith("planet-in-house/")) return "planetHouse";
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
