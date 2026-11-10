import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import { PageShell } from "../components/layout/PageShell";
import { SEO_CONTENT_PAGES } from "../lib/seo-content";
import { PUBLIC_PAGE_META, PUBLIC_TOOL_PAGES } from "../lib/seo-public";
import { ZODIAC_SIGNS } from "../lib/sign-horoscope-content";

interface ExploreLink {
  path: string;
  title: string;
}

const MORE_PATHS = [
  "pricing",
  "help",
  "support",
  "privacy",
  "terms",
  "refund-policy",
  "disclaimer",
  "wellness",
  "human-design",
  "advanced-vedic",
  "astromap",
  "experts/apply",
];

/** Page title from the shared page metadata, falling back to a title-cased slug. */
function titleForPath(path: string): string {
  const meta = PUBLIC_PAGE_META.find((page) => page.path === path);
  if (meta) return meta.title;
  return path
    .replace(/^\//, "")
    .split(/[-/]/)
    .map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`)
    .join(" ");
}

export default function Explore() {
  // One flat grid of ~70 identical gold boxes gave no way to scan; group the
  // same links by kind, each path listed once.
  const seen = new Set<string>();
  const unique = (links: ExploreLink[]) =>
    links.filter((link) => {
      if (seen.has(link.path)) return false;
      seen.add(link.path);
      return true;
    });

  const groups: Array<{ title: string; blurb: string; links: ExploreLink[] }> = [
    {
      title: "Free tools",
      blurb: "Free calculators that work from your birth date, time and place.",
      links: unique(
        PUBLIC_TOOL_PAGES.map((page) => ({
          path: page.path,
          title: page.title,
        })),
      ),
    },
    {
      title: "Guides",
      blurb: "Plain explanations of Vedic astrology terms and what they mean for you.",
      links: unique(
        SEO_CONTENT_PAGES.map((page) => ({
          path: page.path,
          title: page.heading,
        })),
      ),
    },
    {
      title: "Horoscopes",
      blurb: "Pick your sign for its reading.",
      links: unique(
        ZODIAC_SIGNS.map((sign) => ({
          path: `/horoscope/${sign.slug}`,
          title: `${sign.name} Horoscope`,
        })),
      ),
    },
    {
      title: "Muhurat (good times)",
      blurb: "Favourable dates and times to start something important.",
      links: unique(
        ["business", "marriage", "property", "travel"].map((category) => ({
          path: `/muhurat/${category}`,
          title: `${category[0].toUpperCase()}${category.slice(1)} Muhurat`,
        })),
      ),
    },
    {
      title: "More",
      blurb: "Extra chart tools, plus pricing, help and policies.",
      links: unique(
        MORE_PATHS.map((path) => ({
          path: `/${path}`,
          title: titleForPath(`/${path}`),
        })),
      ),
    },
  ].filter((group) => group.links.length > 0);

  return (
    <PageShell noTabs>
      <SEO
        title="Explore Astrology Tools & Guides"
        description="Browse AstroYou’s birth chart tools, astrology guides, horoscopes and daily Panchang pages."
      />
      <h1 className="type-page-title mb-6">Explore AstroYou</h1>
      <p className="text-white/60 mb-8">
        Find a tool, learn about your chart, or check Panchang for your chosen
        date.
      </p>
      <nav aria-label="All tools and guides" className="space-y-10">
        {groups.map((group) => (
          <section key={group.title} aria-labelledby={`explore-${group.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
            <h2
              id={`explore-${group.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              className="font-body text-xs font-bold uppercase tracking-widest text-white/55"
            >
              {group.title}
            </h2>
            <p className="mt-1 mb-3 text-sm text-white/60">{group.blurb}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.links.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className="flex min-h-11 items-center rounded-xl border border-white/10 px-4 py-3 text-sm text-white/80 transition-colors hover:border-gold/30 hover:text-gold"
                >
                  {link.title}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </nav>
    </PageShell>
  );
}
