import { LegalPage } from "../components/legal/LegalPage";
import { LEGAL_EFFECTIVE_DATE, REFUND_SECTIONS } from "../lib/legal-policies";

export default function RefundPolicy() {
  return (
    <LegalPage
      title="Refund Policy"
      description="How failed payments, duplicate charges, unused credits, report failures, and consultation billing issues are reviewed."
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      sections={REFUND_SECTIONS}
    />
  );
}
