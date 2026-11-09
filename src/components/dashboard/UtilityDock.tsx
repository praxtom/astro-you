import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Gift, Settings, Share2, Sparkles } from "lucide-react";
import { useAuth } from "../../lib/useAuth";
import { useReferralInfo } from "../../hooks/useReferralInfo";

interface UtilityDockProps {
  /** Still accepted by callers; the dock itself no longer reads it. */
  profile?: any;
  hasBirthData: boolean;
  downloadingNatal: boolean;
  /** Credit price of the natal PDF, shown on the button. */
  natalReportCost: number;
  onDownloadNatalReport: () => void;
  onUpdateBirthData: () => void;
  onOpenAltar: () => void;
  onShareChart: () => void;
}

/**
 * Quiet end-of-rail utilities: birth data, altar, reports, chart sharing,
 * referral invite, and data export.
 */
export const UtilityDock: React.FC<UtilityDockProps> = ({
  hasBirthData,
  downloadingNatal,
  natalReportCost,
  onDownloadNatalReport,
  onUpdateBirthData,
  onOpenAltar,
  onShareChart,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const referral = useReferralInfo();

  const [referralCopied, setReferralCopied] = useState(false);

  const exportData = async () => {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch("/api/export-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "astroyou-my-data.json";
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const linkClass =
    "flex items-center gap-2.5 text-sm text-white/55 hover:text-gold transition-colors disabled:opacity-50 text-left";

  return (
    <section className="animate-reveal-progressive">
      <p className="text-[0.6875rem] font-bold uppercase tracking-[0.3em] text-white/50 mb-4">
        Keep & Share
      </p>

      <div className="flex flex-col gap-2.5 px-1">
        <button onClick={onUpdateBirthData} className={linkClass}>
          <Settings size={14} />
          Update Birth Data
        </button>

        {user && (
          <button onClick={onOpenAltar} className={linkClass}>
            <Sparkles size={14} />
            Daily Altar
          </button>
        )}

        {hasBirthData && (
          <button
            onClick={onDownloadNatalReport}
            disabled={downloadingNatal}
            className={linkClass}
          >
            <Download size={14} />
            {downloadingNatal
              ? "Generating…"
              : `Natal Report PDF · ${natalReportCost} credits`}
          </button>
        )}

        {user && (
          <button onClick={() => navigate("/reports")} className={linkClass}>
            <Download size={14} />
            My Reports
          </button>
        )}

        {hasBirthData && (
          <button onClick={onShareChart} className={linkClass}>
            <Share2 size={14} />
            Share My Chart
          </button>
        )}

        {user && referral.link && (
          <div className="mt-1 rounded-xl border border-gold/15 bg-gold/4 p-3.5">
            <button
              onClick={() => {
                navigator.clipboard.writeText(referral.link);
                setReferralCopied(true);
                setTimeout(() => setReferralCopied(false), 2000);
              }}
              className="flex items-center gap-2 text-sm text-white/75 hover:text-gold transition-colors"
            >
              <Gift size={14} className="text-gold/80" />
              {referralCopied ? "Invite link copied" : "Invite friends"}
            </button>
            <p className="mt-1 text-xs leading-relaxed text-white/50">
              {referral.stats
                ? `${referral.stats.invited} invited · ${referral.stats.creditsEarned} credits earned`
                : referral.loading
                  ? "Loading referral rewards…"
                  : referral.error
                    ? "Share link works. Stats are unavailable right now."
                    : "Earn credits when friends join."}
            </p>
            <p className="mt-2 text-[0.6875rem] font-bold uppercase tracking-[0.25em] text-gold/70">
              {referral.code}
            </p>
          </div>
        )}

        {user && (
          <button onClick={exportData} className={linkClass}>
            <Download size={14} />
            Export My Data
          </button>
        )}
      </div>
    </section>
  );
};
