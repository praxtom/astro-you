/**
 * Plain-English definitions for the astrology vocabulary the UI uses.
 *
 * Written for a first-time user who knows their zodiac sign and nothing more.
 * Every `short` says what the term is AND why it matters to the reader, stays
 * under 120 characters so it fits a tooltip, and never defines one Sanskrit
 * term using another — that only defers the confusion. `long` adds the
 * detail for anyone who wants it.
 */
export interface GlossaryEntry {
  term: string;
  short: string;
  long: string;
}

const LAGNA: GlossaryEntry = {
  term: "Lagna",
  short:
    "Your rising sign: the sign on the eastern horizon at your birth. It frames your whole chart, so birth time matters.",
  long: "Also called the Ascendant. The lagna becomes the first house, and every other house is counted from it, so it decides which life area each planet affects. Because the horizon shifts about a degree every four minutes, an accurate lagna needs an accurate birth time.",
};

const CHART_YOGA: GlossaryEntry = {
  term: "Yoga",
  short:
    "A special planet combination in your birth chart, read as a particular strength or challenge in your life.",
  long: "In chart reading, a yoga is a recognised arrangement of planets — Gajakesari, Raj Yoga and hundreds of others — each with a traditional meaning for wealth, career, relationships or character. How strongly a yoga shows up depends on the planets involved and on your current planetary period. The daily almanac uses the same word for something else: a Sun–Moon combination.",
};

const HOUSE: GlossaryEntry = {
  term: "House",
  short:
    "One of 12 parts of your chart, each a life area like money, love or career. A planet's house shows where it acts.",
  long: "The houses are counted from your rising sign: the 1st is you, the 2nd money and family, the 7th partnership, the 10th career, and so on. A planet's sign shows how it behaves; its house shows which part of your life it affects. Houses depend on birth time, so an unknown time makes them less reliable.",
};

const TRANSIT: GlossaryEntry = {
  term: "Transit (Gochar)",
  short:
    "Where the planets are moving now, compared with your birth chart. It shows which parts of your life are being stirred.",
  long: "Your birth chart is fixed, but the planets keep moving. When a moving planet passes over a sensitive point in your chart — your Moon sign, your rising sign, a house — that area of life is said to become active. Slow planets like Saturn and Jupiter matter most because they stay for months or years.",
};

export const GLOSSARY = {
  panchang: {
    term: "Panchang",
    short:
      "Today's Hindu almanac: five sky markers that show which hours suit new starts and which are best avoided.",
    long: "Panchang means 'five limbs': the lunar day, the Moon's star-group, the day's Sun–Moon combination, the half lunar day and the weekday, all calculated for one date and one place. Because it starts from local sunrise, a panchang for Delhi is not valid for Denver.",
  },
  tithi: {
    term: "Tithi",
    short:
      "The lunar day, one of 30 in the Moon's monthly cycle. Festivals, fasts and good dates are set by it.",
    long: "A tithi is the time the Moon takes to gain 12 degrees on the Sun. Because that speed varies through the month, a tithi runs a little shorter or longer than a 24-hour day, which is why it drifts against the calendar date. Ekadashi, Purnima and Amavasya are all tithis.",
  },
  nakshatra: {
    term: "Nakshatra",
    short:
      "One of 27 star-groups. The one your Moon sat in at birth shapes your nature and the timing of your life chapters.",
    long: "The 27 nakshatras split the zodiac into equal 13°20' segments, each with its own ruling planet and character. Your birth nakshatra is treated as a finer-grained personality marker than your sign, and it sets where your sequence of planetary periods begins. Today's nakshatra is also checked when picking good dates.",
  },
  yoga: CHART_YOGA,
  "chart-yoga": CHART_YOGA,
  "panchang-yoga": {
    term: "Yoga (daily)",
    short:
      "One of 27 daily Sun–Moon combinations in the almanac. Some are read as easier days for new starts than others.",
    long: "In the daily almanac, the yoga is worked out from the combined positions of the Sun and Moon and changes roughly once a day. Most are neutral or favourable; a few are traditionally avoided for important starts. It is a different thing from a yoga in a birth chart, which is a planet combination.",
  },
  karana: {
    term: "Karana",
    short:
      "Half of a lunar day. Checked along with the day's other markers when picking a good time to act.",
    long: "There are 11 karanas cycling through each lunar month, each covering half of a lunar day. They are consulted mainly for choosing auspicious timing rather than for personality reading; one of them, Vishti (Bhadra), is traditionally avoided for new work.",
  },
  vara: {
    term: "Vara",
    short:
      "The weekday, each ruled by one planet. It's why certain days are kept for certain prayers or fasts.",
    long: "Sunday belongs to the Sun, Monday to the Moon, and so on — the same planet-to-weekday mapping that survives in the English names Sunday, Monday and Saturday. That is why, for example, Saturday is linked with Saturn and Shani worship.",
  },
  "rahu-kaal": {
    term: "Rahu Kaal",
    short:
      "About 90 minutes each day traditionally avoided for starting something new, like a purchase, journey or signing.",
    long: "Calculated by splitting the time between sunrise and sunset into eight parts and assigning one to Rahu, the Moon's north node; which part depends on the weekday. Because it starts from local sunrise, it differs for every city. Routine work carries on as normal — the tradition is only about beginnings.",
  },
  abhijit: {
    term: "Abhijit Muhurat",
    short:
      "About 48 minutes around local midday, considered good for starting something when no better time is fixed.",
    long: "Abhijit is the eighth of the fifteen equal parts of the daytime, centred on local noon. Tradition treats it as broadly supportive for starting something when no more specific auspicious time has been chosen. Like sunrise, it shifts with the city.",
  },
  dasha: {
    term: "Dasha",
    short:
      "A planetary period: years ruled by one planet, which sets the main theme of that stretch of your life.",
    long: "The Vimshottari system divides a 120-year lifespan into periods ruled by each of nine planets, in a fixed order, with the starting point set by the Moon's position at birth. Periods nest inside one another, so several rulers colour the same moment. Astrologers use them to answer 'when' questions.",
  },
  mahadasha: {
    term: "Mahadasha",
    short:
      "Your main planetary period, 6 to 20 years long. It sets the broad theme of your current life chapter.",
    long: "The outermost cycle of the Vedic timing system. Saturn's runs 19 years, the Sun's only 6. It sets the broad theme of a life chapter, which the shorter sub-period then modulates.",
  },
  antardasha: {
    term: "Antardasha",
    short:
      "A shorter period inside the main one, lasting months to a few years. It shows what is active for you right now.",
    long: "Each major period is subdivided in the same planetary order and proportion, so the combination of major and sub ruler is what practitioners read for specific timing rather than the major period alone.",
  },
  rashi: {
    term: "Rashi",
    short:
      "A zodiac sign. Indian astrology reads your daily horoscope from the sign your Moon was in at birth.",
    long: "The twelve rashis correspond to the familiar Aries-through-Pisces signs, but are measured against the visible constellations rather than the equinox, so a planet's rashi is usually one sign earlier than its Western sign. When someone in India asks 'what is your rashi?', they mean your Moon sign.",
  },
  "moon-sign": {
    term: "Moon sign",
    short:
      "The sign the Moon was in when you were born. Indian horoscopes are read from it, not from your Sun sign.",
    long: "The Moon moves through a sign in about two and a half days, so your Moon sign is more personal than your Sun sign, which you share with everyone born in the same month. Indian astrology treats it as the sign of your mind and emotions, and uses it for daily horoscopes and for Saturn's seven-and-a-half-year phase.",
  },
  lagna: LAGNA,
  ascendant: { ...LAGNA, term: "Ascendant" },
  house: HOUSE,
  bhava: { ...HOUSE, term: "Bhava (house)" },
  retrograde: {
    term: "Retrograde",
    short:
      "When a planet seems to move backwards as seen from Earth. Its themes are said to slow down or need a second look.",
    long: "No planet really reverses; Earth overtaking it (or being overtaken) makes it appear to. In a birth chart, a retrograde planet is read as working in a more inward or unusual way. In transit, it is a traditional cue to review rather than start — Mercury retrograde, for example, for contracts and messages.",
  },
  aspect: {
    term: "Aspect",
    short:
      "An angle between two planets that links their themes, so what one planet stands for affects the other.",
    long: "When two planets sit a meaningful angle apart — together, opposite, at 90° or 120°, for example — their themes are read together. In Vedic astrology every planet looks at the sign opposite it, and Mars, Jupiter and Saturn have extra special aspects. In transit readings, an aspect to one of your birth planets marks it as active.",
  },
  orb: {
    term: "Orb",
    short:
      "How many degrees an aspect is from exact. The smaller the orb, the stronger the link is felt.",
    long: "Two planets rarely sit at a perfect angle, so astrologers allow a margin. A transit within 1° of exact is at its peak; one at 5° is building or fading. Watching the orb shrink and grow tells you when a transit's effect starts, peaks and passes.",
  },
  shadbala: {
    term: "Shadbala",
    short:
      "A six-part strength score for each planet in your chart. Stronger planets deliver more of what they promise.",
    long: "Shadbala ('six strengths') adds up a planet's strength from its sign, direction, time of birth, motion, natural power and the aspects it receives. Astrologers use it to decide which planets will dominate your life and which periods are likely to deliver most clearly.",
  },
  varshaphal: {
    term: "Varshaphal",
    short:
      "A chart cast for your birthday each year, read for what the next 12 months are likely to bring.",
    long: "Varshaphal ('fruit of the year') is the Vedic solar-return chart: a new chart for the moment the Sun returns to its birth position. It is read alongside your birth chart, never instead of it, to see which themes the coming year emphasises.",
  },
  muntha: {
    term: "Muntha",
    short:
      "A point that moves one sign each birthday. The life area it lands in is where the year's focus goes.",
    long: "Muntha starts at your rising sign at birth and advances one sign each year. In the yearly chart, the house it falls in — and the planet that rules that sign — are read as the year's main area of attention.",
  },
  "life-path": {
    term: "Life path number",
    short:
      "Your core numerology number, worked out from your full birth date. It sums up your main traits and direction.",
    long: "Add every digit of your birth date and reduce the total to a single digit (or the master numbers 11, 22 and 33). Numerology reads this number as your central theme — the strengths you lean on and the lessons you keep meeting.",
  },
  astrocartography: {
    term: "Astrocartography",
    short:
      "A map of where on Earth each of your planets is strongest, used to think about places to live, work or travel.",
    long: "Astrocartography redraws your birth chart across a world map: each line marks where a planet was rising, setting or overhead at your birth moment. Places near a planet's line are said to bring out that planet's themes for you.",
  },
  biorhythm: {
    term: "Biorhythm",
    short:
      "Three cycles that start at birth — body (23 days), mood (28) and mind (33) — rising and falling in turn.",
    long: "Biorhythms chart three steady waves from your birth date. When a cycle is high, that side of you is said to have more energy; when it is low, it is a cue to rest that side. They are a reflective tool rather than an astrological calculation.",
  },
  transit: TRANSIT,
  gochar: TRANSIT,
  kundali: {
    term: "Kundali",
    short:
      "Your birth chart: a map of where each planet was when you were born. Every reading here is built on it.",
    long: "The same information a Western natal chart carries, drawn as a square or diamond grid rather than a wheel, and calculated against the visible constellations. North and South Indian layouts differ in how the houses are arranged. It needs your birth date, time and place.",
  },
  jyotish: {
    term: "Jyotish",
    short:
      "Indian (Vedic) astrology, 'the science of light' — the tradition every reading in this app follows.",
    long: "Jyotish is the classical Indian system, distinguished from Western astrology by measuring against the visible constellations, by weighting the Moon over the Sun, and by its planetary-period timing method.",
  },
  atman: {
    term: "Atman",
    short:
      "Your self or soul. Here, the memory that keeps your context between chats so you needn't repeat yourself.",
    long: "In Indian philosophy the atman is the unchanging self beneath personality. In this app it names the layer that remembers your emotional state, relationships, patterns and routines, so guidance builds on what you have already shared. You can review or delete it in Settings.",
  },
  prana: {
    term: "Prana",
    short:
      "Life-force or breath. Here, a short guided breathing practice with optional sound.",
    long: "Prana is the animating energy said to move through the body, cultivated through breath control. The Prana feature is a paced breathing exercise with optional sound.",
  },
  dharma: {
    term: "Dharma",
    short:
      "Right action, or your true path. Here, the daily routines you choose to track.",
    long: "Dharma covers duty, ethics and the way of living that fits a particular person. The Dharma feature tracks the daily practices you commit to, on the premise that a path is made of repeated small actions.",
  },
  sadhana: {
    term: "Sadhana",
    short:
      "Steady spiritual practice: the journal, altar and other habits you come back to each day.",
    long: "Sadhana is any practice pursued regularly toward a goal: meditation, recitation, journaling. The app groups the journal, the altar and the inner-circle tools under this heading.",
  },
  "guna-milan": {
    term: "Guna Milan",
    short:
      "A 36-point compatibility score for two birth charts, traditionally checked before marriage. 18+ is seen as a match.",
    long: "Guna Milan compares two charts across eight factors — temperament, affection, health and others — each worth a set number of points out of 36. Traditionally 18 or more is considered acceptable, and higher scores are read as stronger. It was designed for arranged-marriage vetting and assigns the two charts traditional gendered roles, so it is best read as one lens among several.",
  },
  ashtakoot: {
    term: "Ashtakoot",
    short:
      "The eight factors behind the 36-point match score — temperament, attraction, health and five more.",
    long: "Ashtakoot ('eight parts') is the system behind the 36-point score: Varna, Vashya, Tara, Yoni, Graha Maitri, Gana, Bhakoot and Nadi, worth 1 to 8 points each. Looking at which factors scored low tells you more than the total does — a low Nadi score, for example, is weighed differently from a low Varna score.",
  },
  manglik: {
    term: "Manglik",
    short:
      "Mars in certain chart positions, traditionally linked to friction in marriage. It is common and has remedies.",
    long: "Mars in certain houses is called manglik (or 'mangal dosha'). Classical texts treat it as a source of conflict in partnership and prescribe remedies or a matching placement in the partner's chart. Many modern practitioners read it as tension to manage rather than a verdict.",
  },
  dosha: {
    term: "Dosha",
    short:
      "A chart placement read as a difficulty, usually paired with remedies. It shows a tendency, not your fate.",
    long: "Dosha means fault. In chart reading it labels placements that classical texts treat as obstacles, usually paired with prescribed remedies. The same word is used differently in Ayurveda, where it means a body constitution.",
  },
  "sade-sati": {
    term: "Sade Sati",
    short:
      "About 7½ years when Saturn passes near your Moon sign: a demanding, maturing phase that returns every ~30 years.",
    long: "Saturn passing through the sign before, the sign of, and the sign after your natal Moon is traditionally a period of pressure and consolidation. It recurs about every 27 to 30 years, and is usually read as maturing rather than simply unlucky: effort made in it tends to last.",
  },
  navamsa: {
    term: "Navamsa (D9)",
    short:
      "Your D9 chart, a finer split of the birth chart, read for marriage and for how strong each planet really is.",
    long: "The navamsa (D-9) divides each sign into nine parts and rebuilds a chart from those divisions. Practitioners read it alongside the birth chart to test how strong a planet really is, and for partnership questions. Like the rising sign, it needs an accurate birth time.",
  },
  ayanamsa: {
    term: "Ayanamsa",
    short:
      "The roughly 24° gap between the Vedic and Western zodiacs — why your Vedic sign is often one sign earlier.",
    long: "The two zodiacs have drifted about 24 degrees apart since they last coincided. The ayanamsa is that correction; this app uses the Lahiri value, the Indian government's standard. It is the reason a Vedic Sun sign is usually one sign earlier than a Western one.",
  },
  muhurat: {
    term: "Muhurat",
    short:
      "A good time chosen to start something important — a wedding, a move, a purchase or a new job.",
    long: "Muhurat is the practice of picking a moment when the planetary conditions are considered supportive, using the day's almanac and your own chart. It is prospective, unlike a birth chart, which is fixed.",
  },
  graha: {
    term: "Graha",
    short:
      "A planet in Indian astrology: the nine bodies your chart is read from, including the Sun, Moon, Rahu and Ketu.",
    long: "The nine grahas are the Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn and the two lunar nodes, Rahu and Ketu. Graha means 'the one that seizes', reflecting the idea that these bodies take hold of experience.",
  },
} as const satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;

export function lookupTerm(key: string): GlossaryEntry | null {
  const normalized = key.trim().toLowerCase();
  return (GLOSSARY as Record<string, GlossaryEntry>)[normalized] ?? null;
}
