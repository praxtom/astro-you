import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const sections = [
  {
    title: "1. Information We Collect",
    content: `We collect the following information to provide personalized Vedic astrology services:

- **Birth Data**: Date, time, and place of birth used for astrological calculations.
- **Account Information**: Email address and display name for authentication.
- **Chat Messages**: Conversations with our AI astrologer to provide contextual guidance.
- **Consciousness Data**: Emotional states, routines, and intentions you share with the Atman system.
- **Usage Data**: Pages visited and features used to improve the service.`,
  },
  {
    title: "2. How We Use Your Data",
    content: `Your data is used exclusively to:

- Generate accurate Vedic birth charts and astrological calculations.
- Provide personalized AI-powered astrological analysis and predictions.
- Remember your spiritual journey context across sessions.
- Improve the accuracy and relevance of our guidance over time.

We never sell your personal data to third parties.`,
  },
  {
    title: "3. Data Storage and Security",
    content: `Your data is stored securely in Google Firebase Firestore with encryption at rest and in transit. Access to your personal data is restricted to your authenticated account only. Server-side operations use Firebase Admin SDK with strict security rules.`,
  },
  {
    title: "4. Third-Party Services",
    content: `We use the following third-party services to operate AstroYou:

- **Astrology API (astrology-api.io)**: Receives birth data to compute planetary positions and chart calculations. No personal identifiers are sent.
- **Google Gemini AI**: Processes anonymized astrological data to generate personalized insights. Chat content is not stored by Google beyond the request.
- **Razorpay**: Handles payment processing for credit purchases. We never store your payment card details.
- **Firebase (Google)**: Provides authentication and database services.`,
  },
  {
    title: "5. Data Export (GDPR Compliance)",
    content: `You have the right to export all your personal data at any time. Visit your Settings page to download a complete copy of your profile, chat history, and astrological data in a standard format.`,
  },
  {
    title: "6. Data Deletion",
    content: `You may request complete deletion of your account and all associated data by contacting us at support@astroyou.com. We will process deletion requests within 30 days. Upon deletion, all personal data including birth information, chat history, and consciousness data will be permanently removed.`,
  },
  {
    title: "7. Cookies and Local Storage",
    content: `AstroYou uses minimal cookies and local storage strictly for:

- Firebase authentication session tokens.
- Caching your profile locally for faster load times.

We do not use advertising cookies or third-party tracking cookies.`,
  },
  {
    title: "8. Children's Privacy",
    content: `AstroYou is not intended for use by individuals under the age of 13. We do not knowingly collect personal information from children. If you believe a child has provided us with personal data, please contact us at support@astroyou.com.`,
  },
  {
    title: "9. Changes to This Policy",
    content: `We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated effective date. Continued use of AstroYou after changes constitutes acceptance of the revised policy.`,
  },
  {
    title: "10. Contact Us",
    content: `For questions or concerns about this Privacy Policy or your data, contact us at:

**Email**: support@astroyou.com`,
  },
];

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#030308] text-white">
      <div className="container mx-auto px-6 py-16 max-w-3xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors mb-12 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <h1 className="font-display text-4xl tracking-wide mb-4">
          Privacy Policy
        </h1>
        <p className="text-white/40 text-sm mb-16">
          Effective Date: April 11, 2026
        </p>

        <div className="space-y-12">
          {sections.map((section) => (
            <div key={section.title}>
              <h2 className="text-lg font-semibold text-gold mb-4">
                {section.title}
              </h2>
              <div className="text-white/60 text-sm leading-relaxed whitespace-pre-line prose prose-invert prose-sm max-w-none [&_strong]:text-white/80">
                <div
                  dangerouslySetInnerHTML={{
                    __html: section.content
                      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                      .replace(/^- /gm, "&bull; "),
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-24 pt-8 border-t border-white/[0.05] text-white/30 text-xs">
          <p>&copy; 2026 AstroYou. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
