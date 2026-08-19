import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";

export interface LandingTrustSummary {
  totals?: {
    approvedTestimonials?: number;
    approvedReviews?: number;
    pendingPublicSubmissions?: number;
  };
  predictionFeedback?: {
    total?: number;
    helpfulRate?: number | null;
  };
}

interface CosmosToSelfStoryProps {
  trustSummary: LandingTrustSummary | null;
  onReveal: () => void;
}

const genesisMoments = [
  {
    marker: "Time",
    title: "The first breath becomes a coordinate.",
    body: "Your date, exact time, and birthplace anchor one unrepeatable point in the moving sky.",
  },
  {
    marker: "Sky",
    title: "The heavens leave an imprint.",
    body: "Planetary degrees, houses, and lunar mansions preserve the celestial atmosphere you arrived within.",
  },
  {
    marker: "Life",
    title: "The map begins to move with you.",
    body: "Dashas and transits turn that frozen instant into a living rhythm of potential, pressure, and choice.",
  },
] as const;

const translationMoments = [
  {
    verb: "Calculate",
    title: "Precision before interpretation",
    body: "We establish your sidereal chart from astronomical positions—not from a sun-sign shortcut.",
  },
  {
    verb: "Synthesize",
    title: "Patterns become a coherent story",
    body: "Placements, aspects, yogas, and time cycles are read together so one signal never speaks alone.",
  },
  {
    verb: "Accompany",
    title: "Guidance changes as the sky does",
    body: "Your natal promise stays constant while transits and dashas reveal what this particular season is asking of you.",
  },
] as const;

const guidanceSignals = [
  {
    label: "Now",
    title: "Real-time transits",
    body: "See where today’s sky touches your own chart.",
    position: "md:left-0 md:top-[12%]",
  },
  {
    label: "Balance",
    title: "Remedial upaay",
    body: "Choose grounded practices for difficult periods.",
    position: "md:right-0 md:top-[12%] md:text-right",
  },
  {
    label: "Cycles",
    title: "Dasha intelligence",
    body: "Understand the chapter beneath the current moment.",
    position: "md:bottom-[8%] md:left-0",
  },
  {
    label: "Depth",
    title: "Living chart views",
    body: "Move between the cosmic circle and sacred diamond.",
    position: "md:bottom-[8%] md:right-0 md:text-right",
  },
] as const;

const faqItems = [
  {
    question: "How is Vedic astrology different from Western astrology?",
    answer:
      "Vedic astrology, or Jyotish, uses the sidereal zodiac aligned to the observable constellations. It gives particular weight to the Moon, nakshatras, and dashas—the planetary time cycles used to understand when a potential is most likely to become active.",
  },
  {
    question: "Is my personal birth data kept private?",
    answer:
      "Yes. We treat birth data as sacred. Your information is encrypted, never sold, and used only to create your chart and personalize your AstroYou experience.",
  },
  {
    question: "Can Jyotish truly understand a birth chart?",
    answer:
      "AstroYou begins with rigorous astronomical calculation, then interprets the chart through established Jyotish frameworks. It offers perspective—not absolute certainty—and keeps the final act of discernment with you.",
  },
  {
    question: "What if I don't know my exact time of birth?",
    answer:
      "A recorded birth time gives the most precise houses and ascendant. Without it, AstroYou can still explore date- and location-based patterns, while clearly identifying which house-specific conclusions may be less certain.",
  },
] as const;

function StoryEyebrow({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.38em] text-gold/80 sm:text-xs">
      <span className="h-px w-10 bg-gold/70 shadow-[0_0_16px_rgba(229,185,106,0.6)]" />
      {children}
    </div>
  );
}

function FAQItem({ question, answer }: (typeof faqItems)[number]) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-white/10" data-faq-item>
      <button
        className="group flex w-full items-start justify-between gap-8 py-7 text-left sm:py-9"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
      >
        <span className="max-w-2xl font-display text-xl leading-snug text-white/84 transition-colors group-hover:text-gold sm:text-2xl">
          {question}
        </span>
        <ChevronDown
          className={`mt-1 shrink-0 text-gold transition-transform duration-300 ${
            isOpen ? "rotate-180" : ""
          }`}
          size={20}
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-500 ease-out ${
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <p className="max-w-2xl pb-8 text-base font-light leading-relaxed text-white/58 sm:text-lg">
            {answer}
          </p>
        </div>
      </div>
    </div>
  );
}

function TrustMetric({ label, value }: { label: string; value?: number | string }) {
  return (
    <div
      className="relative border-0 bg-transparent py-6 sm:py-8"
      data-surface-treatment="open"
    >
      <p className="font-display text-5xl leading-none text-gold sm:text-6xl lg:text-7xl">
        {value === undefined ? "—" : value}
      </p>
      <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.28em] text-white/38 sm:text-xs">
        {label}
      </p>
    </div>
  );
}

export default function CosmosToSelfStory({
  trustSummary,
  onReveal,
}: CosmosToSelfStoryProps) {
  const helpfulRate =
    trustSummary?.predictionFeedback?.helpfulRate !== null &&
    trustSummary?.predictionFeedback?.helpfulRate !== undefined
      ? `${trustSummary.predictionFeedback.helpfulRate}%`
      : "Listening";

  return (
    <div
      className="relative isolate overflow-hidden bg-[#030308] text-white"
      data-lower-story="cosmos-to-self"
    >
      <div
        className="pointer-events-none absolute bottom-0 left-6 top-0 z-20 w-px bg-gradient-to-b from-gold/0 via-gold/35 to-gold/0 shadow-[0_0_24px_rgba(229,185,106,0.22)] sm:left-10 lg:left-1/2"
        data-celestial-thread
        aria-hidden="true"
      >
        <span className="absolute top-[8%] left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-gold shadow-[0_0_25px_rgba(229,185,106,0.85)]" />
        <span className="absolute top-[37%] left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-violet-300 shadow-[0_0_22px_rgba(196,181,253,0.8)]" />
        <span className="absolute top-[69%] left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-gold shadow-[0_0_25px_rgba(229,185,106,0.8)]" />
      </div>

      <section
        className="relative min-h-[118svh] overflow-hidden px-8 py-28 sm:px-14 sm:py-36 lg:px-20 lg:py-44"
        data-lower-story-section="kundali"
        aria-labelledby="kundali-story-title"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_76%_40%,rgba(229,185,106,0.09),transparent_32%),linear-gradient(180deg,#030308_0%,#070610_48%,#030308_100%)]" />
        <div className="pointer-events-none absolute -right-[26vw] top-[9%] h-[92vw] w-[92vw] max-h-[76rem] max-w-[76rem] opacity-35 sm:-right-[18vw] sm:opacity-55 lg:-right-[8vw] lg:top-[6%] lg:opacity-70" aria-hidden="true">
          <img
            src="/assets/landing/coordinates.png"
            alt=""
            className="h-full w-full object-cover [mask-image:radial-gradient(circle,black_34%,rgba(0,0,0,0.76)_55%,transparent_73%)]"
          />
          <div className="absolute inset-[13%] rounded-full border border-gold/20 motion-safe:animate-[spin_80s_linear_infinite] motion-reduce:animate-none" />
          <div className="absolute inset-[23%] rotate-45 border border-violet-300/15 motion-safe:animate-[spin_100s_linear_infinite_reverse] motion-reduce:animate-none" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <StoryEyebrow>Where your map begins</StoryEyebrow>
            <h2
              id="kundali-story-title"
              className="mt-7 font-display text-5xl leading-[0.98] tracking-[-0.035em] text-white sm:text-6xl md:text-7xl lg:text-[6.8rem]"
              style={{ fontSize: "clamp(3rem, 7.3vw, 6.8rem)" }}
            >
              One breath.
              <br />
              <span className="font-light italic text-gold">An entire sky.</span>
            </h2>
            <p className="mt-8 max-w-xl text-lg font-light leading-relaxed text-white/64 sm:text-xl">
              A Kundali is the memory of the heavens at your arrival—translated into a map you can return to throughout your life.
            </p>
          </div>

          <div className="mt-24 max-w-xl space-y-16 sm:mt-32 sm:space-y-20 lg:mt-40">
            {genesisMoments.map((moment) => (
              <article
                key={moment.marker}
                className="relative border-0 bg-transparent pl-8"
                data-surface-treatment="open"
              >
                <span className="absolute left-0 top-1 h-10 w-px bg-gradient-to-b from-gold to-transparent shadow-[0_0_12px_rgba(229,185,106,0.45)]" />
                <p className="text-[10px] font-black uppercase tracking-[0.36em] text-gold/70">
                  {moment.marker}
                </p>
                <h3 className="mt-3 font-display text-2xl leading-tight text-white sm:text-3xl">
                  {moment.title}
                </h3>
                <p className="mt-4 max-w-lg text-base font-light leading-relaxed text-white/56 sm:text-lg">
                  {moment.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        className="relative min-h-[110svh] overflow-hidden px-8 py-28 sm:px-14 sm:py-36 lg:px-20 lg:py-44"
        data-lower-story-section="translation"
        id="journey"
        aria-labelledby="translation-story-title"
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,#030308_5%,#080612_48%,#030308_86%)]" />
        <div className="pointer-events-none absolute -left-[28rem] top-[-12rem] h-[60rem] w-[60rem] opacity-30 sm:-left-[20rem] sm:opacity-40 lg:left-[-10rem]" aria-hidden="true">
          <img
            src="/assets/landing/synthesis.png"
            alt=""
            className="h-full w-full object-cover [mask-image:radial-gradient(circle,black_32%,rgba(0,0,0,0.5)_55%,transparent_72%)]"
          />
        </div>
        <div className="pointer-events-none absolute -bottom-56 -right-56 h-[44rem] w-[44rem] opacity-25 sm:opacity-35" aria-hidden="true">
          <img
            src="/assets/landing/blueprint.png"
            alt=""
            className="h-full w-full object-cover [mask-image:radial-gradient(circle,black_30%,rgba(0,0,0,0.45)_52%,transparent_72%)]"
          />
        </div>

        <div className="relative z-10 mx-auto grid max-w-7xl gap-20 lg:grid-cols-[0.85fr_1.15fr] lg:gap-28">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <StoryEyebrow>From calculation to meaning</StoryEyebrow>
            <h2
              id="translation-story-title"
              className="mt-7 max-w-xl font-display text-5xl leading-[1.01] tracking-[-0.03em] text-white sm:text-6xl lg:text-7xl"
              style={{ fontSize: "clamp(2.8rem, 5.4vw, 4.8rem)" }}
            >
              Wisdom should feel
              <span className="font-light italic text-violet-200"> clear.</span>
            </h2>
            <p className="mt-7 max-w-md text-base font-light leading-relaxed text-white/56 sm:text-lg">
              AstroYou does not flatten Jyotish into fortune-cookie predictions. It holds the complexity, then returns what matters in language you can use.
            </p>
          </div>

          <ol className="space-y-24 lg:pt-32">
            {translationMoments.map((moment, index) => (
              <li
                key={moment.verb}
                className="relative border-0 bg-transparent pl-10 sm:pl-14"
                data-surface-treatment="open"
              >
                <span className="absolute left-0 top-0 font-display text-4xl font-light italic text-gold/32 sm:text-5xl">
                  {index + 1}
                </span>
                <p className="text-[10px] font-black uppercase tracking-[0.36em] text-gold/72">
                  {moment.verb}
                </p>
                <h3 className="mt-4 max-w-xl font-display text-3xl leading-tight text-white sm:text-4xl">
                  {moment.title}
                </h3>
                <p className="mt-5 max-w-lg text-base font-light leading-relaxed text-white/55 sm:text-lg">
                  {moment.body}
                </p>
                <div className="mt-10 h-px w-full bg-gradient-to-r from-white/15 via-white/5 to-transparent" />
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        className="relative min-h-[115svh] overflow-hidden px-8 py-28 sm:px-14 sm:py-36 lg:px-20 lg:py-44"
        data-lower-story-section="guidance"
        id="features"
        aria-labelledby="guidance-story-title"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(84,57,138,0.14),transparent_37%),linear-gradient(180deg,#030308,#07050e_52%,#030308)]" />
        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <div className="flex justify-center">
              <StoryEyebrow>A companion in motion</StoryEyebrow>
            </div>
            <h2
              id="guidance-story-title"
              className="mt-7 font-display text-5xl leading-[1.01] tracking-[-0.035em] text-white sm:text-6xl lg:text-[5.5rem]"
              style={{ fontSize: "clamp(2.8rem, 6vw, 5.5rem)" }}
            >
              Your chart is not a verdict.
              <br />
              <span className="font-light italic text-gold">It is a conversation.</span>
            </h2>
          </div>

          <div className="relative mx-auto mt-16 min-h-[52rem] max-w-6xl sm:mt-24 md:min-h-[46rem]">
            <div className="pointer-events-none absolute left-1/2 top-[42%] aspect-square w-[min(84vw,34rem)] -translate-x-1/2 -translate-y-1/2 md:top-1/2" aria-hidden="true">
              <img
                src="/assets/landing/transits.png"
                alt=""
                className="absolute inset-[10%] h-[80%] w-[80%] object-cover opacity-40 [mask-image:radial-gradient(circle,black_25%,rgba(0,0,0,0.62)_48%,transparent_72%)]"
              />
              <div className="absolute inset-0 rounded-full border border-gold/16 shadow-[0_0_90px_rgba(229,185,106,0.08)] motion-safe:animate-[spin_90s_linear_infinite] motion-reduce:animate-none">
                <span className="absolute left-1/2 top-[-4px] h-2 w-2 -translate-x-1/2 rounded-full bg-gold shadow-[0_0_20px_rgba(229,185,106,0.9)]" />
              </div>
              <div className="absolute inset-[13%] rotate-[28deg] rounded-full border border-violet-300/14 motion-safe:animate-[spin_65s_linear_infinite_reverse] motion-reduce:animate-none">
                <span className="absolute left-[15%] top-[8%] h-1.5 w-1.5 rounded-full bg-violet-200 shadow-[0_0_18px_rgba(196,181,253,0.9)]" />
              </div>
              <div className="absolute inset-[28%] flex flex-col items-center justify-center rounded-full border border-white/10 text-center">
                <span className="text-[9px] font-black uppercase tracking-[0.34em] text-white/34">Your sky</span>
                <span className="mt-2 font-display text-3xl text-white sm:text-4xl">Today</span>
              </div>
            </div>

            <div className="relative grid gap-10 pt-[31rem] md:absolute md:inset-0 md:block md:pt-0">
              {guidanceSignals.map((signal) => (
                <article
                  key={signal.title}
                  className={`border-0 bg-transparent md:absolute md:w-64 ${signal.position}`}
                  data-surface-treatment="open"
                >
                  <p className="text-[9px] font-black uppercase tracking-[0.34em] text-gold/66">
                    {signal.label}
                  </p>
                  <h3 className="mt-2 font-display text-2xl text-white">{signal.title}</h3>
                  <p className="mt-3 text-sm font-light leading-relaxed text-white/50 sm:text-base">
                    {signal.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        className="relative min-h-[100svh] overflow-hidden px-8 py-28 sm:px-14 sm:py-36 lg:px-20 lg:py-44"
        data-lower-story-section="philosophy-proof"
        id="philosophy"
        aria-labelledby="philosophy-story-title"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_25%_40%,rgba(229,185,106,0.08),transparent_42%),linear-gradient(135deg,#05040a,#030308_58%)]" />
        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="grid gap-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:gap-24">
            <div>
              <StoryEyebrow>What we believe</StoryEyebrow>
              <h2
                id="philosophy-story-title"
                className="mt-8 max-w-4xl font-display text-5xl leading-[1.02] tracking-[-0.035em] text-white sm:text-6xl lg:text-[6rem]"
                style={{ fontSize: "clamp(3rem, 6.4vw, 6rem)" }}
              >
                The sky describes the weather.
                <br />
                <span className="font-light italic text-gold">You still choose the path.</span>
              </h2>
            </div>
            <div className="pb-2">
              <p className="text-lg font-light leading-relaxed text-white/60">
                Jyotish reveals patterns, timing, and possibility. AstroYou does not manufacture certainty or replace your judgment. It helps you meet a season with more awareness.
              </p>
              <p className="mt-6 font-display text-lg italic leading-relaxed text-violet-200/78">
                Ancient lineage, modern clarity, and the humility to distinguish insight from inevitability.
              </p>
            </div>
          </div>

          <div className="mt-28 h-px w-full bg-gradient-to-r from-gold/45 via-white/10 to-transparent sm:mt-36" />
          <div className="mt-8 grid gap-4 sm:grid-cols-3 sm:gap-8">
            <TrustMetric
              label="Approved stories"
              value={trustSummary?.totals?.approvedTestimonials}
            />
            <TrustMetric
              label="Approved reviews"
              value={trustSummary?.totals?.approvedReviews}
            />
            <TrustMetric label="Helpful feedback" value={helpfulRate} />
          </div>
          <p className="mt-8 max-w-2xl text-xs leading-relaxed text-white/32 sm:text-sm">
            Public stories appear only after genuine submission and moderation. Feedback is reported as an aggregate signal, never inflated social proof.
          </p>
        </div>
      </section>

      <section
        className="relative min-h-[88svh] px-8 py-28 sm:px-14 sm:py-36 lg:px-20 lg:py-44"
        data-lower-story-section="questions"
        aria-labelledby="questions-story-title"
      >
        <div className="relative z-10 mx-auto grid max-w-7xl gap-16 lg:grid-cols-[0.72fr_1.28fr] lg:gap-24">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <StoryEyebrow>Before you begin</StoryEyebrow>
            <h2
              id="questions-story-title"
              className="mt-7 font-display text-5xl leading-[1.02] tracking-[-0.03em] text-white sm:text-6xl"
              style={{ fontSize: "clamp(2.4rem, 4.6vw, 4rem)" }}
            >
              Questions deserve
              <span className="font-light italic text-gold"> clear answers.</span>
            </h2>
          </div>
          <div className="border-t border-white/10">
            {faqItems.map((item) => (
              <FAQItem key={item.question} {...item} />
            ))}
          </div>
        </div>
      </section>

      <section
        className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-8 py-28 text-center sm:px-14"
        data-lower-story-section="invitation"
        aria-labelledby="invitation-story-title"
      >
        <div className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[min(105vw,58rem)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_42%_38%,#151020_0%,#080711_54%,#010103_72%)] shadow-[0_0_150px_rgba(229,185,106,0.12)]" aria-hidden="true">
          <div className="absolute inset-[-1px] rounded-full border border-gold/25 shadow-[inset_0_0_80px_rgba(229,185,106,0.05),0_0_45px_rgba(229,185,106,0.13)]" />
          <div className="absolute -inset-[6%] rounded-full border border-violet-300/8 motion-safe:animate-[spin_75s_linear_infinite] motion-reduce:animate-none">
            <span className="absolute left-[18%] top-[8%] h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_18px_rgba(229,185,106,0.85)]" />
          </div>
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_10%,rgba(3,3,8,0.18)_45%,#030308_74%)]" />

        <div
          className="relative z-10 mx-auto max-w-4xl border-0 bg-transparent"
          data-surface-treatment="open"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.42em] text-gold/72 sm:text-xs">
            The sky is already in motion
          </p>
          <h2
            id="invitation-story-title"
            className="mt-7 font-display text-5xl leading-[0.98] tracking-[-0.035em] text-white sm:text-7xl lg:text-[7rem]"
            style={{ fontSize: "clamp(3.2rem, 7.4vw, 7rem)" }}
          >
            Meet the map
            <br />
            <span className="font-light italic text-gold">that began with you.</span>
          </h2>
          <p className="mx-auto mt-8 max-w-xl text-base font-light leading-relaxed text-white/58 sm:text-lg">
            Begin with a free birth chart. Keep the guidance that feels true, useful, and alive in your own experience.
          </p>
          <button className="btn btn-primary group mt-10 px-10" onClick={onReveal}>
            Reveal my birth sky
            <Sparkles
              className="ml-3 transition-transform duration-300 group-hover:rotate-12"
              size={18}
            />
          </button>
          <p className="mt-6 text-[10px] uppercase tracking-[0.28em] text-white/30">
            No credit card required
          </p>
        </div>
      </section>
    </div>
  );
}
