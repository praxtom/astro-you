export const ANALYTICS_EVENTS = [
  "page_view",
  "acquisition_source_captured",
  "seo_tool_complete",
  "seo_cta_click",
  "onboarding_complete",
  "first_chat",
  "first_payment",
  "consult_profile_viewed",
  "consult_started",
  "consult_review_submitted",
  "pricing_free_selected",
  "pricing_login_required",
  "pricing_pack_selected",
  "payment_checkout_started",
  "topup_login_required",
  "credit_topup_completed",
  "report_generation_started",
  "report_generation_completed",
  "report_generation_failed",
  "remedy_request_submitted",
  "support_ticket_submitted",
  "trust_testimonial_submitted",
  "expert_application_submitted",
] as const;

export type FunnelEventName = (typeof ANALYTICS_EVENTS)[number];

export const PRODUCT_ANALYTICS_GOALS = [
  {
    key: "acquisition",
    label: "SEO acquisition",
    events: ["page_view", "seo_tool_complete", "seo_cta_click"],
  },
  {
    key: "activation",
    label: "Activation",
    events: ["onboarding_complete", "first_chat"],
  },
  {
    key: "consult",
    label: "Consult conversion",
    events: ["consult_profile_viewed", "consult_started", "consult_review_submitted"],
  },
  {
    key: "revenue",
    label: "Revenue",
    events: ["pricing_pack_selected", "payment_checkout_started", "credit_topup_completed"],
  },
  {
    key: "reports",
    label: "Reports",
    events: ["report_generation_started", "report_generation_completed", "report_generation_failed"],
  },
  {
    key: "trust",
    label: "Trust",
    events: ["trust_testimonial_submitted", "support_ticket_submitted"],
  },
] as const;

export function isAnalyticsEventName(value: unknown): value is FunnelEventName {
  return (
    typeof value === "string" &&
    (ANALYTICS_EVENTS as readonly string[]).includes(value)
  );
}
