# Analytics Goals

AstroYou tracks first-party product events only. The goal is to understand acquisition, activation, revenue, consult quality, reports, support, and trust without storing sensitive birth data, chat text, notes, questions, emails, or phone numbers in analytics params.

## Main Funnel

| Goal | Events |
| --- | --- |
| SEO acquisition | `page_view`, `seo_tool_complete`, `seo_cta_click` |
| Activation | `onboarding_complete`, `first_chat` |
| Consult conversion | `consult_profile_viewed`, `consult_started`, `consult_review_submitted` |
| Revenue | `pricing_pack_selected`, `payment_checkout_started`, `credit_topup_completed`, `first_payment` |
| Reports | `report_generation_started`, `report_generation_completed`, `report_generation_failed` |
| Trust/support | `trust_testimonial_submitted`, `support_ticket_submitted` |

## Dashboard Metrics

The admin funnel summary now exposes:

- pricing pack selections
- consult profile views
- consult starts
- consultation reviews submitted
- completed report generations
- failed report generations
- trust testimonials submitted
- payments and estimated revenue
- top acquisition sources
- top pages

## Privacy Rules

Blocked analytics param keys include:

- `email`
- `phone`
- `name`
- `fullName`
- `dob`
- `tob`
- `birthData`
- `message`
- `question`
- `notes`
- `bio`
- `sampleApproach`

Use product identifiers, categories, prices, and safe status labels instead.
