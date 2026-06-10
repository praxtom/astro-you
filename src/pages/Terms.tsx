import { LegalPage } from "../components/legal/LegalPage";
import { LEGAL_EFFECTIVE_DATE, TERMS_SECTIONS } from "../lib/legal-policies";

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      description="The rules for using AstroYou, including AI guidance, credits, subscriptions, payments, and account responsibilities."
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      sections={TERMS_SECTIONS}
    />
  );
}
