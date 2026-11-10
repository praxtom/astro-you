import SEO from "../SEO";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import type { LegalSection } from "../../lib/legal-policies";

export function LegalPage({
  title,
  description,
  effectiveDate,
  sections,
}: {
  title: string;
  description: string;
  effectiveDate: string;
  sections: LegalSection[];
}) {
  return (
    <div>
      <SEO title={title} description={description} />
      <div className="platform-main max-w-4xl">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-white/55 transition-colors hover:text-white"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to home
        </Link>

        <section className="mb-6">
          <p className="platform-eyebrow mb-2">AstroYou policy</p>
          <h1 className="type-page-title max-w-3xl">{title}</h1>
          <p className="platform-copy mt-3 max-w-2xl">{description}</p>
          <p className="type-meta mt-4 text-white/50">
            Effective date: {effectiveDate}
          </p>
        </section>

        {/* Policy text is read in full: body size and a ~70ch measure, not
            the 12.8px dashboard caption style it used before. */}
        <section className="platform-panel divide-y divide-white/10">
          {sections.map((section) => (
            <article key={section.title} className="p-5 sm:p-6">
              <h2 className="type-section-title text-gold">{section.title}</h2>
              <div className="mt-3 max-w-[70ch] space-y-3">
                {section.content.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="text-[0.9375rem] leading-relaxed text-white/70"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
