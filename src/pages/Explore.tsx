import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { PageShell } from '../components/layout/PageShell';
import { SEO_CONTENT_PAGES } from '../lib/seo-content';
import { PUBLIC_TOOL_PAGES } from '../lib/seo-public';
import { ZODIAC_SIGNS } from '../lib/sign-horoscope-content';

export default function Explore() {
  const links = [
    ...PUBLIC_TOOL_PAGES.map(page => ({ path: page.path, title: page.title })),
    ...SEO_CONTENT_PAGES.map(page => ({ path: page.path, title: page.heading })),
    ...ZODIAC_SIGNS.map(sign => ({ path: `/horoscope/${sign.slug}`, title: `${sign.name} Horoscope` })),
    ...['business', 'marriage', 'property', 'travel'].map(category => ({ path: `/muhurat/${category}`, title: `${category[0].toUpperCase()}${category.slice(1)} Muhurat` })),
    ...['pricing', 'help', 'support', 'privacy', 'terms', 'refund-policy', 'disclaimer', 'wellness', 'human-design', 'advanced-vedic', 'astromap', 'experts/apply'].map(path => ({ path: `/${path}`, title: path.split('-').join(' ').split('/').join(' ') })),
  ];
  return <PageShell noTabs>
    <SEO title="Explore Astrology Tools & Guides" description="Browse AstroYou’s birth chart tools, astrology guides, horoscopes and daily Panchang pages." />
    <h1 className="type-page-title mb-6">Explore AstroYou</h1>
    <p className="text-white/60 mb-8">Find a tool, learn about your chart, or check Panchang for your chosen date.</p>
    <nav aria-label="All tools and guides" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[...new Map(links.map(link => [link.path, link])).values()].map(link =>
        <Link key={link.path} to={link.path} className="rounded-xl border border-white/10 p-4 text-gold hover:bg-white/5">{link.title}</Link>)}
    </nav>
  </PageShell>;
}
