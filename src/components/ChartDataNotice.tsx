/**
 * One-line processing notice shown before the first chart request in both
 * onboarding flows. Opens the policy in a new tab so the form isn't lost.
 */
export default function ChartDataNotice({
  className = "",
}: {
  className?: string;
}) {
  return (
    <p className={`text-xs leading-5 text-white/55 ${className}`}>
      To make your chart, your birth details are processed by our astrology
      calculation provider and Google's Gemini AI.{" "}
      <a
        href="/privacy"
        target="_blank"
        rel="noopener noreferrer"
        className="text-gold/80 underline underline-offset-2 hover:text-gold"
      >
        Privacy policy
      </a>
    </p>
  );
}
