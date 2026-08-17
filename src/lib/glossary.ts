/**
 * Plain-English definitions for the Sanskrit vocabulary the UI uses.
 *
 * An Indian user reads "Tithi" and "Rahu Kaal" as ordinary words. A US user
 * reads them as noise, and a dashboard of unexplained noise reads as
 * unfinished rather than deep. Every `short` is written for someone with zero
 * background, stays under 120 characters so it fits a tooltip, and never
 * defines one Sanskrit term using another — that only defers the confusion.
 */
export interface GlossaryEntry {
  term: string;
  short: string;
  long: string;
}

export const GLOSSARY = {
  panchang: {
    term: "Panchang",
    short:
      "The traditional Indian almanac for a day — its five time-markers, plus sunrise and sunset.",
    long: "Panchang means 'five limbs': the lunar day, the moon's star-group, and three further cycles, all calculated for one date and one place. Because it derives from local sunrise, a panchang for Delhi is not valid for Denver.",
  },
  tithi: {
    term: "Tithi",
    short:
      "The lunar day — one of 30 steps in the Moon's cycle from new to full and back.",
    long: "A tithi is the time the Moon takes to gain 12 degrees on the Sun. Because that speed varies through the month, a tithi runs a little shorter or longer than a 24-hour day, which is why it drifts against the calendar date.",
  },
  nakshatra: {
    term: "Nakshatra",
    short:
      "One of 27 star-groups the sky is divided into, marking where the Moon sits.",
    long: "The 27 nakshatras split the zodiac into equal 13°20' segments, each with its own ruling planet and character. Where your Moon falls at birth is treated as a finer-grained personality marker than the sign alone, and it anchors the Vedic timing system.",
  },
  yoga: {
    term: "Yoga",
    short:
      "A named planetary combination in a chart, read as a specific strength or difficulty.",
    long: "In chart interpretation a yoga is a recognised arrangement of planets — Gajakesari, Raj Yoga and hundreds of others — each with a traditional meaning. The word also names one of the five daily almanac markers, a different use of the same term.",
  },
  karana: {
    term: "Karana",
    short: "A half-step of the lunar day, used when picking a time to act.",
    long: "There are 11 karanas cycling through each lunar month, each covering half of a lunar day. They are consulted mainly for choosing auspicious timing rather than for personality reading.",
  },
  vara: {
    term: "Vara",
    short: "The weekday, each governed by one of the seven classical planets.",
    long: "Sunday belongs to the Sun, Monday to the Moon, and so on — the same planet-to-weekday mapping that survives in the English names Sunday, Monday and Saturday.",
  },
  "rahu-kaal": {
    term: "Rahu Kaal",
    short:
      "A roughly 90-minute window each day traditionally avoided for starting something new.",
    long: "Calculated by splitting the time between sunrise and sunset into eight parts and assigning one to Rahu, the lunar node; which part depends on the weekday. Because it derives from local sunrise, it differs for every city.",
  },
  dasha: {
    term: "Dasha",
    short:
      "A planetary period — a stretch of life said to be governed by one planet.",
    long: "The Vimshottari system divides a 120-year lifespan into periods ruled by each of nine planets, in a fixed order, with the starting point set by the Moon's position at birth. Periods nest inside one another, so several rulers colour the same moment.",
  },
  mahadasha: {
    term: "Mahadasha",
    short:
      "The major planetary period, lasting from 6 to 20 years depending on the planet.",
    long: "The outermost cycle of the Vedic timing system. Saturn's runs 19 years, the Sun's only 6. It sets the broad theme of a life chapter, which the shorter sub-period then modulates.",
  },
  antardasha: {
    term: "Antardasha",
    short:
      "The sub-period inside a major one, usually months to a couple of years.",
    long: "Each major period is subdivided in the same planetary order and proportion, so the combination of major and sub ruler is what practitioners read for specific timing rather than the major period alone.",
  },
  rashi: {
    term: "Rashi",
    short: "The zodiac sign a planet occupies — the Sanskrit word for sign.",
    long: "The twelve rashis correspond to the familiar Aries-through-Pisces signs, but are measured against the visible constellations rather than the equinox, so a planet's rashi is usually one sign earlier than its Western sign.",
  },
  lagna: {
    term: "Lagna",
    short:
      "The Ascendant — the zodiac sign rising on the horizon at your birth moment.",
    long: "The lagna sets the whole frame of a chart: it becomes the first house, and every other house is counted from it. Because the horizon shifts about a degree every four minutes, an accurate lagna needs an accurate birth time.",
  },
  kundali: {
    term: "Kundali",
    short:
      "Your birth chart — a diagram of where each planet stood when you were born.",
    long: "The same information a Western natal chart carries, drawn as a square or diamond grid rather than a wheel, and calculated against the visible constellations. North and South Indian layouts differ in how the houses are arranged.",
  },
  jyotish: {
    term: "Jyotish",
    short:
      "Indian astrology — literally 'the science of light', the tradition this app follows.",
    long: "Jyotish is the classical Indian system, distinguished from Western astrology by measuring against the visible constellations, by weighting the Moon over the Sun, and by its planetary-period timing method.",
  },
  atman: {
    term: "Atman",
    short:
      "The self or soul — here, the memory that carries your context between conversations.",
    long: "In Indian philosophy the atman is the unchanging self beneath personality. In this app it names the layer that remembers your emotional state, relationships, patterns and routines, so guidance builds on what you have already shared.",
  },
  prana: {
    term: "Prana",
    short: "Life-force or vital breath — here, the guided breathing practice.",
    long: "Prana is the animating energy said to move through the body, cultivated through breath control. The Prana feature is a paced breathing exercise with optional sound.",
  },
  dharma: {
    term: "Dharma",
    short: "Right action, or your proper path — here, your tracked routines.",
    long: "Dharma covers duty, ethics and the way of living that fits a particular person. The Dharma feature tracks the daily practices you commit to, on the premise that a path is made of repeated small actions.",
  },
  sadhana: {
    term: "Sadhana",
    short: "Steady spiritual practice — the disciplined work you return to.",
    long: "Sadhana is any practice pursued regularly toward a goal: meditation, recitation, journaling. The app groups the journal, the altar and the inner-circle tools under this heading.",
  },
  "guna-milan": {
    term: "Guna Milan",
    short:
      "A traditional 36-point compatibility score between two charts, used for matchmaking.",
    long: "Guna Milan compares two charts across eight factors — temperament, affection, health and others — each worth a set number of points out of 36. It was designed for arranged-marriage vetting and assigns the two charts traditional gendered roles, so it is best read as one lens among several.",
  },
  manglik: {
    term: "Manglik",
    short:
      "A chart placement of Mars traditionally thought to bring friction to a marriage.",
    long: "Mars in certain houses is called manglik (or 'mangal dosha'). Classical texts treat it as a source of conflict in partnership and prescribe remedies or a matching placement in the partner's chart. Many modern practitioners read it as tension to manage rather than a verdict.",
  },
  dosha: {
    term: "Dosha",
    short: "A flaw or affliction in a chart — a placement read as difficulty.",
    long: "Dosha means fault. In chart reading it labels placements that classical texts treat as obstacles, usually paired with prescribed remedies. The same word is used differently in Ayurveda, where it means a body constitution.",
  },
  "sade-sati": {
    term: "Sade Sati",
    short:
      "The roughly seven-and-a-half years Saturn spends transiting near your Moon.",
    long: "Saturn passing through the sign before, the sign of, and the sign after your natal Moon is traditionally a demanding period of pressure and consolidation. It recurs about every 27 to 30 years, and is usually read as maturing rather than simply unlucky.",
  },
  navamsa: {
    term: "Navamsa",
    short:
      "A second chart derived from the first, consulted mainly for marriage and inner strength.",
    long: "The navamsa (D-9) divides each sign into nine parts and rebuilds a chart from those divisions. Practitioners read it alongside the birth chart to test how strong a planet really is, and for partnership questions.",
  },
  ayanamsa: {
    term: "Ayanamsa",
    short:
      "The offset between the constellation-based zodiac and the equinox-based one.",
    long: "The two zodiacs have drifted about 24 degrees apart since they last coincided. The ayanamsa is that correction; this app uses the Lahiri value, the Indian government's standard. It is the reason a Vedic Sun sign is usually one sign earlier than a Western one.",
  },
  muhurat: {
    term: "Muhurat",
    short: "A chosen auspicious time to begin something important.",
    long: "Muhurat is the practice of picking a moment — for a wedding, a journey, a business launch — when the planetary conditions are considered supportive. It is prospective, unlike a birth chart, which is fixed.",
  },
  graha: {
    term: "Graha",
    short:
      "A planet, in the traditional sense — the nine bodies a chart is read from.",
    long: "The nine grahas are the Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn and the two lunar nodes, Rahu and Ketu. Graha means 'the one that seizes', reflecting the idea that these bodies take hold of experience.",
  },
} as const satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;

export function lookupTerm(key: string): GlossaryEntry | null {
  const normalized = key.trim().toLowerCase();
  return (GLOSSARY as Record<string, GlossaryEntry>)[normalized] ?? null;
}
