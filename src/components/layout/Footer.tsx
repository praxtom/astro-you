import { Link } from "react-router-dom";

const toolLinks = [
  { label: "Free Kundali", href: "/free-kundali" },
  { label: "Kundali Matching", href: "/free-kundali-matching" },
  { label: "Today Panchang", href: "/panchang" },
  { label: "Muhurat Finder", href: "/muhurat" },
  { label: "Reports", href: "/reports" },
];

const guideLinks = [
  { label: "Kundali Guide", href: "/kundali" },
  { label: "Daily Horoscope", href: "/daily-horoscope" },
  { label: "Sade Sati", href: "/sade-sati" },
  { label: "Manglik Dosha", href: "/manglik" },
  { label: "Vedic Astrology", href: "/vedic-astrology" },
];

const platformLinks = [
  { label: "Jyotish Chat", href: "/synthesis" },
  { label: "AI Astrologers", href: "/consult" },
  { label: "Pricing", href: "/pricing" },
  { label: "Trust", href: "/trust" },
  { label: "Support", href: "/support" },
];

const legalLinks = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Refund Policy", href: "/refund-policy" },
  { label: "Disclaimer", href: "/disclaimer" },
  { label: "For Experts", href: "/experts/apply" },
  { label: "Help Center", href: "/help" },
];

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<{ label: string; href: string }>;
}) {
  return (
    <div>
      <span className="footer-title">{title}</span>
      <div className="flex flex-col gap-2.5">
        {links.map((link) => (
          <Link key={link.href} to={link.href} className="footer-link">
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="relative border-t border-white/[0.05] bg-[#030308] pt-12 pb-8">
      <div className="container mx-auto px-6">
        <div className="mb-10 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-[1.2fr_repeat(4,1fr)]">
          <div>
            <Link
              to="/"
              className="mb-4 block font-display text-2xl text-content-primary transition-colors hover:text-gold"
            >
              AstroYou
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-content-secondary">
              Vedic astrology tools, chart-aware guidance, reports, and trust
              systems built around the person asking.
            </p>
            <Link
              to="/trust"
              className="mt-5 inline-flex rounded-full border border-gold/25 px-3 py-2 text-xs font-bold uppercase text-gold transition-colors hover:bg-gold/10"
            >
              View transparency
            </Link>
          </div>

          <FooterColumn title="Tools" links={toolLinks} />
          <FooterColumn title="Guides" links={guideLinks} />
          <FooterColumn title="Platform" links={platformLinks} />
          <FooterColumn title="Company" links={legalLinks} />
        </div>

        <div className="flex flex-col justify-between gap-4 border-t border-white/[0.06] pt-6 text-xs text-content-tertiary md:flex-row md:items-center">
          <p>© 2026 AstroYou. All rights reserved.</p>
          <p>AI astrologers are labelled. Reviews and testimonials require real user submission.</p>
        </div>
      </div>
    </footer>
  );
}
