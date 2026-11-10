import { isRazorpayHostedUrl } from "../lib/payment-navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { doc, updateDoc } from "firebase/firestore";
import { useAuth } from "../lib/useAuth";
import { useUserProfile } from "../hooks";
import {
  formatSubscriptionDate,
  useSubscription,
} from "../hooks/useSubscription";
import { getTier, type SubscriptionTier } from "../lib/subscriptions";
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  Brain,
  Calendar,
  ChevronRight,
  Crown,
  Download,
  Languages,
  LifeBuoy,
  Loader2,
  LogOut,
  PencilLine,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
  type LucideIcon,
} from "lucide-react";
import { MemoryManager } from "../components/memory/MemoryManager";
import { AnalyticsConsentToggle } from "../components/AnalyticsConsentToggle";
import { auth, db } from "../lib/firebase";
import OnboardingModal from "../components/OnboardingModal";
import { useErrorToast } from "../components/ui/toast-context";
import { requestSignIn } from "../lib/auth-prompt";
import { PLATFORM_LANGUAGES, normalizePlatformLanguage } from "../lib/languages";
import { ZODIAC_MODES, normalizeZodiacMode } from "../lib/zodiac-mode";
import {
  FESTIVAL_REGIONS,
  normalizeFestivalRegion,
} from "../lib/festival-regions";
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
import { useCurrency } from "../hooks/useCurrency";
import { formatMoney } from "../lib/currency";
import { TIERS } from "../lib/subscriptions";

const ROW_CLASS =
  "w-full min-h-11 flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 text-left text-sm text-white/75 transition-colors";

function SectionHeading({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <Icon size={18} className="text-gold" aria-hidden="true" />
      <h2 className="text-base font-semibold text-white">{children}</h2>
    </div>
  );
}

/** Plain words for the subscription states the billing server writes. */
const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  authenticated: "Starting",
  created: "Starting",
  pending: "Payment pending",
  halted: "Paused: payment failed",
  cancelling: "Ends at the close of this billing month",
  cancelled: "Cancelled",
  completed: "Ended",
  expired: "Ended",
};

export default function Settings() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { profile } = useUserProfile();
  const { tier, credits } = useSubscription();
  const currentTier = getTier(tier);
  const { currency } = useCurrency();

  const [cancelling, setCancelling] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<SubscriptionTier | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [pushSaving, setPushSaving] = useState(false);
  const [pushMessage, setPushMessage] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showEditBirth, setShowEditBirth] = useState(false);
  const deleteInputRef = useRef<HTMLInputElement>(null);
  const deleteOpenerRef = useRef<HTMLButtonElement>(null);
  const showErrorToast = useErrorToast();
  const [installAvailable, setInstallAvailable] = useState(false);
  const [installMessage, setInstallMessage] = useState("");

  // Deep link from "What AstroYou remembers" (/settings#memory).
  useEffect(() => {
    if (window.location.hash !== "#memory") return;
    const t = window.setTimeout(() => {
      document
        .getElementById("memory")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    return () => window.clearTimeout(t);
  }, []);

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
      if (!isRazorpayHostedUrl(data.shortUrl)) throw new Error("Hosted subscription checkout is unavailable. Please try again shortly.");
      if (data.shortUrl) {
        window.location.href = data.shortUrl;
      }
    } catch (err: any) {
      console.error("Subscription error:", err);
      setBillingError(
        "We couldn't start checkout. You haven't been charged — please try again in a moment.",
      );
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
      setBillingError(
        "We couldn't cancel your plan right now. Please try again, or contact support if it keeps happening.",
      );
    }
    setCancelling(false);
  };

  const handleExportData = async () => {
    if (!user) return false;
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
    return res.ok;
  };

  const [exporting, setExporting] = useState(false);
  /** UI wrapper: shows progress and reports a failed export instead of doing nothing. */
  const exportData = async () => {
    setExporting(true);
    try {
      const ok = await handleExportData();
      if (!ok) throw new Error("Export failed");
    } catch (err) {
      console.error("Data export failed:", err);
      showErrorToast(
        "Export didn't start",
        "Check your connection and try again.",
      );
    } finally {
      setExporting(false);
    }
  };

  const toggleEmailDigest = async () => {
    if (!user || !profile) return;
    setSavingPrefs(true);
    try {
      // Opt-in: the scheduled digest only goes out when emailDigest === true,
      // so an unset preference is Off. Always write an explicit boolean.
      const current = profile.notificationPrefs?.emailDigest === true;
      await updateDoc(doc(db, "users", user.uid), {
        "profile.notificationPrefs.emailDigest": current ? false : true,
      });
    } catch (err) {
      console.error("Notification preference update failed:", err);
      showErrorToast(
        "Email digest not changed",
        "Check your connection and try again.",
      );
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
        setPushMessage("Reminders on this device are off.");
      } else {
        await requestBrainPushToken(user);
        setPushMessage("Reminders on this device are on.");
      }
    } catch (err: any) {
      console.error("Browser push update failed:", err);
      setPushMessage(
        "We couldn't change browser notifications. Check that this site is allowed to send notifications, then try again.",
      );
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
      showErrorToast(
        "Language not saved",
        "Check your connection and choose it again.",
      );
    } finally {
      setSavingPrefs(false);
    }
  };

  const updateZodiacMode = async (mode: string) => {
    if (!user) return;
    setSavingPrefs(true);
    try {
      // Cached charts are tagged with the mode they were cast in, so they are
      // rejected on read rather than deleted here — see isUsableCachedKundali.
      await updateDoc(doc(db, "users", user.uid), {
        "profile.zodiacMode": normalizeZodiacMode(mode),
        updatedAt: new Date(),
      });
    } catch (err) {
      console.error("Zodiac mode update failed:", err);
      showErrorToast(
        "Zodiac system not saved",
        "Check your connection and choose it again.",
      );
    } finally {
      setSavingPrefs(false);
    }
  };

  const updateFestivalRegion = async (region: string) => {
    if (!user) return;
    setSavingPrefs(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        "profile.festivalRegion": normalizeFestivalRegion(region),
        updatedAt: new Date(),
      });
    } catch (err) {
      console.error("Festival region update failed:", err);
      showErrorToast(
        "Festival calendar not saved",
        "Check your connection and choose it again.",
      );
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

  const DELETE_WORD = "DELETE";

  const openDeleteConfirm = () => {
    setDeleteError(null);
    setDeleteText("");
    setDeleteOpen(true);
    window.setTimeout(() => deleteInputRef.current?.focus(), 0);
  };

  const closeDeleteConfirm = () => {
    setDeleteOpen(false);
    setDeleteText("");
    window.setTimeout(() => deleteOpenerRef.current?.focus(), 0);
  };

  /**
   * Deletion needs a recent sign-in (server answers 401 with
   * code "recent_login_required"). Then we ask the user to sign in again and
   * retry once — only if they came back as the same account.
   */
  const handleDeleteAccount = async (afterReauth = false) => {
    const current = auth.currentUser;
    if (!current || deleteText.trim() !== DELETE_WORD) return;
    const uid = current.uid;
    setDeletingAccount(true);
    setDeleteError(null);
    try {
      const idToken = await current.getIdToken(afterReauth);
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, confirmation: DELETE_WORD }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 && data?.code === "recent_login_required") {
        if (afterReauth) {
          throw new Error("Still needs a recent sign-in after re-auth");
        }
        setDeletingAccount(false);
        const opened = requestSignIn({
          title: "Confirm it's you",
          message:
            "For your safety, sign in again to delete your account. Nothing has been deleted yet.",
          onSuccess: () => {
            if (auth.currentUser?.uid !== uid) {
              setDeleteError(
                "You signed in with a different account, so nothing was deleted. Sign in with the account you want to delete.",
              );
              return;
            }
            void handleDeleteAccount(true);
          },
        });
        if (!opened) {
          setDeleteError(
            "Please sign out, sign in again, then delete your account.",
          );
        }
        return;
      }
      if (!res.ok) throw new Error(data.error || "Account deletion failed");
      await signOut();
      navigate("/");
    } catch (err: any) {
      console.error("Account deletion failed:", err);
      setDeleteError(
        "We couldn't delete your account. Nothing was removed — please try again, or contact support.",
      );
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  useEffect(() => {
    if (!user) navigate("/");
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div>
      <div className="container mx-auto pt-28 px-6 pb-16 max-w-2xl">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex min-h-11 items-center gap-2 text-white/60 hover:text-white mb-4 text-sm"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Back
        </button>
        <h1 className="type-page-title mb-8">Settings</h1>

        {/* Current Plan */}
        <section className="glass rounded-[2rem] p-6 mb-6">
          <SectionHeading icon={Crown}>Your plan</SectionHeading>
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 mb-4">
            <div>
              <span className="text-2xl mr-2" aria-hidden="true">{currentTier.badge}</span>
              <span className="text-xl font-display">{currentTier.name}</span>
              {/* One INR plan per tier: subscriptions are always billed in rupees. */}
              {currentTier.price > 0 && (
                <span className="text-white/60 ml-2">
                  {formatMoney(currentTier.prices.INR, "INR")}/mo
                </span>
              )}
            </div>
            <div className="sm:text-right">
              <p className="text-sm text-white/80">
                {credits} credits remaining
              </p>
              {tier !== "free" &&
                profile?.subscription?.status !== "cancelling" &&
                formatSubscriptionDate(
                  profile?.subscription?.chargeAt ??
                    profile?.subscription?.currentEnd,
                ) && (
                  <p className="text-xs text-white/60">
                    Renews:{" "}
                    {formatSubscriptionDate(
                      profile?.subscription?.chargeAt ??
                        profile?.subscription?.currentEnd,
                    )}
                  </p>
                )}
              {profile?.subscription?.status && (
                <p className="text-xs text-white/60">
                  Status:{" "}
                  {SUBSCRIPTION_STATUS_LABELS[profile.subscription.status] ??
                    profile.subscription.status}
                </p>
              )}
            </div>
          </div>

          {tier !== "free" && profile?.subscription?.status !== "cancelling" && (
            <p className="mb-4 text-xs text-white/60">
              Renews monthly until you cancel. You can cancel any time and keep
              access until the end of the month you've paid for.
            </p>
          )}

          {(() => {
            const pendingTier = (
              profile?.subscription as
                | { pendingSubscription?: { tier?: string } }
                | undefined
            )?.pendingSubscription?.tier;
            if (!pendingTier || pendingTier === tier) return null;
            return (
              <div className="mb-4 rounded-xl border border-gold/20 bg-gold/5 px-4 py-3 text-sm text-white/80">
                Your switch to {getTier(pendingTier).name} starts as soon as
                its first payment goes through.
                {tier !== "free" &&
                  ` Your ${currentTier.name} plan is then cancelled automatically, so you're never billed for both.`}
              </div>
            );
          })()}

          {profile?.subscription?.status === "pending" &&
            formatSubscriptionDate(profile.subscription.gracePeriodEnd) && (
              <div className="mb-4 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 flex gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  Payment is pending. Grace period ends{" "}
                  {formatSubscriptionDate(profile.subscription.gracePeriodEnd)}.
                </span>
              </div>
            )}

          {tier === "free" && (
            <p className="mb-4 text-xs text-white/60">
              On the free plan you pay with credits as you go. A plan adds
              credits every month and makes Jyotish chat unlimited.
            </p>
          )}

          {tier === "free" ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => handleSubscribe("premium")}
                disabled={checkoutLoading !== null}
                className="flex-1 min-h-11 px-4 py-3 rounded-xl bg-gold text-black font-bold text-sm text-center disabled:opacity-60"
              >
                {checkoutLoading === "premium" ? "Starting..." : `Upgrade to Premium — ${formatMoney(TIERS.premium.prices.INR, "INR")}/mo`}
              </button>
              <button
                type="button"
                onClick={() => handleSubscribe("pro")}
                disabled={checkoutLoading !== null}
                className="flex-1 min-h-11 px-4 py-3 rounded-xl border border-gold/30 text-gold font-bold text-sm text-center disabled:opacity-60"
              >
                {checkoutLoading === "pro" ? "Starting..." : `Go Pro — ${formatMoney(TIERS.pro.prices.INR, "INR")}/mo`}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {tier === "premium" && (
                <button
                  type="button"
                  onClick={() => handleSubscribe("pro")}
                  disabled={checkoutLoading !== null}
                  className="flex-1 min-h-11 px-4 py-3 rounded-xl bg-gold text-black font-bold text-sm text-center disabled:opacity-60"
                >
                  {checkoutLoading === "pro" ? "Starting..." : `Upgrade to Pro — ${formatMoney(TIERS.pro.prices.INR, "INR")}/mo`}
                </button>
              )}
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling || profile?.subscription?.status === "cancelling"}
                className="inline-flex min-h-11 items-center justify-center gap-2 px-4 py-3 rounded-xl border border-red-500/30 text-red-400 text-sm hover:bg-red-500/10 disabled:opacity-50"
              >
                {cancelling && (
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                )}
                {cancelling ? "Cancelling…" : "Cancel subscription"}
              </button>
              {cancelSuccess && (
                <p role="status" className="text-sm text-emerald-400">
                  Cancellation requested
                </p>
              )}
            </div>
          )}

          {tier === "premium" && (
            <p className="mt-3 text-xs text-white/60">
              No need to cancel first: Pro starts the moment its payment goes
              through, and Premium is cancelled automatically so you're never
              charged for both.
            </p>
          )}
          {currency !== "INR" && (
            <p className="mt-3 text-xs text-white/60">
              Plans are billed monthly in Indian rupees (₹).
            </p>
          )}

          {profile?.subscription?.status === "cancelling" && (
            <p className="mt-4 text-xs text-amber-300">
              Cancellation requested. Access remains until the current period ends.
            </p>
          )}
          {billingError && (
            <p role="alert" className="mt-4 text-sm text-red-300">
              {billingError}
            </p>
          )}

          <Link
            to="/pricing"
            className="mt-2 inline-flex min-h-11 items-center text-sm text-white/60 hover:text-gold transition-colors"
          >
            Compare all plans →
          </Link>
        </section>

        {/* Account */}
        <section className="glass rounded-[2rem] p-6 mb-6">
          <SectionHeading icon={User}>Account</SectionHeading>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-white/60">Email</dt>
              <dd className="min-w-0 truncate text-right text-white/80">
                {user.email || "Not set"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-white/60">Name</dt>
              <dd className="min-w-0 truncate text-right text-white/80">
                {profile?.name || "Not set"}
              </dd>
            </div>
            {/* Birth details are what every reading is built on, so show
                them here where people come to check them. */}
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-white/60">Born</dt>
              <dd className="min-w-0 text-right text-white/80">
                {profile?.dob
                  ? `${profile.dob} · ${
                      profile.birthTimeUnknown
                        ? "time unknown (using 12:00 noon)"
                        : profile.tob || "time not set"
                    }`
                  : "Not set"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-white/60">Birth place</dt>
              <dd className="min-w-0 truncate text-right text-white/80">
                {profile?.pob || "Not set"}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-white/55">
            Your chart, forecasts and answers are all calculated from these.
            If anything is wrong, edit it and they update.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setShowEditBirth(true)}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-gold/30 px-4 text-sm font-bold text-gold hover:bg-gold/10"
            >
              <PencilLine size={15} aria-hidden="true" />
              Edit birth details
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-semibold text-white/75 hover:bg-white/5 hover:text-white"
            >
              <LogOut size={15} aria-hidden="true" />
              Sign out
            </button>
          </div>
        </section>

        {/* Language */}
        <section className="glass rounded-[2rem] p-6 mb-6">
          <SectionHeading icon={Languages}>Language</SectionHeading>
          <label className="block">
            <span className="mb-2 block text-xs text-white/60">
              Language for chat and readings
            </span>
            <select
              value={normalizePlatformLanguage(profile?.language)}
              onChange={(event) => updateLanguage(event.target.value)}
              disabled={savingPrefs}
              className="platform-field text-white disabled:opacity-50"
            >
              {PLATFORM_LANGUAGES.map((language) => (
                <option key={language.code} value={language.code} className="bg-[#111118]">
                  {language.label} · {language.nativeLabel}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-3 text-xs text-white/55">
            Jyotish chat, your daily forecast and new guide sessions use this
            language where available.
          </p>
        </section>

        {/* Zodiac system */}
        <section className="glass rounded-[2rem] p-6 mb-6">
          <SectionHeading icon={Sparkles}>Zodiac system</SectionHeading>
          <label className="block">
            <span className="mb-2 block text-xs text-white/60">
              How your chart is calculated
            </span>
            <select
              value={normalizeZodiacMode(profile?.zodiacMode)}
              onChange={(event) => updateZodiacMode(event.target.value)}
              disabled={savingPrefs}
              className="platform-field text-white disabled:opacity-50"
            >
              {ZODIAC_MODES.map((mode) => (
                <option
                  key={mode.mode}
                  value={mode.mode}
                  className="bg-[#111118]"
                >
                  {mode.label}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-3 text-xs text-white/55">
            {
              ZODIAC_MODES.find(
                (mode) => mode.mode === normalizeZodiacMode(profile?.zodiacMode),
              )?.description
            }
          </p>
          <p className="mt-2 text-xs text-white/55">
            Not sure? Keep Vedic: it is the system Indian astrologers use and
            the one your Kundali is drawn in. Switching can move your Sun sign
            by one sign, because the two measure from different starting
            points.
          </p>
        </section>

        {/* Festival calendar */}
        <section className="glass rounded-[2rem] p-6 mb-6">
          <SectionHeading icon={Calendar}>Festival calendar</SectionHeading>
          <label className="block">
            <span className="mb-2 block text-xs text-white/60">
              Which region's festivals to show on your home page
            </span>
            <select
              value={normalizeFestivalRegion(profile?.festivalRegion)}
              onChange={(event) => updateFestivalRegion(event.target.value)}
              disabled={savingPrefs}
              className="platform-field text-white disabled:opacity-50"
            >
              {FESTIVAL_REGIONS.map((region) => (
                <option
                  key={region.value}
                  value={region.value}
                  className="bg-[#111118]"
                >
                  {region.label}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-3 text-xs text-white/55">
            Choose &ldquo;Off&rdquo; to hide the festival card entirely.
          </p>
        </section>

        {/* Notifications */}
        <section className="glass rounded-[2rem] p-6 mb-6">
          <SectionHeading icon={Bell}>Notifications</SectionHeading>
          <button
            type="button"
            role="switch"
            aria-checked={profile?.notificationPrefs?.emailDigest === true}
            onClick={toggleEmailDigest}
            disabled={savingPrefs}
            className="w-full min-h-11 flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-white/75 transition-colors disabled:opacity-50"
          >
            <span>Daily guide by email</span>
            <span className="text-xs font-semibold text-gold" aria-hidden="true">
              {profile?.notificationPrefs?.emailDigest === true ? "On" : "Off"}
            </span>
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={profile?.notificationPrefs?.pushBrainNudges === true}
            aria-busy={pushSaving}
            onClick={toggleBrainPush}
            disabled={pushSaving}
            className="mt-3 w-full min-h-11 flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-white/75 transition-colors disabled:opacity-50"
          >
            <span>Daily reminders on this device</span>
            <span className="text-xs font-semibold text-gold" aria-hidden="true">
              {pushSaving
                ? "Saving..."
                : profile?.notificationPrefs?.pushBrainNudges === true
                  ? "On"
                  : "Off"}
            </span>
          </button>
          {pushMessage && (
            <p role="status" className="text-xs text-white/65 mt-3">
              {pushMessage}
            </p>
          )}
          <p className="text-xs text-white/55 mt-3">
            Important reminders can arrive by email or as a notification in
            this browser.
          </p>
        </section>

        {/* Memory */}
        <section id="memory" className="glass rounded-[2rem] p-6 mb-6 scroll-mt-24">
          <SectionHeading icon={Brain}>What AstroYou remembers</SectionHeading>
          <p className="text-sm leading-relaxed text-white/60 mb-4">
            AstroYou automatically turns your conversations into short notes
            (feelings, patterns, people, events) to personalise guidance.
            Review, delete or pause them here. Deleting a conversation also
            deletes the notes derived from it.
          </p>
          <MemoryManager />
        </section>

        {/* Help & app */}
        <section className="glass rounded-[2rem] p-6 mb-6">
          <SectionHeading icon={LifeBuoy}>Help & app</SectionHeading>
          <div className="space-y-3">
            <Link to="/wallet" className={ROW_CLASS}>
              <span>Wallet, receipts, and credit activity</span>
              <ChevronRight size={14} aria-hidden="true" />
            </Link>
            <Link to="/help" className={ROW_CLASS}>
              <span>Help & FAQ</span>
              <ChevronRight size={14} aria-hidden="true" />
            </Link>
            <Link to="/support" className={ROW_CLASS}>
              <span>Open support ticket</span>
              <ChevronRight size={14} aria-hidden="true" />
            </Link>
            <button type="button" onClick={handleInstallApp} className={ROW_CLASS}>
              <span>{installAvailable ? "Install AstroYou app" : "Add AstroYou to home screen"}</span>
              <Download size={14} aria-hidden="true" />
            </button>
            {installMessage && (
              <p role="status" className="px-1 text-xs text-white/65">
                {installMessage}
              </p>
            )}
          </div>
        </section>

        {/* Data & Privacy */}
        <section className="glass rounded-[2rem] p-6">
          <SectionHeading icon={ShieldCheck}>Data & privacy</SectionHeading>
          <p className="mb-4 text-sm leading-relaxed text-white/60">
            Download a copy of everything AstroYou stores about you, choose
            what usage data we collect, or delete your account.
          </p>
          <div className="space-y-3">
            <AnalyticsConsentToggle />
            <button
              type="button"
              onClick={() => void exportData()}
              disabled={exporting}
              className={`${ROW_CLASS} disabled:opacity-50`}
            >
              <span>{exporting ? "Preparing your data…" : "Export all my data (JSON)"}</span>
              {exporting ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <Download size={14} aria-hidden="true" />
              )}
            </button>
            {!deleteOpen ? (
              <button
                ref={deleteOpenerRef}
                type="button"
                onClick={openDeleteConfirm}
                aria-expanded={false}
                aria-controls="delete-account-confirm"
                className="w-full min-h-11 flex items-center justify-between p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-300 hover:bg-red-500/15 transition-colors"
              >
                <span>Delete my account</span>
                <Trash2 size={14} />
              </button>
            ) : (
              <form
                id="delete-account-confirm"
                aria-labelledby="delete-account-title"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleDeleteAccount();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && !deletingAccount) {
                    event.stopPropagation();
                    closeDeleteConfirm();
                  }
                }}
                className="rounded-xl border border-red-500/30 bg-red-500/10 p-4"
              >
                <h3
                  id="delete-account-title"
                  className="flex items-center gap-2 text-sm font-bold text-red-200"
                >
                  <Trash2 size={14} /> Delete your account permanently
                </h3>
                <p className="mt-2 text-xs leading-5 text-white/65">
                  This removes your profile, chart, chats, memories and
                  remaining credits. It can't be undone.
                </p>
                <label
                  htmlFor="delete-account-input"
                  className="mt-3 block text-xs text-white/70"
                >
                  Type <strong className="text-white">DELETE</strong> to confirm
                </label>
                <input
                  ref={deleteInputRef}
                  id="delete-account-input"
                  type="text"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  value={deleteText}
                  onChange={(event) => setDeleteText(event.target.value)}
                  aria-describedby={
                    deleteError ? "delete-account-error" : undefined
                  }
                  className="platform-field mt-2 text-white"
                />
                {deleteError && (
                  <p
                    id="delete-account-error"
                    role="alert"
                    className="mt-3 text-xs text-red-300"
                  >
                    {deleteError}
                  </p>
                )}
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="submit"
                    disabled={
                      deletingAccount || deleteText.trim() !== DELETE_WORD
                    }
                    className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-red-500/80 px-4 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-40"
                  >
                    {deletingAccount ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                    Delete account
                  </button>
                  <button
                    type="button"
                    onClick={closeDeleteConfirm}
                    disabled={deletingAccount}
                    className="min-h-11 flex-1 rounded-xl border border-white/15 px-4 text-sm text-white/75 hover:text-white disabled:opacity-40"
                  >
                    Keep my account
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      </div>

      <OnboardingModal
        isOpen={showEditBirth}
        onClose={() => setShowEditBirth(false)}
        existingProfile={profile}
      />
    </div>
  );
}
