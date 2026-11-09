import { getMergedSeoGuide, getSeoContentFaqs } from "../../lib/seo-content";

/**
 * The reference guide that used to live at its own URL (e.g. /panchang-today),
 * rendered under the tool it describes so one page answers the search.
 */
export function MergedGuide({ toolPath }: { toolPath: string }) {
  const guide = getMergedSeoGuide(toolPath);
  if (!guide) return null;
  const faqs = getSeoContentFaqs(guide);

  return (
    <section
      className="mt-16 border-t border-white/10 pt-10"
      aria-labelledby="guide-heading"
    >
      <h2 id="guide-heading" className="font-display text-3xl text-white/90">
        {guide.heading}
      </h2>
      <p className="mt-3 max-w-2xl leading-relaxed text-white/60">
        {guide.intro}
      </p>

      <div className="mt-8 grid gap-4">
        {guide.sections.map((section) => (
          <div
            key={section.title}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
          >
            <h3 className="font-display text-xl text-white/90">
              {section.title}
            </h3>
            <p className="mt-3 leading-relaxed text-white/60">{section.body}</p>
          </div>
        ))}
      </div>

      {faqs.length > 0 && (
        <div className="mt-10">
          <h3 className="text-sm font-semibold text-white/70">
            Common questions
          </h3>
          <div className="mt-4 grid gap-3">
            {faqs.map((faq) => (
              <div
                key={faq.question}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <h4 className="text-base font-semibold text-white/85">
                  {faq.question}
                </h4>
                <p className="mt-2 text-sm leading-relaxed text-white/60">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
