import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import {
  Users,
  CreditCard,
  TrendingUp,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  LifeBuoy,
  Lock,
  PackageCheck,
  UserCheck,
} from "lucide-react";
import Header from "../components/layout/Header";

interface Stats {
  totalUsers: number;
  premiumUsers: number;
  proUsers: number;
  payingUsers: number;
  paidConversionRate: number;
  estimatedMrr: number;
  totalCreditsOutstanding: number;
  totalCreditsUsed: number;
  recentUsers: AdminRecentUser[];
}

interface FunnelSummary {
  totalEvents: number;
  pageViews: number;
  seoToolCompletions: number;
  seoCtaClicks: number;
  onboardingCompletions: number;
  firstChats: number;
  consultProfileViews: number;
  consultStarts: number;
  consultReviews: number;
  pricingPackSelections: number;
  reportGenerations: number;
  reportGenerationFailures: number;
  payments: number;
  supportTickets: number;
  testimonialsSubmitted: number;
  remedyRequests: number;
  expertApplications: number;
  estimatedRevenue: number;
  paidConversionRate: number;
  topSources: Array<{ source: string; count: number }>;
  topPages: Array<{ path: string; count: number }>;
}

type ReadinessStatus = "ready" | "warning" | "blocked";

interface ReadinessItem {
  key: string;
  label: string;
  status: "configured" | "missing" | "warning";
  required: boolean;
  description: string;
}

interface ReadinessGroup {
  key: string;
  label: string;
  status: ReadinessStatus;
  items: ReadinessItem[];
}

interface LaunchReadinessReport {
  overallStatus: ReadinessStatus;
  summary: {
    requiredTotal: number;
    configuredRequired: number;
    missingRequired: number;
    warnings: number;
  };
  warnings: string[];
  groups: ReadinessGroup[];
  liveServices?: LiveServicesReport;
}

interface LiveServiceCheck {
  key: string;
  label: string;
  status: "pass" | "fail";
  message?: string;
}

interface LiveServicesReport {
  overallStatus: "ready" | "blocked";
  checks: LiveServiceCheck[];
}

interface AdminRecentUser {
  id: string;
  name: string | null;
  email: string | null;
  tier: "free" | "premium" | "pro";
  credits: number;
  updatedAt: string | null;
}

interface TrustModerationItem {
  id: string;
  kind?: string;
  uid?: string;
  email?: string;
  publicStatus?: string;
  publicName?: string;
  story?: string;
  personaId?: string;
  rating?: number;
  reviewText?: string;
  createdAt?: unknown;
}

interface AdminOperationItem {
  id: string;
  kind: "support" | "remedy";
  uid: string;
  email?: string | null;
  title: string;
  subtitle: string;
  detail: string;
  referenceId?: string | null;
  status: string;
  priorityScore: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface ExpertApplicationItem {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  city?: string;
  languages?: string[];
  specialties?: string[];
  experienceYears?: number;
  bio?: string;
  sampleApproach?: string;
  status: string;
  reviewStage?: string;
  createdAt?: string | null;
}

type CreditAdjustmentType = "refund" | "admin_adjustment";

interface CreditAdjustmentForm {
  targetUid: string;
  amount: string;
  reason: string;
  type: CreditAdjustmentType;
}

interface AuditLogItem {
  id: string;
  uid?: string | null;
  action?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown> | null;
  createdAt?: string | { _seconds?: number; seconds?: number } | null;
}

export default function Admin() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [funnelSummary, setFunnelSummary] = useState<FunnelSummary | null>(null);
  const [launchReadiness, setLaunchReadiness] = useState<LaunchReadinessReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [funnelLoading, setFunnelLoading] = useState(false);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [moderationItems, setModerationItems] = useState<TrustModerationItem[]>([]);
  const [moderationLoading, setModerationLoading] = useState(false);
  const [moderationBusyId, setModerationBusyId] = useState<string | null>(null);
  const [moderationStatus, setModerationStatus] = useState("");
  const [operationItems, setOperationItems] = useState<AdminOperationItem[]>([]);
  const [operationsLoading, setOperationsLoading] = useState(false);
  const [operationsBusyId, setOperationsBusyId] = useState<string | null>(null);
  const [operationsStatus, setOperationsStatus] = useState("");
  const [expertApplications, setExpertApplications] = useState<ExpertApplicationItem[]>([]);
  const [expertsLoading, setExpertsLoading] = useState(false);
  const [expertsBusyId, setExpertsBusyId] = useState<string | null>(null);
  const [expertsStatus, setExpertsStatus] = useState("");
  const [creditForm, setCreditForm] = useState<CreditAdjustmentForm>({
    targetUid: "",
    amount: "",
    reason: "",
    type: "refund",
  });
  const [creditBusy, setCreditBusy] = useState(false);
  const [creditStatus, setCreditStatus] = useState("");
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditStatus, setAuditStatus] = useState("");

  const loadAdminSummary = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setAdminError("");
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/admin/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load admin summary");
      setStats(data as Stats);
    } catch (err: any) {
      console.error("Admin fetch error:", err);
      if (/admin access/i.test(err.message || "")) {
        navigate("/dashboard");
        return;
      }
      setAdminError(err.message || "Could not load admin summary");
    } finally {
      setLoading(false);
    }
  }, [user, navigate]);

  const loadLaunchReadiness = useCallback(async () => {
    if (!user) return;
    setReadinessLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/admin/launch-readiness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load launch readiness");
      setLaunchReadiness(data as LaunchReadinessReport);
    } catch (err: any) {
      if (/admin access/i.test(err.message || "")) {
        navigate("/dashboard");
        return;
      }
      setLaunchReadiness(null);
    } finally {
      setReadinessLoading(false);
    }
  }, [user, navigate]);

  const loadFunnelSummary = useCallback(async () => {
    if (!user) return;
    setFunnelLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/admin/funnel-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, limit: 1000 }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load funnel summary");
      setFunnelSummary(data as FunnelSummary);
    } catch (err: any) {
      if (/admin access/i.test(err.message || "")) {
        navigate("/dashboard");
        return;
      }
      setFunnelSummary(null);
    } finally {
      setFunnelLoading(false);
    }
  }, [user, navigate]);

  const loadAuditLogs = useCallback(async () => {
    if (!user) return;
    setAuditLoading(true);
    setAuditStatus("");
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/admin/audit-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, limit: 100 }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load audit logs");
      setAuditLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (err: any) {
      if (/admin access/i.test(err.message || "")) {
        navigate("/dashboard");
        return;
      }
      setAuditStatus(err.message || "Could not load audit logs");
    } finally {
      setAuditLoading(false);
    }
  }, [user, navigate]);

  const submitCreditAdjustment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    const targetUid = creditForm.targetUid.trim();
    const amount = Number(creditForm.amount);
    const reason = creditForm.reason.trim();

    if (!targetUid || !Number.isFinite(amount) || amount === 0) {
      setCreditStatus("Add a target UID and a non-zero credit amount.");
      return;
    }
    if (reason.length < 5) {
      setCreditStatus("Add a clear adjustment reason.");
      return;
    }

    setCreditBusy(true);
    setCreditStatus("");
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/admin/credit-adjustment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          targetUid,
          amount,
          reason,
          type: creditForm.type,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Credit adjustment failed");

      setCreditStatus(`Credit adjustment saved. New balance: ${data.balanceAfter ?? "updated"}.`);
      setCreditForm({ targetUid: "", amount: "", reason: "", type: "refund" });
      await Promise.all([loadAdminSummary(), loadAuditLogs()]);
    } catch (err: any) {
      setCreditStatus(err.message || "Credit adjustment failed");
    } finally {
      setCreditBusy(false);
    }
  };

  const loadExpertApplications = useCallback(async () => {
    if (!user) return;
    setExpertsLoading(true);
    setExpertsStatus("");
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/admin/expert-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, action: "list", limit: 50 }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load expert applications");
      setExpertApplications(Array.isArray(data.items) ? data.items : []);
    } catch (err: any) {
      if (/admin access/i.test(err.message || "")) {
        navigate("/dashboard");
        return;
      }
      setExpertsStatus(err.message || "Could not load expert applications");
    } finally {
      setExpertsLoading(false);
    }
  }, [user, navigate]);

  const reviewExpertApplication = async (
    item: ExpertApplicationItem,
    status: "under_review" | "approved" | "rejected" | "waitlisted",
  ) => {
    if (!user) return;
    setExpertsBusyId(item.id);
    setExpertsStatus("");
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/admin/expert-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          action: "update",
          applicationId: item.id,
          status,
          note: `Set to ${status} from admin dashboard.`,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not update expert application");
      setExpertsStatus(`${item.fullName || "Application"} updated.`);
      await loadExpertApplications();
    } catch (err: any) {
      setExpertsStatus(err.message || "Could not update expert application");
    } finally {
      setExpertsBusyId(null);
    }
  };

  const loadOperationsQueue = useCallback(async () => {
    if (!user) return;
    setOperationsLoading(true);
    setOperationsStatus("");
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/admin/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, action: "list", limit: 50 }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load operations queue");
      setOperationItems(Array.isArray(data.items) ? data.items : []);
    } catch (err: any) {
      if (/admin access/i.test(err.message || "")) {
        navigate("/dashboard");
        return;
      }
      setOperationsStatus(err.message || "Could not load operations queue");
    } finally {
      setOperationsLoading(false);
    }
  }, [user, navigate]);

  const updateOperation = async (item: AdminOperationItem, status: string) => {
    if (!user) return;
    setOperationsBusyId(item.id);
    setOperationsStatus("");
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/admin/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          action: "update",
          kind: item.kind,
          itemId: item.id,
          status,
          note: `Set to ${status} from admin dashboard.`,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not update operation");
      setOperationsStatus(`${item.kind === "support" ? "Support ticket" : "Remedy request"} updated.`);
      await loadOperationsQueue();
    } catch (err: any) {
      setOperationsStatus(err.message || "Could not update operation");
    } finally {
      setOperationsBusyId(null);
    }
  };

  const loadTrustModeration = useCallback(async () => {
    if (!user) return;
    setModerationLoading(true);
    setModerationStatus("");
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/admin/trust-moderation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, action: "list", limit: 50 }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load moderation queue");
      setModerationItems(Array.isArray(data.items) ? data.items : []);
    } catch (err: any) {
      if (/admin access/i.test(err.message || "")) {
        navigate("/dashboard");
        return;
      }
      setModerationStatus(err.message || "Could not load moderation queue");
    } finally {
      setModerationLoading(false);
    }
  }, [user, navigate]);

  const moderateTrustItem = async (
    item: TrustModerationItem,
    action: "approve" | "reject",
  ) => {
    if (!user) return;
    setModerationBusyId(item.id);
    setModerationStatus("");
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/admin/trust-moderation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          action,
          moderationId: item.id,
          note: action === "approve" ? "Approved from admin dashboard." : "Rejected from admin dashboard.",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Moderation update failed");
      setModerationStatus(`${action === "approve" ? "Approved" : "Rejected"} ${item.kind || "item"}.`);
      await loadTrustModeration();
    } catch (err: any) {
      setModerationStatus(err.message || "Moderation update failed");
    } finally {
      setModerationBusyId(null);
    }
  };

  useEffect(() => {
    if (!user) return;

    void loadAdminSummary();
    void loadFunnelSummary();
    void loadLaunchReadiness();
    void loadTrustModeration();
    void loadOperationsQueue();
    void loadExpertApplications();
    void loadAuditLogs();
  }, [
    user,
    loadAdminSummary,
    loadFunnelSummary,
    loadLaunchReadiness,
    loadTrustModeration,
    loadOperationsQueue,
    loadExpertApplications,
    loadAuditLogs,
  ]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#030308] text-white">
        <Header />
        <main className="container mx-auto flex min-h-[70vh] items-center justify-center px-6 pt-24">
          <Loader2 size={28} className="animate-spin text-white/30" />
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#030308] text-white">
        <Header />
        <main className="container mx-auto flex min-h-[72vh] items-center justify-center px-6 pt-24">
          <section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.035] p-6 text-center">
            <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-gold/20 bg-gold/10 text-gold">
              <Lock size={20} />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-gold">
              Admin Access
            </p>
            <h1 className="mt-3 font-display text-2xl text-white">
              Sign in with an admin account.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-white/50">
              This dashboard is only for operations, trust moderation, launch
              readiness, and product metrics.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                onClick={() => navigate("/")}
                className="rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-black"
              >
                Go to home
              </button>
              <button
                onClick={() => navigate("/dashboard")}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-white/55 hover:text-white"
              >
                Dashboard
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030308] text-white">
      <Header />
      <main className="platform-main">
        <button
          onClick={() => navigate("/dashboard")}
          className="mb-4 flex items-center gap-2 text-sm text-white/40 hover:text-white"
        >
          <ArrowLeft size={16} /> Dashboard
        </button>
        <div className="mb-4">
          <p className="platform-eyebrow mb-2">Operations</p>
          <h1 className="type-page-title">Admin Dashboard</h1>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-white/30" />
          </div>
        ) : adminError ? (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
            {adminError}
          </div>
        ) : (
          stats && (
            <>
              {/* Metric Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <MetricCard
                  icon={<Users size={20} />}
                  label="Total Users"
                  value={stats.totalUsers}
                />
                <MetricCard
                  icon={<CreditCard size={20} />}
                  label="Premium"
                  value={stats.premiumUsers}
                  color="text-amber-400"
                />
                <MetricCard
                  icon={<CreditCard size={20} />}
                  label="Pro"
                  value={stats.proUsers}
                  color="text-gold"
                />
                <MetricCard
                  icon={<TrendingUp size={20} />}
                  label="Credits Held"
                  value={stats.totalCreditsOutstanding}
                />
              </div>

              {/* Conversion */}
              <div className="platform-panel p-4 mb-6">
                <h2 className="text-gold text-sm font-bold uppercase tracking-widest mb-4">
                  Conversion
                </h2>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="type-kpi text-white">
                      {stats.paidConversionRate.toFixed(1)}
                      %
                    </p>
                    <p className="text-xs text-white/40">Paid conversion</p>
                  </div>
                  <div>
                    <p className="type-kpi text-white">
                      {stats.estimatedMrr.toLocaleString()}
                    </p>
                    <p className="text-xs text-white/40">MRR</p>
                  </div>
                  <div>
                    <p className="type-kpi text-white">
                      {stats.payingUsers}
                    </p>
                    <p className="text-xs text-white/40">Paying users</p>
                  </div>
                </div>
              </div>

              <div className="platform-panel p-4 mb-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-gold text-sm font-bold uppercase tracking-widest">
                      Launch Readiness
                    </h2>
                    <p className="mt-1 text-xs text-white/35">
                      Required production configuration without exposing secret values.
                    </p>
                  </div>
                  <button
                    onClick={loadLaunchReadiness}
                    disabled={readinessLoading}
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/50 hover:text-gold disabled:opacity-40"
                  >
                    {readinessLoading ? "Loading" : "Refresh"}
                  </button>
                </div>

                {!launchReadiness ? (
                  <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/35">
                    Readiness check is unavailable until admin configuration can be verified.
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-4">
                      <ReadinessSummaryCard
                        label="Overall"
                        value={launchReadiness.overallStatus}
                        status={launchReadiness.overallStatus}
                      />
                      <ReadinessSummaryCard
                        label="Configured"
                        value={`${launchReadiness.summary.configuredRequired}/${launchReadiness.summary.requiredTotal}`}
                        status={launchReadiness.summary.missingRequired > 0 ? "blocked" : "ready"}
                      />
                      <ReadinessSummaryCard
                        label="Missing"
                        value={launchReadiness.summary.missingRequired}
                        status={launchReadiness.summary.missingRequired > 0 ? "blocked" : "ready"}
                      />
                      <ReadinessSummaryCard
                        label="Warnings"
                        value={launchReadiness.summary.warnings}
                        status={launchReadiness.summary.warnings > 0 ? "warning" : "ready"}
                      />
                    </div>

                    {launchReadiness.warnings.length > 0 && (
                      <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-3">
                        {launchReadiness.warnings.map((warning) => (
                          <p key={warning} className="text-sm text-amber-100/80">
                            {warning}
                          </p>
                        ))}
                      </div>
                    )}

                    <div className="grid gap-3 xl:grid-cols-2">
                      {launchReadiness.groups.map((group) => (
                        <ReadinessGroupPanel key={group.key} group={group} />
                      ))}
                    </div>

                    {launchReadiness.liveServices && (
                      <LiveServicesPanel report={launchReadiness.liveServices} />
                    )}
                  </div>
                )}
              </div>

              <div className="platform-panel p-4 mb-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-gold text-sm font-bold uppercase tracking-widest">
                      Funnel
                    </h2>
                    <p className="mt-1 text-xs text-white/35">
                      Recent first-party events from SEO, onboarding, consults, and payments.
                    </p>
                  </div>
                  <button
                    onClick={loadFunnelSummary}
                    disabled={funnelLoading}
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/50 hover:text-gold disabled:opacity-40"
                  >
                    {funnelLoading ? "Loading" : "Refresh"}
                  </button>
                </div>

                {!funnelSummary ? (
                  <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/35">
                    Funnel metrics are unavailable until analytics events are recorded.
                  </p>
                ) : (
                  <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      <FunnelMetric label="Events" value={funnelSummary.totalEvents} />
                      <FunnelMetric label="SEO tool runs" value={funnelSummary.seoToolCompletions} />
                      <FunnelMetric label="Onboarded" value={funnelSummary.onboardingCompletions} />
                      <FunnelMetric label="Payments" value={funnelSummary.payments} />
                      <FunnelMetric label="Pack picks" value={funnelSummary.pricingPackSelections} />
                      <FunnelMetric label="Profile views" value={funnelSummary.consultProfileViews} />
                      <FunnelMetric label="Consult starts" value={funnelSummary.consultStarts} />
                      <FunnelMetric label="Reviews" value={funnelSummary.consultReviews} />
                      <FunnelMetric label="First chats" value={funnelSummary.firstChats} />
                      <FunnelMetric label="Report fails" value={funnelSummary.reportGenerationFailures} />
                      <FunnelMetric label="Trust stories" value={funnelSummary.testimonialsSubmitted} />
                      <FunnelMetric label="Paid conv." value={`${funnelSummary.paidConversionRate.toFixed(1)}%`} />
                      <FunnelMetric label="Revenue" value={`₹${funnelSummary.estimatedRevenue.toLocaleString()}`} />
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                      <RankList
                        title="Top sources"
                        rows={funnelSummary.topSources.map((item) => ({
                          label: item.source,
                          value: item.count,
                        }))}
                      />
                      <RankList
                        title="Top pages"
                        rows={funnelSummary.topPages.map((item) => ({
                          label: item.path,
                          value: item.count,
                        }))}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Recent Users */}
              <div className="platform-panel p-4">
                <h2 className="text-gold text-sm font-bold uppercase tracking-widest mb-4">
                  Recent Users
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-white/40 text-xs uppercase tracking-widest border-b border-white/10">
                        <th className="text-left py-2 px-2">Name</th>
                        <th className="text-left py-2 px-2">Email</th>
                        <th className="text-left py-2 px-2">UID</th>
                        <th className="text-center py-2 px-2">Tier</th>
                        <th className="text-right py-2 px-2">Credits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentUsers.map((u) => (
                        <tr key={u.id} className="border-b border-white/5">
                          <td className="py-2 px-2 text-white/80">
                            {u.name || "\u2014"}
                          </td>
                          <td className="py-2 px-2 text-white/60">
                            {u.email || "\u2014"}
                          </td>
                          <td className="max-w-36 truncate py-2 px-2 font-mono text-xs text-white/35">
                            {u.id}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                u.tier === "pro"
                                  ? "bg-gold/20 text-gold"
                                  : u.tier === "premium"
                                    ? "bg-amber-500/20 text-amber-400"
                                    : "bg-white/10 text-white/40"
                              }`}
                            >
                              {u.tier}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right text-white/60 font-mono">
                            {u.credits ?? "\u2014"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                <section className="platform-panel p-4">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="platform-eyebrow">Credit adjustment</p>
                      <p className="mt-1 type-body-sm text-white/40">
                        Refund or correct credits from the server-owned ledger.
                      </p>
                    </div>
                    <CreditCard className="text-gold" size={20} />
                  </div>

                  <form onSubmit={submitCreditAdjustment} className="grid gap-3">
                    <label>
                      <span className="type-meta uppercase text-white/40">Target UID</span>
                      <input
                        value={creditForm.targetUid}
                        onChange={(event) =>
                          setCreditForm((current) => ({
                            ...current,
                            targetUid: event.target.value,
                          }))
                        }
                        className="platform-field mt-1.5 px-3 py-2 text-sm"
                        placeholder="Paste user UID"
                      />
                    </label>

                    <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
                      <label>
                        <span className="type-meta uppercase text-white/40">Amount</span>
                        <input
                          value={creditForm.amount}
                          onChange={(event) =>
                            setCreditForm((current) => ({
                              ...current,
                              amount: event.target.value,
                            }))
                          }
                          className="platform-field mt-1.5 px-3 py-2 text-sm"
                          inputMode="numeric"
                          placeholder="+50 or -10"
                        />
                      </label>
                      <label>
                        <span className="type-meta uppercase text-white/40">Type</span>
                        <select
                          value={creditForm.type}
                          onChange={(event) =>
                            setCreditForm((current) => ({
                              ...current,
                              type: event.target.value as CreditAdjustmentType,
                            }))
                          }
                          className="platform-field mt-1.5 px-3 py-2 text-sm"
                        >
                          <option value="refund" className="bg-[#111118]">Refund</option>
                          <option value="admin_adjustment" className="bg-[#111118]">
                            Adjustment
                          </option>
                        </select>
                      </label>
                    </div>

                    <label>
                      <span className="type-meta uppercase text-white/40">Reason</span>
                      <textarea
                        value={creditForm.reason}
                        onChange={(event) =>
                          setCreditForm((current) => ({
                            ...current,
                            reason: event.target.value,
                          }))
                        }
                        className="platform-field mt-1.5 min-h-20 resize-none px-3 py-2 text-sm"
                        placeholder="Example: duplicate Razorpay charge pay_123 verified."
                      />
                    </label>

                    {creditStatus && (
                      <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 type-body-sm text-white/55">
                        {creditStatus}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={creditBusy}
                      className="platform-button-primary w-full disabled:opacity-45"
                    >
                      {creditBusy && <Loader2 size={14} className="animate-spin" />}
                      Save credit adjustment
                    </button>
                  </form>
                </section>

                <section className="platform-panel p-4">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="platform-eyebrow">Audit logs</p>
                      <p className="mt-1 type-body-sm text-white/40">
                        Recent admin, billing, trust, and account actions.
                      </p>
                    </div>
                    <button
                      onClick={loadAuditLogs}
                      disabled={auditLoading}
                      className="platform-button-secondary"
                    >
                      {auditLoading ? "Loading" : "Refresh"}
                    </button>
                  </div>

                  {auditStatus && (
                    <p className="mb-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 type-body-sm text-white/55">
                      {auditStatus}
                    </p>
                  )}

                  {auditLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 size={22} className="animate-spin text-white/30" />
                    </div>
                  ) : auditLogs.length === 0 ? (
                    <p className="rounded-lg border border-white/10 bg-white/[0.03] p-3 type-body-sm text-white/35">
                      No audit logs found.
                    </p>
                  ) : (
                    <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                      {auditLogs.map((log) => (
                        <article
                          key={log.id}
                          className="rounded-lg border border-white/10 bg-black/20 p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="type-card-title truncate text-white/85">
                                {log.action || "audit_action"}
                              </p>
                              <p className="mt-1 type-meta text-white/35">
                                {log.entityType || "entity"}
                                {log.entityId ? ` · ${log.entityId}` : ""}
                              </p>
                            </div>
                            <span className="shrink-0 type-meta text-white/30">
                              {formatAdminDate(log.createdAt)}
                            </span>
                          </div>
                          <p className="mt-2 break-all font-mono text-[11px] text-white/35">
                            {log.uid || "system"}
                          </p>
                          {log.metadata && (
                            <p className="mt-2 line-clamp-2 type-body-sm text-white/45">
                              {summarizeMetadata(log.metadata)}
                            </p>
                          )}
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              <div className="platform-panel p-4 mt-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-gold text-sm font-bold uppercase tracking-widest">
                      Expert Applications
                    </h2>
                    <p className="mt-1 text-xs text-white/35">
                      Move real astrologer applicants through intake, review, and listing setup.
                    </p>
                  </div>
                  <button
                    onClick={loadExpertApplications}
                    disabled={expertsLoading}
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/50 hover:text-gold disabled:opacity-40"
                  >
                    {expertsLoading ? "Loading" : "Refresh"}
                  </button>
                </div>

                {expertsStatus && (
                  <p className="mb-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/55">
                    {expertsStatus}
                  </p>
                )}

                {expertsLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 size={24} className="animate-spin text-white/30" />
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {expertApplications.length === 0 && (
                      <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/35">
                        No expert applications found.
                      </p>
                    )}
                    {expertApplications.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-2 py-1 text-[11px] font-bold uppercase tracking-widest text-gold">
                                <UserCheck size={12} />
                                applicant
                              </span>
                              <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] text-white/45">
                                {item.status}
                              </span>
                              <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] text-white/35">
                                {item.reviewStage || "intake"}
                              </span>
                            </div>
                            <p className="font-semibold text-white/85">{item.fullName}</p>
                            <p className="mt-1 text-xs text-white/35">
                              {item.email}
                              {item.city ? ` · ${item.city}` : ""}
                              {typeof item.experienceYears === "number"
                                ? ` · ${item.experienceYears} yrs`
                                : ""}
                            </p>
                            <p className="mt-2 text-sm text-white/55">
                              {(item.languages || []).join(", ") || "No language listed"} ·{" "}
                              {(item.specialties || []).join(", ") || "No specialty listed"}
                            </p>
                            {(item.bio || item.sampleApproach) && (
                              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-white/55">
                                {item.bio || item.sampleApproach}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <button
                              onClick={() => reviewExpertApplication(item, "under_review")}
                              disabled={expertsBusyId !== null || item.status === "under_review"}
                              className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-white/55 hover:text-gold disabled:opacity-35"
                            >
                              Review
                            </button>
                            <button
                              onClick={() => reviewExpertApplication(item, "approved")}
                              disabled={expertsBusyId !== null || item.status === "approved"}
                              className="rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-35"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => reviewExpertApplication(item, "rejected")}
                              disabled={expertsBusyId !== null || item.status === "rejected"}
                              className="rounded-lg bg-red-500/15 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/20 disabled:opacity-35"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="platform-panel p-4 mt-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-gold text-sm font-bold uppercase tracking-widest">
                      Operations Queue
                    </h2>
                    <p className="mt-1 text-xs text-white/35">
                      Resolve support issues and remedy requests from one place.
                    </p>
                  </div>
                  <button
                    onClick={loadOperationsQueue}
                    disabled={operationsLoading}
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/50 hover:text-gold disabled:opacity-40"
                  >
                    {operationsLoading ? "Loading" : "Refresh"}
                  </button>
                </div>

                {operationsStatus && (
                  <p className="mb-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/55">
                    {operationsStatus}
                  </p>
                )}

                {operationsLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 size={24} className="animate-spin text-white/30" />
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {operationItems.length === 0 && (
                      <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/35">
                        No open operations found.
                      </p>
                    )}
                    {operationItems.map((item) => (
                      <div
                        key={`${item.kind}-${item.id}`}
                        className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-2 py-1 text-[11px] font-bold uppercase tracking-widest text-gold">
                                {item.kind === "support" ? (
                                  <LifeBuoy size={12} />
                                ) : (
                                  <PackageCheck size={12} />
                                )}
                                {item.kind}
                              </span>
                              <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] text-white/45">
                                {item.status}
                              </span>
                              <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] text-white/35">
                                Priority {item.priorityScore}
                              </span>
                            </div>
                            <p className="font-semibold text-white/85">{item.title}</p>
                            <p className="mt-1 text-xs uppercase tracking-wider text-white/35">
                              {item.subtitle}
                            </p>
                            <p className="mt-2 text-sm leading-relaxed text-white/60">
                              {item.detail || "No additional detail provided."}
                            </p>
                            <p className="mt-2 text-xs text-white/30">
                              {item.email || item.uid}
                              {item.referenceId ? ` · ${item.referenceId}` : ""}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2">
                            {item.kind === "support" ? (
                              <>
                                <button
                                  onClick={() => updateOperation(item, "in_progress")}
                                  disabled={operationsBusyId !== null || item.status === "in_progress"}
                                  className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-white/55 hover:text-gold disabled:opacity-35"
                                >
                                  Working
                                </button>
                                <button
                                  onClick={() => updateOperation(item, "resolved")}
                                  disabled={operationsBusyId !== null || item.status === "resolved"}
                                  className="rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-35"
                                >
                                  Resolve
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => updateOperation(item, "reviewing")}
                                  disabled={operationsBusyId !== null || item.status === "reviewing"}
                                  className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-white/55 hover:text-gold disabled:opacity-35"
                                >
                                  Reviewing
                                </button>
                                <button
                                  onClick={() => updateOperation(item, "fulfilled")}
                                  disabled={operationsBusyId !== null || item.status === "fulfilled"}
                                  className="rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-35"
                                >
                                  Fulfilled
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="platform-panel p-4 mt-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-gold text-sm font-bold uppercase tracking-widest">
                      Trust Moderation
                    </h2>
                    <p className="mt-1 text-xs text-white/35">
                      Approve only real, submitted reviews and testimonials.
                    </p>
                  </div>
                  <button
                    onClick={loadTrustModeration}
                    disabled={moderationLoading}
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/50 hover:text-gold disabled:opacity-40"
                  >
                    {moderationLoading ? "Loading" : "Refresh"}
                  </button>
                </div>

                {moderationStatus && (
                  <p className="mb-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/55">
                    {moderationStatus}
                  </p>
                )}

                {moderationLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 size={24} className="animate-spin text-white/30" />
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {moderationItems.length === 0 && (
                      <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/35">
                        No trust submissions found.
                      </p>
                    )}
                    {moderationItems.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-2 py-1 text-[11px] font-bold uppercase tracking-widest text-gold">
                                <ShieldCheck size={12} />
                                {item.kind || "trust item"}
                              </span>
                              <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] text-white/40">
                                {item.publicStatus || "unknown"}
                              </span>
                              {item.rating && (
                                <span className="text-xs text-gold">
                                  {"★".repeat(item.rating)}
                                </span>
                              )}
                            </div>
                            <p className="text-sm leading-relaxed text-white/70">
                              {item.kind === "testimonial"
                                ? item.story || "No story text"
                                : item.reviewText || "No review text"}
                            </p>
                            <p className="mt-2 text-xs text-white/35">
                              {item.publicName || item.email || item.uid || item.personaId || "Unknown source"}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button
                              onClick={() => moderateTrustItem(item, "approve")}
                              disabled={moderationBusyId !== null || item.publicStatus === "approved"}
                              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-35"
                            >
                              <CheckCircle2 size={14} />
                              Approve
                            </button>
                            <button
                              onClick={() => moderateTrustItem(item, "reject")}
                              disabled={moderationBusyId !== null || item.publicStatus === "rejected"}
                              className="inline-flex items-center gap-2 rounded-lg bg-red-500/15 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/20 disabled:opacity-35"
                            >
                              <XCircle size={14} />
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )
        )}
      </main>
    </div>
  );
}

function formatAdminDate(value: AuditLogItem["createdAt"]) {
  if (!value) return "";
  const date =
    typeof value === "string"
      ? new Date(value)
      : new Date(((value._seconds ?? value.seconds ?? 0) as number) * 1000);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function summarizeMetadata(metadata: Record<string, unknown>) {
  const entries = Object.entries(metadata)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .slice(0, 4);
  if (entries.length === 0) return "No metadata";
  return entries
    .map(([key, value]) => {
      const printable =
        typeof value === "object" ? JSON.stringify(value) : String(value);
      return `${key}: ${printable.slice(0, 80)}`;
    })
    .join(" · ");
}

function MetricCard({
  icon,
  label,
  value,
  color = "text-white",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="platform-panel p-4">
      <div className="text-gold mb-2">{icon}</div>
      <p className={`text-2xl font-display ${color}`}>
        {value.toLocaleString()}
      </p>
      <p className="text-xs text-white/40 mt-1">{label}</p>
    </div>
  );
}

function FunnelMetric({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-lg font-display text-white/90">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      <p className="mt-1 text-[11px] uppercase tracking-widest text-white/35">
        {label}
      </p>
    </div>
  );
}

function RankList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: number }>;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-white/45">
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-white/30">No data yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3">
              <span className="truncate text-sm text-white/55">{row.label}</span>
              <span className="font-mono text-xs text-gold">{row.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReadinessSummaryCard({
  label,
  value,
  status,
}: {
  label: string;
  value: number | string;
  status: ReadinessStatus;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-widest text-white/35">
          {label}
        </p>
        <ReadinessBadge status={status} />
      </div>
      <p className="text-lg font-display text-white/90">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

function ReadinessGroupPanel({ group }: { group: ReadinessGroup }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-bold uppercase tracking-widest text-white/55">
          {group.label}
        </p>
        <ReadinessBadge status={group.status} />
      </div>
      <div className="space-y-2">
        {group.items.map((item) => (
          <div
            key={item.key}
            className="rounded-lg border border-white/5 bg-black/10 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-white/75">{item.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-white/35">
                  {item.description}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${
                  item.status === "configured"
                    ? "bg-emerald-500/10 text-emerald-300"
                    : item.status === "warning"
                      ? "bg-amber-500/10 text-amber-300"
                      : "bg-red-500/10 text-red-300"
                }`}
              >
                {item.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LiveServicesPanel({ report }: { report: LiveServicesReport }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-white/55">
            Live service access
          </p>
          <p className="mt-1 text-xs text-white/35">
            Confirms configured credentials can actually reach Firebase services.
          </p>
        </div>
        <ReadinessBadge status={report.overallStatus} />
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {report.checks.map((check) => (
          <div
            key={check.key}
            className="rounded-lg border border-white/5 bg-black/10 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-white/75">{check.label}</p>
              <span
                className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${
                  check.status === "pass"
                    ? "bg-emerald-500/10 text-emerald-300"
                    : "bg-red-500/10 text-red-300"
                }`}
              >
                {check.status}
              </span>
            </div>
            {check.message && (
              <p className="mt-2 text-xs leading-relaxed text-red-200/70">
                {check.message}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReadinessBadge({ status }: { status: ReadinessStatus }) {
  const className =
    status === "ready"
      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
      : status === "warning"
        ? "border-amber-400/20 bg-amber-500/10 text-amber-300"
        : "border-red-400/20 bg-red-500/10 text-red-300";

  return (
    <span
      className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${className}`}
    >
      {status}
    </span>
  );
}
