/**
 * Route index for the SEO guides: the slugs and redirects the router needs,
 * without the article text.
 *
 * App.tsx imports this eagerly, so it must stay tiny. The full content model
 * (~170KB) lives in seo-content.ts and is only loaded by the lazy guide
 * routes. KEEP IN SYNC with seo-content.ts: scripts/seo-index.test.mjs fails
 * if a guide exists in one and not the other.
 */

/** Standalone guide pages whose slug has no sub-path. */
const CORE_GUIDE_SLUGS = [
  "kundali",
  "kundali-matching",
  "daily-horoscope",
  "sade-sati",
  "manglik",
  "nakshatra",
  "planet",
  "planet-in-house",
  "house",
  "dasha",
  "moon-sign-calculator",
  "nakshatra-finder",
  "sade-sati-calculator",
  "manglik-dosha-checker",
  "dasha-calculator",
  "kaal-sarp-dosha",
  "love-compatibility",
  "vedic-astrology",
  "gemstone-remedies",
  "baby-name-astrology",
  "lucky-mobile-number",
  "astrology-app-vs-human-astrologer",
  "astrotalk-alternatives",
  "astrosage-alternatives",
  "best-astrology-app",
  "free-kundali-apps-compared",
];

const NAKSHATRA_SLUGS = [
  "ashwini",
  "bharani",
  "krittika",
  "rohini",
  "mrigashira",
  "ardra",
  "punarvasu",
  "pushya",
  "ashlesha",
  "magha",
  "purva-phalguni",
  "uttara-phalguni",
  "hasta",
  "chitra",
  "swati",
  "vishakha",
  "anuradha",
  "jyeshtha",
  "mula",
  "purva-ashadha",
  "uttara-ashadha",
  "shravana",
  "dhanishta",
  "shatabhisha",
  "purva-bhadrapada",
  "uttara-bhadrapada",
  "revati",
];

const PLANET_SLUGS = [
  "sun",
  "moon",
  "mars",
  "mercury",
  "jupiter",
  "venus",
  "saturn",
  "rahu",
  "ketu",
];

const HOUSE_SLUGS = [
  "first-house",
  "second-house",
  "third-house",
  "fourth-house",
  "fifth-house",
  "sixth-house",
  "seventh-house",
  "eighth-house",
  "ninth-house",
  "tenth-house",
  "eleventh-house",
  "twelfth-house",
];

/** Every standalone guide route, as a slug (the path without its leading "/"). */
export const SEO_CONTENT_SLUGS: readonly string[] = [
  ...CORE_GUIDE_SLUGS,
  ...NAKSHATRA_SLUGS.map((slug) => `nakshatra/${slug}`),
  ...PLANET_SLUGS.map((slug) => `planet/${slug}`),
  ...HOUSE_SLUGS.map((slug) => `house/${slug}`),
  ...PLANET_SLUGS.flatMap((planet) =>
    HOUSE_SLUGS.map((house) => `planet-in-house/${planet}/${house}`),
  ),
];

/**
 * Guides that targeted the same search as a live tool page. Two URLs for one
 * query split the ranking, so each guide's text now renders ON the tool page
 * and its old URL 301s there. They are not standalone routes any more.
 */
export const MERGED_SEO_GUIDES: Record<string, string> = {
  "panchang-today": "/panchang",
  "business-muhurat": "/muhurat/business",
  "marriage-muhurat": "/muhurat/marriage",
  "property-muhurat": "/muhurat/property",
};

/** Comparison pages whose URL changed; the old path 301s to the new one. */
const RENAMED_SEO_PATHS: { from: string; to: string }[] = [
  {
    from: "/ai-astrologer-vs-human-astrologer",
    to: "/astrology-app-vs-human-astrologer",
  },
  { from: "/best-ai-astrology-app", to: "/best-astrology-app" },
];

/** Old guide URL → tool URL, for _redirects and client-side routes. */
export const SEO_GUIDE_REDIRECTS = [
  ...Object.entries(MERGED_SEO_GUIDES).map(([slug, to]) => ({
    from: `/${slug}`,
    to,
  })),
  ...RENAMED_SEO_PATHS,
];
