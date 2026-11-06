# AstroYou Persona Catalogue

The consult desk uses named AI astrologers today and can later replace the same records with human astrologer listings.

## Pricing Bands

| Band | Cost | Use |
| --- | ---: | --- |
| Standard | 5 credits/min | Common emotional, family, spiritual, and relationship guidance |
| Specialist | 8 credits/min | Career, wellness, and cross-life readings |
| Premium | 10 credits/min | Classical Jyotish, remedies, muhurat, and business timing |

## Current Roster

| Persona | Title | Specialty | Cost |
| --- | --- | --- | ---: |
| Guru Vidyanath | Spiritual Guide | Spiritual Guidance & Meditation | 5 |
| Arjun Sharma | Career Strategist | Career & Finance | 8 |
| Meera Devi | Relationship Guide | Love & Marriage | 5 |
| Pandit Raghunath | Traditional Jyotish Scholar | Traditional Jyotish & Remedies | 10 |
| Shanti Ma (id `dr-shanti`, kept for stored sessions) | Wellbeing Guide | Health & Wellbeing | 8 |
| Nanda Ji | Family Advisor | Family, Property & Muhurat | 5 |
| Ishaan Rao | Business Timing Advisor | Career & Business | 10 |
| Tara Kapoor | Life Pattern Reader | Love, Career & Self | 8 |

## Replacement Path

When real people are added, keep the same catalogue fields:

- `name`
- `title`
- `specialty`
- `bio`
- `profileIntro`
- `languages`
- `methods`
- `bestFor`
- `guidanceStyle`
- `sampleQuestions`
- `pricePerMin`

Do not add claims like verified, years of experience, degrees, review counts, or live availability unless they are real and backed by the admin/trust system. This includes honorifics that imply a qualification (for example "Dr."). Persona `id`s are stable keys stored in consult sessions; rename the display `name` only and never change an `id`.

## Guardrails In Prompts

- No persona gives investment, trading, or financial-product advice or promises financial outcomes. Career and business personas describe dasha/transit timing windows as periods for reflection and planning, and point money decisions to a qualified financial adviser.
- Wellbeing guidance stays preventive and non-diagnostic and suggests a doctor for serious concerns.
- Remedies and doshas are explained without fear-based pressure.
