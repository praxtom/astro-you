import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { useUserProfile } from "../hooks";
import { useSubscription } from "../hooks/useSubscription";
import { getTier, type SubscriptionTier } from "../lib/subscriptions";
import { Crown, User, Download, ArrowLeft, Loader2 } from "lucide-react";
import Header from "../components/layout/Header";

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { tier, credits } = useSubscription();
  const currentTier = getTier(tier);

  const [cancelling, setCancelling] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);

  const handleSubscribe = async (planTier: SubscriptionTier) => {
    if (!user) return;
    try {
      const res = await fetch("/api/subscription/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: `plan_${planTier}`, uid: user.uid }),
      });
      const data = await res.json();
      if (data.shortUrl) {
        window.location.href = data.shortUrl;
      }
    } catch (err) {
      console.error("Subscription error:", err);
    }
  };

  const handleCancel = async () => {
    if (
      !user ||
      !confirm(
        "Are you sure? Your subscription will end at the current billing period.",
      )
    )
      return;
    setCancelling(true);
    try {
      await fetch("/api/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid }),
      });
      setCancelSuccess(true);
    } catch {
      // silent
    }
    setCancelling(false);
  };

  const handleExportData = async () => {
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

  if (!user) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-[#030308] text-white">
      <Header />
      <main className="container mx-auto pt-24 px-6 pb-16 max-w-2xl">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/40 hover:text-white mb-6 text-sm"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <h1 className="text-3xl font-display mb-8">Settings</h1>

        {/* Current Plan */}
        <section className="glass rounded-[2rem] p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Crown size={18} className="text-gold" />
            <h2 className="text-gold text-sm font-bold uppercase tracking-widest">
              Your Plan
            </h2>
          </div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-2xl mr-2">{currentTier.badge}</span>
              <span className="text-xl font-display">{currentTier.name}</span>
              {currentTier.price > 0 && (
                <span className="text-white/40 ml-2">
                  ₹{currentTier.price}/mo
                </span>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-white/60">
                {credits} credits remaining
              </p>
              {profile?.subscription?.currentEnd && (
                <p className="text-xs text-white/30">
                  Renews:{" "}
                  {new Date(
                    profile.subscription.currentEnd,
                  ).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>

          {tier === "free" ? (
            <div className="flex gap-3">
              <button
                onClick={() => handleSubscribe("premium")}
                className="flex-1 py-3 rounded-xl bg-gold text-black font-bold text-sm text-center"
              >
                Upgrade to Premium — ₹499/mo
              </button>
              <button
                onClick={() => handleSubscribe("pro")}
                className="flex-1 py-3 rounded-xl border border-gold/30 text-gold font-bold text-sm text-center"
              >
                Go Pro — ₹999/mo
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              {tier === "premium" && (
                <button
                  onClick={() => handleSubscribe("pro")}
                  className="flex-1 py-3 rounded-xl bg-gold text-black font-bold text-sm text-center"
                >
                  Upgrade to Pro — ₹999/mo
                </button>
              )}
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="px-4 py-3 rounded-xl border border-red-500/30 text-red-400 text-sm hover:bg-red-500/10"
              >
                {cancelling ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  "Cancel Subscription"
                )}
              </button>
              {cancelSuccess && (
                <p className="text-xs text-emerald-400 self-center">
                  Cancellation requested
                </p>
              )}
            </div>
          )}

          <button
            onClick={() => navigate("/pricing")}
            className="mt-4 text-xs text-white/30 hover:text-gold transition-colors"
          >
            Compare all plans →
          </button>
        </section>

        {/* Account */}
        <section className="glass rounded-[2rem] p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <User size={18} className="text-gold" />
            <h2 className="text-gold text-sm font-bold uppercase tracking-widest">
              Account
            </h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-white/40">Email</span>
              <span className="text-white/80">{user.email || "Not set"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Name</span>
              <span className="text-white/80">
                {profile?.name || "Not set"}
              </span>
            </div>
            {profile?.username && (
              <div className="flex justify-between">
                <span className="text-white/40">Username</span>
                <span className="text-white/80">@{profile.username}</span>
              </div>
            )}
          </div>
        </section>

        {/* Data & Privacy */}
        <section className="glass rounded-[2rem] p-6">
          <div className="flex items-center gap-3 mb-4">
            <Download size={18} className="text-gold" />
            <h2 className="text-gold text-sm font-bold uppercase tracking-widest">
              Data & Privacy
            </h2>
          </div>
          <div className="space-y-3">
            <button
              onClick={handleExportData}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-white/70 transition-colors"
            >
              <span>Export all my data (JSON)</span>
              <Download size={14} />
            </button>
            <a
              href="/help"
              className="block w-full p-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-white/70 transition-colors"
            >
              Help & FAQ
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
