import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Download,
  Gift,
  Settings,
  Share2,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/useAuth";
import { useReferralInfo } from "../../hooks/useReferralInfo";

interface UtilityDockProps {
  profile: any;
  hasBirthData: boolean;
  downloadingNatal: boolean;
  onDownloadNatalReport: () => void;
  onUpdateBirthData: () => void;
  onOpenAltar: () => void;
  onShareChart: () => void;
}

/**
 * Quiet end-of-rail utilities: public profile, friends, birth data, altar,
 * reports, chart sharing, referral invite, and data export.
 */
export const UtilityDock: React.FC<UtilityDockProps> = ({
  profile,
  hasBirthData,
  downloadingNatal,
  onDownloadNatalReport,
  onUpdateBirthData,
  onOpenAltar,
  onShareChart,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const referral = useReferralInfo();

  const [showUsernameForm, setShowUsernameForm] = useState(false);
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username || "");
      setBio(profile.bio || "");
      setIsPublic(profile.isPublic || false);
    }
  }, [profile]);

  const saveProfile = async () => {
    if (!user || !username.trim()) return;
    const { doc, setDoc } = await import("firebase/firestore");
    await setDoc(
      doc(db, "users", user.uid),
      {
        profile: {
          ...profile,
          username: username.trim().toLowerCase(),
          bio,
          isPublic,
        },
      },
      { merge: true },
    );
    setShowUsernameForm(false);
  };

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
    "flex items-center gap-2.5 text-sm text-white/40 hover:text-gold transition-colors disabled:opacity-50 text-left";

  return (
    <section className="animate-reveal-progressive">
      <p className="text-[0.6rem] font-bold uppercase tracking-[0.35em] text-white/25 mb-4">
        Keep & Share
      </p>

      <div className="flex flex-col gap-2.5 px-1">
        {user && (
          <>
            <button onClick={() => navigate("/friends")} className={linkClass}>
              <Users size={14} />
              Friends
            </button>
            <button
              onClick={() => setShowUsernameForm(!showUsernameForm)}
              className={linkClass}
            >
              <User size={14} />
              {profile?.username ? `@${profile.username}` : "Set Username"}
            </button>
            {showUsernameForm && (
              <div className="mt-1 p-4 rounded-xl bg-white/4 border border-white/10 space-y-3">
                <input
                  value={username}
                  onChange={(e) =>
                    setUsername(e.target.value.replace(/[^a-z0-9_]/g, ""))
                  }
                  placeholder="username"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-gold/50"
                />
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={160}
                  placeholder="Short bio (optional)"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-gold/50 h-16 resize-none"
                />
                <label className="flex items-center gap-2 text-xs text-white/40">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="rounded"
                  />
                  Make profile public
                </label>
                <button
                  onClick={saveProfile}
                  className="px-4 py-2 rounded-lg bg-gold text-black text-xs font-bold uppercase tracking-[0.15em]"
                >
                  Save
                </button>
              </div>
            )}
          </>
        )}

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
            {downloadingNatal ? "Generating…" : "Download Natal Report"}
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
            <p className="mt-1 text-xs leading-relaxed text-white/35">
              {referral.stats
                ? `${referral.stats.invited} invited · ${referral.stats.creditsEarned} credits earned`
                : referral.loading
                  ? "Loading referral rewards…"
                  : referral.error
                    ? "Share link works. Stats are unavailable right now."
                    : "Earn credits when friends join."}
            </p>
            <p className="mt-2 text-[0.6rem] font-bold uppercase tracking-[0.25em] text-gold/70">
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
