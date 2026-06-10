import { LegalPage } from "../components/legal/LegalPage";
import { LEGAL_EFFECTIVE_DATE, PRIVACY_SECTIONS } from "../lib/legal-policies";

export default function PrivacyPolicy() {
  return (
    <LegalPage
      title="Privacy Policy"
      description="How AstroYou collects, uses, stores, shares, exports, and deletes account, astrology, AI, payment, and support data."
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      sections={PRIVACY_SECTIONS}
    />
  );
}
