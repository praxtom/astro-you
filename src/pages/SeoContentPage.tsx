import { Link, Navigate } from "react-router-dom";
import { ArrowRight, BookOpen, MessageCircle } from "lucide-react";
import Header from "../components/layout/Header";
import SEO from "../components/SEO";
import Footer from "../components/layout/Footer";
import {
  captureAcquisitionSource,
  trackAcquisitionEvent,
} from "../lib/acquisition";
import {
  getRelatedSeoContentPages,
  getSeoClusterPages,
  getSeoClusterTitle,
  getSeoContentPage,
  getSeoContentFaqs,
  SEO_AUTHOR,
  SEO_CONTENT_REVIEWED,
  SEO_PUBLISHER,
} from "../lib/seo-content";

interface SeoContentPageProps {
  slug: string;
}

export default function SeoContentPage({ slug }: SeoContentPageProps) {
  const page = getSeoContentPage(slug);

  if (!page) {
    return <Navigate to="/" replace />;
  }
  const relatedPages = getRelatedSeoContentPages(slug);
  const clusterPages = getSeoClusterPages(slug);
  const clusterTitle = getSeoClusterTitle(slug);
  const faqs = getSeoContentFaqs(page);

  const pageUrl = `https://astroyou.app${page.path}`;
  const reviewed = page.updated ?? SEO_CONTENT_REVIEWED;
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": page.schemaType ?? "Article",
      headline: page.title,
      description: page.description,
      mainEntityOfPage: pageUrl,
      url: pageUrl,
      inLanguage: "en",
      datePublished: reviewed,
      dateModified: reviewed,
      isAccessibleForFree: true,
      author: {
        "@type": "Organization",
        name: SEO_AUTHOR.name,
        description: SEO_AUTHOR.role,
        url: SEO_PUBLISHER.url,
      },
      publisher: {
        "@type": "Organization",
        name: SEO_PUBLISHER.name,
        url: SEO_PUBLISHER.url,
        logo: { "@type": "ImageObject", url: SEO_PUBLISHER.logo },
        sameAs: SEO_PUBLISHER.sameAs,
      },
      keywords: page.keywords.join(", "),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: "https://astroyou.app/",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: page.heading,
          item: pageUrl,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `${page.heading} related guides`,
      itemListElement: relatedPages.map((related, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: related.heading,
        url: `https://astroyou.app${related.path}`,
      })),
    },
    ...(clusterPages.length
      ? [
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: clusterTitle,
            itemListElement: clusterPages.map((clusterPage, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: clusterPage.heading,
              url: `https://astroyou.app${clusterPage.path}`,
            })),
          },
        ]
      : []),
  ];

  const rememberSource = (target: string) => {
    captureAcquisitionSource({
      source: page.slug,
      medium: "seo_content",
      campaign: "seo_cluster",
    });
    trackAcquisitionEvent("seo_cta_click", {
      page: page.slug,
      target,
    });
  };

  return (
    <div className="min-h-screen bg-[#030308] text-white">
      <SEO
        title={page.title}
        description={page.description}
        url={pageUrl}
        canonical={pageUrl}
        type="article"
        structuredData={structuredData}
      />
      <Header />
      <main className="container mx-auto max-w-4xl px-6 pt-28 pb-20">
        <div className="mb-10">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-gold">
            <BookOpen size={14} />
            Vedic Astrology Guide
          </div>
          <h1 className="font-display text-4xl md:text-5xl">{page.heading}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/60">
            {page.intro}
          </p>
          <p className="mt-4 text-xs text-white/35">
            Reviewed {reviewed} by {SEO_AUTHOR.name} — {SEO_AUTHOR.role}
          </p>
        </div>

        <div className="grid gap-4">
          {page.sections.map((section) => (
            <section
              key={section.title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
            >
              <h2 className="font-display text-2xl text-white/90">
                {section.title}
              </h2>
              <p className="mt-3 leading-relaxed text-white/60">
                {section.body}
              </p>
            </section>
          ))}
        </div>

        {page.facts && page.facts.length > 0 && (
          <section className="mt-10 border-t border-white/10 pt-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-white/35">
              Key facts
            </h2>
            <dl className="mt-4 divide-y divide-white/[0.07]">
              {page.facts.map((fact) => (
                <div
                  key={fact.label}
                  className="flex items-baseline justify-between gap-6 py-3"
                >
                  <dt className="text-sm text-white/45">{fact.label}</dt>
                  <dd className="text-right">
                    <span className="text-sm font-semibold text-white/85">
                      {fact.value}
                    </span>
                    {fact.source && (
                      <span className="mt-0.5 block text-xs text-white/35">
                        {fact.source}
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {page.comparison && (
          <section className="mt-10 border-t border-white/10 pt-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-white/35">
              {page.comparison.caption}
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border border-white/10 p-3" />
                    {page.comparison.columns.map((column) => (
                      <th
                        key={column}
                        className="border border-white/10 p-3 text-left font-semibold text-white/80"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {page.comparison.rows.map((row) => (
                    <tr key={row.criterion}>
                      <th
                        scope="row"
                        className="border border-white/10 p-3 text-left font-medium text-white/60"
                      >
                        {row.criterion}
                      </th>
                      {row.values.map((value, index) => (
                        <td
                          key={`${row.criterion}-${index}`}
                          className="border border-white/10 p-3 align-top text-white/70"
                        >
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="mt-10 border-t border-white/10 pt-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-white/35">
            Common questions
          </h2>
          <div className="mt-4 grid gap-3">
            {faqs.map((faq) => (
              <article
                key={faq.question}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <h3 className="text-base font-semibold text-white/85">
                  {faq.question}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/50">
                  {faq.answer}
                </p>
              </article>
            ))}
          </div>
        </section>

        {clusterPages.length > 0 && (
          <section className="mt-10 border-t border-white/10 pt-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-white/35">
              {clusterTitle}
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {clusterPages.map((clusterPage) => {
                const isCurrent = clusterPage.slug === page.slug;
                return (
                  <Link
                    key={clusterPage.slug}
                    to={clusterPage.path}
                    aria-current={isCurrent ? "page" : undefined}
                    className={`rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                      isCurrent
                        ? "border-gold/50 bg-gold/15 text-gold"
                        : "border-white/10 bg-white/[0.03] text-white/55 hover:border-gold/30 hover:text-gold"
                    }`}
                  >
                    {clusterPage.heading}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          <Link
            to={page.primaryCta.to}
            onClick={() => rememberSource(page.primaryCta.to)}
            className="flex items-center justify-center gap-2 rounded-xl bg-gold px-5 py-4 text-sm font-bold uppercase tracking-widest text-black"
          >
            {page.primaryCta.label}
            <ArrowRight size={16} />
          </Link>
          <Link
            to={page.secondaryCta.to}
            onClick={() => rememberSource(page.secondaryCta.to)}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-5 py-4 text-sm font-bold uppercase tracking-widest text-white/70 hover:border-gold/30 hover:text-gold"
          >
            <MessageCircle size={16} />
            {page.secondaryCta.label}
          </Link>
        </div>

        <section className="mt-12 border-t border-white/10 pt-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-white/35">
            Related guides
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {relatedPages.map((related) => (
              <Link
                key={related.slug}
                to={related.path}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-gold/30"
              >
                <span className="text-sm font-semibold text-white/80">
                  {related.heading}
                </span>
                <span className="mt-2 line-clamp-2 block text-xs leading-relaxed text-white/40">
                  {related.description}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-12 border-t border-white/10 pt-8 text-xs leading-relaxed text-white/35">
          <p>{SEO_AUTHOR.statement}</p>
          <p className="mt-2">
            Astrological guidance is offered for reflection and self-awareness.
            It is not medical, legal, financial, or psychological advice.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
