import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, updateDoc } from "firebase/firestore";
import { useAuth } from "../lib/useAuth";
import { useUserProfile } from "../hooks";
import { useSubscription } from "../hooks/useSubscription";
import { useConsciousness } from "../hooks/useConsciousness";
import { getTier, type SubscriptionTier } from "../lib/subscriptions";
import { Crown, User, Download, ArrowLeft, Loader2, AlertCircle, Bell, Brain, Trash2, ShieldCheck, Languages } from "lucide-react";
import Header from "../components/layout/Header";
import { db } from "../lib/firebase";
import { ATMAN_SCHEMA_VERSION } from "../types/user";
import { PLATFORM_LANGUAGES, normalizePlatformLanguage } from "../lib/languages";
import {
  canInstallApp,
  isRunningStandalone,
  promptInstallApp,
  subscribeInstallPrompt,
} from "../lib/pwa-install";
import {
  disableBrainPushNotifications,
  requestBrainPushToken,
} from "../lib/push-notifications";

type MemoryBucket = "patterns" | "events" | "relationships" | "routines" | "advice";

export default function Settings() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { profile } = useUserProfile();
  const { atmanState } = useConsciousness();
  const { tier, credits } = useSubscription();
  const currentTier = getTier(tier);

  const [cancelling, setCancelling] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<SubscriptionTier | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [pushSaving, setPushSaving] = useState(false);
  const [pushMessage, setPushMessage] = useState("");
  const [memoryBusy, setMemoryBusy] = useState<MemoryBucket | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [installAvailable, setInstallAvailable] = useState(false);
  const [installMessage, setInstallMessage] = useState("");

  useEffect(() => {
    const syncInstallState = () => setInstallAvailable(canInstallApp());
    syncInstallState();
    return subscribeInstallPrompt(syncInstallState);
  }, []);

  const handleSubscribe = async (planTier: SubscriptionTier) => {
    if (!user) return;
    setCheckoutLoading(planTier);
    setBillingError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/subscription/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, tier: planTier }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not start checkout");
      if (data.shortUrl) {
        window.location.href = data.shortUrl;
      }
    } catch (err: any) {
      console.error("Subscription error:", err);
      setBillingError(err.message || "Subscription checkout failed");
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleCancel = async () => {
    if (
      !user ||
      !confirm(
        "Before you cancel: you will keep access until the current billing period ends, but future credits and reports will stop. Continue?",
      )
    )
      return;
    setCancelling(true);
    setBillingError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Cancellation failed");
      setCancelSuccess(true);
    } catch (err: any) {
      console.error("Subscription cancellation error:", err);
      setBillingError(err.message || "Cancellation failed");
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

  const toggleEmailDigest = async () => {
    if (!user || !profile) return;
    setSavingPrefs(true);
    try {
      const current = profile.notificationPrefs?.emailDigest !== false;
      await updateDoc(doc(db, "users", user.uid), {
        "profile.notificationPrefs.emailDigest": !current,
      });
    } catch (err) {
      console.error("Notification preference update failed:", err);
    } finally {
      setSavingPrefs(false);
    }
  };

  const toggleBrainPush = async () => {
    if (!user) return;
    setPushSaving(true);
    setPushMessage("");
    try {
      const enabled = profile?.notificationPrefs?.pushBrainNudges === true;
      if (enabled) {
        await disableBrainPushNotifications(user);
        setPushMessage("Browser brain nudges are off.");
      } else {
        await requestBrainPushToken(user);
        setPushMessage("Browser brain nudges are on.");
      }
    } catch (err: any) {
      setPushMessage(err.message || "Could not update browser push.");
    } finally {
      setPushSaving(false);
    }
  };

  const updateLanguage = async (language: string) => {
    if (!user) return;
    setSavingPrefs(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        "profile.language": normalizePlatformLanguage(language),
        updatedAt: new Date(),
      });
    } catch (err) {
      console.error("Language preference update failed:", err);
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleInstallApp = async () => {
    if (isRunningStandalone()) {
      setInstallMessage("AstroYou is already installed on this device.");
      return;
    }

    if (!canInstallApp()) {
      setInstallMessage("Use your browser menu to add AstroYou to your home screen.");
      return;
    }

    const accepted = await promptInstallApp();
    setInstallAvailable(canInstallApp());
    setInstallMessage(
      accepted
        ? "AstroYou was added to your device."
        : "Install was dismissed. You can try again from the browser menu.",
    );
  };

  const memoryRows: Array<{
    bucket: MemoryBucket;
    label: string;
    count: number;
    preview: string;
  }> = [
    {
      bucket: "patterns",
      label: "Patterns",
      count: atmanState?.knownPatterns?.length ?? 0,
      preview: atmanState?.knownPatterns?.slice(0, 2).map((item) => item.pattern).join(", ") || "None saved",
    },
    {
      bucket: "events",
      label: "Life events",
      count: atmanState?.activeEvents?.length ?? 0,
      preview: atmanState?.activeEvents?.slice(0, 2).map((item) => item.title).join(", ") || "None saved",
    },
    {
      bucket: "relationships",
      label: "Relationships",
      count: atmanState?.keyRelationships?.length ?? 0,
      preview: atmanState?.keyRelationships?.slice(0, 2).map((item) => item.name).join(", ") || "None saved",
    },
    {
      bucket: "routines",
      label: "Routines",
      count: atmanState?.routines?.length ?? 0,
      preview: atmanState?.routines?.slice(0, 2).map((item) => item.title).join(", ") || "None saved",
    },
    {
      bucket: "advice",
      label: "Saved advice",
      count: atmanState?.savedAdvice?.length ?? 0,
      preview: atmanState?.savedAdvice?.slice(0, 2).map((item) => item.advice).join(", ") || "None saved",
    },
  ];

  const clearMemoryBucket = async (bucket: MemoryBucket) => {
    if (!user || !confirm(`Clear ${bucket} memory? This cannot be undone.`)) return;
    setMemoryBusy(bucket);
    try {
      const base = { "atman.schemaVersion": ATMAN_SCHEMA_VERSION };
      const updates: Record<string, unknown> =
        bucket === "patterns"
          ? { ...base, "atman.knownPatterns": [], "atman.memory.knownPatterns": [] }
          : bucket === "events"
            ? { ...base, "atman.activeEvents": [], "atman.lifeEvents": [], "atman.memory.lifeEvents": [] }
            : bucket === "relationships"
              ? { ...base, "atman.keyRelationships": [], "atman.memory.keyRelationships": [] }
              : bucket === "routines"
                ? { ...base, "atman.routines": [], "atman.memory.routines": [] }
                : { ...base, "atman.savedAdvice": [], "atman.adviceHistory": [], "atman.memory.savedAdvice": [] };
      await updateDoc(doc(db, "users", user.uid), updates);
    } catch (err) {
      console.error("Memory clear failed:", err);
    } finally {
      setMemoryBusy(null);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    const confirmation = prompt("Type DELETE to permanently delete your account.");
    if (confirmation !== "DELETE") return;
    setDeletingAccount(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, confirmation }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Account deletion failed");
      await signOut();
      navigate("/");
    } catch (err: any) {
      console.error("Account deletion failed:", err);
      setBillingError(err.message || "Account deletion failed");
    } finally {
      setDeletingAccount(false);
    }
  };

  useEffect(() => {
    if (!user) navigate("/");
  }, [user, navigate]);

  if (!user) return null;

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
              {profile?.subscription?.status && (
                <p className="text-xs text-white/30 capitalize">
                  Status: {profile.subscription.status}
                </p>
              )}
            </div>
          </div>

          {profile?.subscription?.status === "pending" &&
            profile.subscription.gracePeriodEnd && (
              <div className="mb-4 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 flex gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>
                  Payment is pending. Grace period ends{" "}
                  {new Date(profile.subscription.gracePeriodEnd).toLocaleDateString()}.
                </span>
              </div>
            )}

          {tier === "free" ? (
            <div className="flex gap-3">
              <button
                onClick={() => handleSubscribe("premium")}
                disabled={checkoutLoading !== null}
                className="flex-1 py-3 rounded-xl bg-gold text-black font-bold text-sm text-center"
              >
                {checkoutLoading === "premium" ? "Starting..." : "Upgrade to Premium — ₹499/mo"}
              </button>
              <button
                onClick={() => handleSubscribe("pro")}
                disabled={checkoutLoading !== null}
                className="flex-1 py-3 rounded-xl border border-gold/30 text-gold font-bold text-sm text-center"
              >
                {checkoutLoading === "pro" ? "Starting..." : "Go Pro — ₹999/mo"}
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              {tier === "premium" && (
                <button
                  onClick={() => handleSubscribe("pro")}
                  disabled={checkoutLoading !== null}
                  className="flex-1 py-3 rounded-xl bg-gold text-black font-bold text-sm text-center"
                >
                  {checkoutLoading === "pro" ? "Starting..." : "Upgrade to Pro — ₹999/mo"}
                </button>
              )}
              <button
                onClick={handleCancel}
                disabled={cancelling || profile?.subscription?.status === "cancelling"}
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

          {profile?.subscription?.status === "cancelling" && (
            <p className="mt-4 text-xs text-amber-300">
              Cancellation requested. Access remains until the current period ends.
            </p>
          )}
          {billingError && (
            <p className="mt-4 text-xs text-red-400">{billingError}</p>
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

        {/* Language */}
        <section className="glass rounded-[2rem] p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Languages size={18} className="text-gold" />
            <h2 className="text-gold text-sm font-bold uppercase tracking-widest">
              Language
            </h2>
          </div>
          <label className="block">
            <span className="mb-2 block text-xs text-white/35">
              Preferred guidance language
            </span>
            <select
              value={normalizePlatformLanguage(profile?.language)}
              onChange={(event) => updateLanguage(event.target.value)}
              disabled={savingPrefs}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white disabled:opacity-50"
            >
              {PLATFORM_LANGUAGES.map((language) => (
                <option key={language.code} value={language.code} className="bg-[#111118]">
                  {language.label} · {language.nativeLabel}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-3 text-xs text-white/35">
            Jyotish, daily guidance, and new consultations will use this language where available.
          </p>
        </section>

        {/* Notifications */}
        <section className="glass rounded-[2rem] p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Bell size={18} className="text-gold" />
            <h2 className="text-gold text-sm font-bold uppercase tracking-widest">
              Notifications
            </h2>
          </div>
          <button
            onClick={toggleEmailDigest}
            disabled={savingPrefs}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-white/70 transition-colors disabled:opacity-50"
          >
            <span>Daily email digest</span>
            <span className="text-xs text-gold">
              {profile?.notificationPrefs?.emailDigest === false ? "Off" : "On"}
            </span>
          </button>
          <button
            onClick={toggleBrainPush}
            disabled={pushSaving}
            className="mt-3 w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-white/70 transition-colors disabled:opacity-50"
          >
            <span>Browser brain nudges</span>
            <span className="text-xs text-gold">
              {pushSaving
                ? "Saving..."
                : profile?.notificationPrefs?.pushBrainNudges === true
                  ? "On"
                  : "Off"}
            </span>
          </button>
          {pushMessage && (
            <p className="text-xs text-white/35 mt-3">{pushMessage}</p>
          )}
          <p className="text-xs text-white/30 mt-3">
            High-priority brain nudges can use email or browser push. WhatsApp stays off until phone capture, explicit opt-in, and provider setup.
          </p>
        </section>

        {/* Memory */}
        <section className="glass rounded-[2rem] p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Brain size={18} className="text-gold" />
            <h2 className="text-gold text-sm font-bold uppercase tracking-widest">
              Memory
            </h2>
          </div>
          <div className="space-y-3">
            {memoryRows.map((row) => (
              <div
                key={row.bucket}
                className="rounded-xl bg-white/5 border border-white/10 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-white/80">
                      {row.label} <span className="text-white/30">({row.count})</span>
                    </p>
                    <p className="text-xs text-white/35 line-clamp-1">{row.preview}</p>
                  </div>
                  <button
                    onClick={() => clearMemoryBucket(row.bucket)}
                    disabled={memoryBusy !== null || row.count === 0}
                    className="p-2 rounded-lg border border-white/10 text-white/35 hover:text-red-400 disabled:opacity-30"
                    title={`Clear ${row.label}`}
                  >
                    {memoryBusy === row.bucket ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </div>
              </div>
            ))}
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
            <div className="rounded-xl bg-white/5 p-3 text-sm text-white/60">
              <div className="flex items-center gap-2 text-gold mb-2">
                <ShieldCheck size={14} />
                <span className="text-xs font-bold uppercase tracking-widest">
                  Guidance Safety
                </span>
              </div>
              <p className="text-xs text-white/40">
                AI guidance avoids fatalism, fear-based predictions, medical diagnosis,
                and guaranteed financial claims.
              </p>
            </div>
            <button
              onClick={handleExportData}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-white/70 transition-colors"
            >
              <span>Export all my data (JSON)</span>
              <Download size={14} />
            </button>
            <a
              href="/wallet"
              className="block w-full p-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-white/70 transition-colors"
            >
              Wallet, receipts, and credit activity
            </a>
            <a
              href="/help"
              className="block w-full p-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-white/70 transition-colors"
            >
              Help & FAQ
            </a>
            <a
              href="/support"
              className="block w-full p-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-white/70 transition-colors"
            >
              Open support ticket
            </a>
            <button
              onClick={handleInstallApp}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-white/70 transition-colors"
            >
              <span>{installAvailable ? "Install AstroYou app" : "Add AstroYou to home screen"}</span>
              <Download size={14} />
            </button>
            {installMessage && (
              <p className="px-1 text-xs text-white/35">{installMessage}</p>
            )}
            <button
              onClick={handleDeleteAccount}
              disabled={deletingAccount}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-300 hover:bg-red-500/15 transition-colors disabled:opacity-50"
            >
              <span>Delete my account</span>
              {deletingAccount ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
