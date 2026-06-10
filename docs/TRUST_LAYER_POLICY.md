# Trust Layer Policy

AstroYou should use trust signals only when they are backed by user action, moderation, or operational records.

## Public Signals

| Signal | Source | Public rule |
| --- | --- | --- |
| Review | Post-consultation rating prompt | Public only after user allows public use and admin approves it |
| Testimonial | User-submitted story | Public only after opt-in, moderation, and approval |
| Prediction feedback | User marks forecast accurate, partly accurate, or missed | Aggregate-only; do not expose private feedback |
| Expert profile | Expert application and operations review | No verified, degree, experience, or availability claim until backed by records |

## Not Allowed

- Fake reviews.
- Fake testimonials.
- Fake consult counts.
- Fake verified astrologer badges.
- Fake live availability.
- Fake degrees or experience.
- Guaranteed prediction accuracy claims.

## Current Product State

- The public Trust page explains the rules.
- Consult cards show approved review proof only when approved records exist.
- Empty review states say collecting reviewed feedback instead of inventing numbers.
- Prediction feedback is stored as aggregate signal.
- Admin moderation controls exist for public testimonials and reviews.
