export interface FunnelSummaryEvent {
  eventName?: unknown;
  path?: unknown;
  params?: unknown;
  acquisition?: unknown;
}

export function buildFunnelSummary(events: FunnelSummaryEvent[]) {
  const counters = {
    totalEvents: events.length,
    pageViews: 0,
    seoToolCompletions: 0,
    seoCtaClicks: 0,
    onboardingCompletions: 0,
    firstChats: 0,
    consultProfileViews: 0,
    consultStarts: 0,
    consultReviews: 0,
    pricingPackSelections: 0,
    reportGenerations: 0,
    reportGenerationFailures: 0,
    payments: 0,
    supportTickets: 0,
    testimonialsSubmitted: 0,
    remedyRequests: 0,
    expertApplications: 0,
    estimatedRevenue: 0,
  };
  const sourceCounts = new Map<string, number>();
  const pageCounts = new Map<string, number>();

  for (const event of events) {
    const eventName = typeof event.eventName === "string" ? event.eventName : "";
    const path = typeof event.path === "string" && event.path ? event.path : "unknown";
    increment(pageCounts, path);

    const acquisition = isRecord(event.acquisition) ? event.acquisition : {};
    const source =
      typeof acquisition.source === "string" && acquisition.source
        ? acquisition.source
        : "direct";
    increment(sourceCounts, source);

    switch (eventName) {
      case "page_view":
        counters.pageViews += 1;
        break;
      case "seo_tool_complete":
        counters.seoToolCompletions += 1;
        break;
      case "seo_cta_click":
        counters.seoCtaClicks += 1;
        break;
      case "onboarding_complete":
        counters.onboardingCompletions += 1;
        break;
      case "first_chat":
        counters.firstChats += 1;
        break;
      case "consult_profile_viewed":
        counters.consultProfileViews += 1;
        break;
      case "consult_started":
        counters.consultStarts += 1;
        break;
      case "consult_review_submitted":
        counters.consultReviews += 1;
        break;
      case "pricing_pack_selected":
        counters.pricingPackSelections += 1;
        break;
      case "report_generation_completed":
        counters.reportGenerations += 1;
        break;
      case "report_generation_failed":
        counters.reportGenerationFailures += 1;
        break;
      case "credit_topup_completed":
      case "first_payment":
        counters.payments += 1;
        counters.estimatedRevenue += getAmount(event.params);
        break;
      case "support_ticket_submitted":
        counters.supportTickets += 1;
        break;
      case "trust_testimonial_submitted":
        counters.testimonialsSubmitted += 1;
        break;
      case "remedy_request_submitted":
        counters.remedyRequests += 1;
        break;
      case "expert_application_submitted":
        counters.expertApplications += 1;
        break;
    }
  }

  return {
    ...counters,
    paidConversionRate:
      counters.onboardingCompletions > 0
        ? (counters.payments / counters.onboardingCompletions) * 100
        : 0,
    topSources: topEntries(sourceCounts, "source"),
    topPages: topEntries(pageCounts, "path"),
  };
}

function getAmount(params: unknown) {
  const record = isRecord(params) ? params : {};
  const amount = Number(record.amount);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function increment(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) || 0) + 1);
}

function topEntries(map: Map<string, number>, keyName: "source" | "path") {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => ({ [keyName]: key, count }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
