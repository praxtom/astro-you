# AstroYou Product Rethink (November 2026)

Recorded 2026-11-07 after the product review, the engine and API audit, and the review-fixes branch (`product-review-fixes-2026-11`).

## Verdict

The thesis is right: astrology as the language, emotional support as the value, memory as the moat. AstroTalk and AstroSage sell minutes. We sell a guide who knows your chart and remembers your story.

The shape is wrong. The app is built like AstroSage with a chat attached: about 45 routes and six spaces, plus numerology, Human Design, tarot, astro map, eclipses, a report store, eight personas, Altar, Journal, Dharma and Prana. Much of the breadth caused today's bugs: unwired hooks, a streak that never counted, guest cards stuck on "refreshing", seven API calls per dashboard visit, and the ascendant and Moon sign lost between pages. The most valuable moment, someone anxious about a relationship, was spread across four separate features.

## Four architectural moves (in order)

### 1. Make the guide the home screen (REVISED 2026-11-07)

**Decision:** keep the dashboard as home and improve it instead. See `docs/mockups/dashboard-v2.html`: personal check-in card, "chart in three lines", chart-based "Today, for you" with "Why this?", the five spaces, secondary items folded. The chat stays light: short bubbles in the user's language (Hinglish where they write it), one or two reply chips, the chart in a side drawer, and honest identity when asked. The original guide-first idea is kept below for reference (`docs/mockups/guide-home.html`).

- One home: the conversation, opening with "Your chart in three lines" and today's sky.
- Chart, dasha, compatibility, breathing and journal become things the guide shows or does inside the conversation (cards and actions), not pages to navigate to.
- Keep the SEO tool pages for discovery. Cut in-app destinations to four: Guide, My Story, Chart, Settings.
- Park tarot, Human Design, astro map and numerology unless usage data says otherwise.

### 2. Organise around life threads, not chats

- Users return to "things with Rahul" or "the job decision", not "chat #14".
- "My Story" is a set of threads. Each thread holds what is happening, what the chart says, what you decided to try, and when the guide will check in.
- Memory becomes something users can see and co-own, not a hidden extraction.

### 3. Compute the astrology ourselves

- Positions, ayanamsa, nakshatra, dashas, Panchang and transits are deterministic maths.
- Today they depend on a 1,000-call/month API plan, network latency and fragile response mapping. That made quota exhaustion a risk to the whole product and caused most of the 20 engine findings.
- Build one in-house engine that writes one canonical chart object at onboarding, which everything reads. Keep an external API only where it adds something we can't compute.
- Plan and inventory: see "Compute it ourselves" below.

### 4. Pricing: don't bill anxious people per message

- Credits per message or per minute copy AstroTalk's meter. That taxes talking when you're struggling and rewards longer conversations.
- A companion should be a subscription (about ₹149–299/month, fair use), with credits only for deep reports.
- Run one guide with adjustable tone, sharing one memory, instead of eight metered personas.

## Keep

- The stack: Vite, React, Netlify, Firebase, Gemini.
- The voice and the low-pressure positioning.
- The safety layer, honest identity, and memory controls built on the review-fixes branch.

## Missing for India

- A full Hindi interface.
- WhatsApp as the check-in channel ("you mentioned things felt distant — how's this week?"). Move it up the roadmap.

## Sequencing (about 6–8 weeks; no big-bang rewrite)

1. Own the maths and build the canonical chart object. This removes the quota risk.
2. Make the guide the home screen and turn chats into My Story threads.
3. Introduce the subscription, with check-ins on WhatsApp.

**Measure:** time to first personal insight, 7-day return rate, check-in reply rate.

**Evidence vs judgement:** moves 1–3 rest on findings from the review and audit. Move 4 and the parking list are product judgement to test.

## Compute it ourselves: inventory of the 51 API endpoints in use

Source: `netlify/functions/shared/astro-api.ts` (51 distinct endpoints as of 2026-11-07).

### A. Pure astronomy and rule-based maths: compute fully in-house

| Area                                   | Endpoints today                                                                 | In-house approach                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Planet positions (natal, transit, now) | `/charts/natal`, `/charts/transit`, `/data/now`, `/vedic/divisional-chart` (D1) | Ephemeris library (astronomy-engine, MIT) + Lahiri ayanamsa + mean/true node |
| Lagna and houses                       | (inside the above)                                                              | Ascendant from sidereal time; whole-sign (Vedic); Placidus for Western       |
| Nakshatra, pada                        | (inside the above)                                                              | 13°20′ division of sidereal longitude                                        |
| Divisional charts D2–D60               | `/vedic/divisional-chart`                                                       | Standard Parashari varga formulas                                            |
| Vimshottari dasha (MD/AD/PD)           | `/vedic/vimshottari-dasha`                                                      | Moon nakshatra balance + 120-year cycle                                      |
| Panchang, sunrise/sunset, Rahu Kaal    | `/vedic/panchang`                                                               | Sun–Moon angles + rise/set search                                            |
| Festivals                              | `/vedic/festival-calendar`                                                      | Tithi/masa rules per festival (regional rules need care)                     |
| Manglik, Kaal Sarpa, Sade Sati         | `/vedic/manglik-dosha`, `/vedic/kaal-sarpa-dosha`, `/vedic/sade-sati`           | Rule checks on the chart + Saturn ingress search                             |
| Kundali matching (Ashtakoot)           | `/vedic/kundli-matching`                                                        | Standard koota tables                                                        |
| Ashtakavarga                           | `/vedic/ashtakvarga`                                                            | Parashari bindu tables                                                       |
| Yogas                                  | `/vedic/yoga-analysis`                                                          | Rule set for the yogas we show                                               |
| Shadbala                               | `/vedic/shadbala`                                                               | Six-fold strength formulas (largest rule set)                                |
| Varshaphal                             | `/vedic/varshaphal`                                                             | Solar-return search + Tajik basics                                           |
| Lunar phases, void of course           | `/lunar/phases`, `/lunar/void-of-course`                                        | Ephemeris                                                                    |
| Eclipses (upcoming, natal contacts)    | `/eclipses/upcoming`, `/eclipses/natal-check`                                   | Ephemeris eclipse search + orb check                                         |
| Synastry aspects                       | `/charts/synastry`, `/insights/relationship/compatibility` (maths part)         | Aspect maths between two charts                                              |
| Astrocartography                       | `/astrocartography/lines`, `/power-zones`, `/location-analysis`                 | MC/IC/ASC/DSC line maths                                                     |
| Human Design                           | `/human-design/type`, `/human-design/bodygraph`                                 | Positions at birth and at 88° solar arc → gate/channel tables                |
| Numerology                             | `/numerology/comprehensive`, `/core-numbers`, `/compatibility`                  | Arithmetic                                                                   |
| Biorhythms                             | `/insights/wellness/biorhythms`                                                 | Sine cycles                                                                  |
| Tarot draws                            | `/tarot/cards/daily`, `/cards/draw`, `/reports/three-card`                      | Seeded draw + our own card meanings                                          |

### B. Interpretation text: compute the inputs ourselves, write our own text

Personal and sign horoscopes (8 endpoints), `/vedic/nakshatra-predictions`, `/vedic/remedies`, `/analysis/natal-transit-report`, `/eclipses/interpretation`, `/insights/wellness/*` scores. Approach: deterministic factors from the in-house engine, then our own templates plus Gemini under the guidance policy.

### C. Rendering and documents: build ourselves

`/render/natal`, `/render/transit`, `/render/synastry`, `/human-design/bodygraph-svg`, `/pdf/natal-report`, `/pdf/horoscope/daily`, `/pdf/horoscope/weekly`. We already render the Kundali SVG client-side; PDFs move to our own generator.

### Stages

1. **Core engine:** positions, ayanamsa, nodes, lagna, houses, timezone, nakshatra, vargas, dasha, Panchang, plus one canonical chart object. Validate against reference charts. Switch `kundali.ts` behind `ASTRO_ENGINE=local|api`.
2. **Rule engines:** doshas, matching, Ashtakavarga, yogas, lunar, eclipses, numerology, biorhythms, tarot.
3. **Heavy rules:** Shadbala, Varshaphal, astrocartography, Human Design, festivals.
4. **Text and rendering:** our own interpretations, SVGs and PDFs. Retire the API plan.
