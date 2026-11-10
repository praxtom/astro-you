import { LegalPage } from "../components/legal/LegalPage";
import { DISCLAIMER_SECTIONS, LEGAL_EFFECTIVE_DATE } from "../lib/legal-policies";

export default function Disclaimer() {
  return (
    <LegalPage
      title="Astrology and Guidance Disclaimer"
      description="Clear limits around astrology, automated guidance, remedies, predictions, and professional advice."
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      sections={DISCLAIMER_SECTIONS}
    />
  );
}
