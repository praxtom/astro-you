import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { AlertCircle, Download, FileText, Loader2, Wallet } from "lucide-react";
import { PageShell } from "../components/layout/PageShell";
import AuthModal from "../components/AuthModal";
import { useAuth } from "../lib/useAuth";
import { db } from "../lib/firebase";
import { useSubscription, useUserProfile } from "../hooks";
import { useCreditTopup } from "../hooks/useCreditTopup";
import { DEFAULT_CREDIT_PACK } from "../lib/credit-packs";
import { trackAcquisitionEvent } from "../lib/acquisition";
import {
  REPORT_PRODUCTS,
  type ClientReportProduct,
  type ClientReportType,
} from "../lib/report-products";

interface ReportRecord {
  id: string;
  title?: string;
  reportType?: string;
  filename?: string;
  status?: string;
  chargedCredits?: number;
  creditCost?: number;
  createdAt?: string | { toDate?: () => Date };
}

export default function Reports() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { birthData, profile } = useUserProfile();
  const { credits, tier } = useSubscription();
  const { buyCredits, isPaying, error: paymentError } = useCreditTopup();
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [generatingType, setGeneratingType] = useState<ClientReportType | null>(
    null,
  );
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const loadReports = useCallback(async () => {
    if (!user) return;
    setLibraryError(null);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/reports/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, limit: 30 }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Could not load reports from server.");
      }
      setReports(Array.isArray(data.reports) ? data.reports : []);
      return;
    } catch (serverError) {
      console.warn(
        "[Reports] Server list unavailable, using Firestore read.",
        serverError,
      );
    }

    const snap = await getDocs(
      query(
        collection(db, "users", user.uid, "reports"),
        orderBy("createdAt", "desc"),
        limit(30),
      ),
    );
    setReports(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  }, [user]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setReports([]);
      return;
    }

    loadReports().catch((err) => {
      console.error("Failed to load reports:", err);
      setLibraryError("Report library is unavailable right now.");
    });
  }, [loadReports, loading, navigate, user]);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const generateReport = async (product: ClientReportProduct) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (product.requiresCompatibilityFlow) {
      trackAcquisitionEvent("report_generation_failed", {
        reportType: product.type,
        reason: "requires_compatibility_flow",
      });
      navigate("/compatibility");
      return;
    }
    if (!birthData?.dob || !birthData?.tob) {
      setError("Complete your birth details before generating a report.");
      trackAcquisitionEvent("report_generation_failed", {
        reportType: product.type,
        reason: "missing_birth_data",
      });
      return;
    }
    if (credits < product.creditCost) {
      setError(`You need ${product.creditCost} credits for this report.`);
      trackAcquisitionEvent("report_generation_failed", {
        reportType: product.type,
        reason: "insufficient_credits",
        requiredCredits: product.creditCost,
      });
      return;
    }

    setGeneratingType(product.type);
    setError(null);
    setSuccess(null);
    trackAcquisitionEvent("report_generation_started", {
      reportType: product.type,
      creditCost: product.creditCost,
    });
    try {
      const idToken = await user.getIdToken();
      const reportBirthData = {
        name: birthData.name || profile?.name || "Seeker",
        dob: birthData.dob,
        tob: birthData.tob,
        pob: birthData.pob || profile?.pob || "",
        lat: birthData.coordinates?.lat ?? profile?.coordinates?.lat,
        lng: birthData.coordinates?.lng ?? profile?.coordinates?.lng,
      };
      const response = await fetch("/api/pdf-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          birthData: reportBirthData,
          reportType: product.type,
          date: new Date().toISOString().split("T")[0],
        }),
      });
      const errorPayload = response.ok
        ? null
        : await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(errorPayload?.error || "Could not generate report.");
      }
      const blob = await response.blob();
      const filename =
        response.headers
          .get("Content-Disposition")
          ?.match(/filename="([^"]+)"/)?.[1] ||
        `astroyou-${product.type}-report.pdf`;
      downloadBlob(blob, filename);
      setSuccess(`${product.title} generated and saved.`);
      trackAcquisitionEvent("report_generation_completed", {
        reportType: product.type,
        creditCost: product.creditCost,
      });
      await loadReports();
    } catch (err) {
      console.error("Report generation failed:", err);
      setError(
        err instanceof Error ? err.message : "Could not generate report.",
      );
      trackAcquisitionEvent("report_generation_failed", {
        reportType: product.type,
        reason: "generation_error",
        creditCost: product.creditCost,
      });
    } finally {
      setGeneratingType(null);
    }
  };

  const startCreditTopup = () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    void buyCredits(DEFAULT_CREDIT_PACK.minutes);
  };

  const downloadReport = async (report: ReportRecord) => {
    if (!user) return;
    setDownloadingId(report.id);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/pdf-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, reportId: report.id }),
      });
      const errorPayload = response.ok
        ? null
        : await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(errorPayload?.error || "Could not download report");
      }
      const blob = await response.blob();
      downloadBlob(blob, report.filename || "astroyou-report.pdf");
    } catch (err) {
      console.error("Report download failed:", err);
      setError(
        err instanceof Error ? err.message : "Could not download report.",
      );
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <PageShell>
      <div>
        <section className="grid grid-cols-1 lg:grid-cols-[1fr_19rem] gap-4 items-start mb-4">
          <div>
            <p className="platform-eyebrow mb-2">Report Studio</p>
            <h1 className="type-page-title max-w-3xl">
              Reports that are generated, stored, and reusable.
            </h1>
            <p className="platform-copy mt-3 max-w-2xl">
              Generate PDF reports from your saved birth profile. Completed
              files are stored in your private library and can be downloaded
              again without another charge.
            </p>
          </div>

          <aside className="platform-panel p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="type-meta uppercase text-white/35">Credits</p>
                <p className="type-kpi text-white mt-1">{credits}</p>
              </div>
              <Wallet className="text-gold" size={24} />
            </div>
            <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="type-body-sm text-white/45">Plan</span>
                <span className="type-body-sm text-gold capitalize">
                  {tier}
                </span>
              </div>
              <button
                onClick={startCreditTopup}
                disabled={isPaying}
                className="platform-button-primary min-w-28"
              >
                {isPaying && <Loader2 size={15} className="animate-spin" />}
                {user ? `Add ${DEFAULT_CREDIT_PACK.label}` : "Sign in"}
              </button>
            </div>
          </aside>
        </section>

        {(error || paymentError) && (
          <div className="platform-panel mb-3 border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200 flex gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error || paymentError}</span>
          </div>
        )}
        {success && (
          <div className="platform-panel mb-3 border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">
            {success}
          </div>
        )}

        <section className="grid grid-cols-1 xl:grid-cols-[1fr_22rem] gap-4">
          <div className="space-y-3">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="type-section-title">Create a Report</h2>
                <p className="type-body-sm text-white/40">
                  Credit cost is shown before generation.
                </p>
              </div>
            </div>

            <div className="platform-panel divide-y divide-white/10">
              {REPORT_PRODUCTS.map((product) => (
                <ReportProductRow
                  key={product.type}
                  product={product}
                  isSignedIn={Boolean(user)}
                  credits={credits}
                  isGenerating={generatingType === product.type}
                  isAddingCredits={isPaying}
                  onAddCredits={startCreditTopup}
                  onGenerate={() => generateReport(product)}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="platform-panel p-4 mb-3">
              <p className="platform-eyebrow mb-2">Inside each PDF</p>
              <div className="space-y-2 type-body-sm text-white/50">
                <p>Chart context and timing windows are included.</p>
                <p>Generated files are saved for private redownload.</p>
                <p>Credit cost is fixed before the report starts.</p>
              </div>
            </div>

            <div className="flex items-end justify-between gap-4 mb-3">
              <div>
                <h2 className="type-section-title">Library</h2>
                <p className="type-body-sm text-white/40">
                  {reports.length} saved
                </p>
              </div>
            </div>

            <div className="platform-panel overflow-hidden">
              {!user ? (
                <div className="p-4 text-center">
                  <FileText className="mx-auto text-white/20 mb-3" size={34} />
                  <p className="type-body text-white/70">Private library</p>
                  <p className="type-body-sm text-white/35 mt-1">
                    Sign in to generate reports and download saved PDFs.
                  </p>
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="platform-button-secondary mt-4"
                  >
                    Sign in
                  </button>
                </div>
              ) : libraryError ? (
                <div className="p-4 text-center">
                  <AlertCircle
                    className="mx-auto text-amber-300/60 mb-3"
                    size={30}
                  />
                  <p className="type-body text-white/70">
                    Library unavailable.
                  </p>
                  <p className="type-body-sm text-white/35 mt-1">
                    {libraryError}
                  </p>
                </div>
              ) : reports.length === 0 ? (
                <div className="p-4 text-center">
                  <FileText className="mx-auto text-white/20 mb-3" size={34} />
                  <p className="type-body text-white/70">
                    No saved reports yet.
                  </p>
                  <p className="type-body-sm text-white/35 mt-1">
                    Generated PDFs appear here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/10">
                  {reports.map((report) => (
                    <SavedReportRow
                      key={report.id}
                      report={report}
                      isDownloading={downloadingId === report.id}
                      onDownload={() => downloadReport(report)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          void loadReports();
        }}
        title="Sign in for reports"
        message="Use your AstroYou account so generated PDFs, credits, and downloads stay tied to you."
      />
    </PageShell>
  );
}

function ReportProductRow({
  product,
  isSignedIn,
  credits,
  isGenerating,
  isAddingCredits,
  onAddCredits,
  onGenerate,
}: {
  product: ClientReportProduct;
  isSignedIn: boolean;
  credits: number;
  isGenerating: boolean;
  isAddingCredits: boolean;
  onAddCredits: () => void;
  onGenerate: () => void;
}) {
  const Icon = product.icon;
  const canAfford = credits >= product.creditCost;
  const needsAuth = !isSignedIn && !product.requiresCompatibilityFlow;
  const needsCredits =
    isSignedIn && !canAfford && !product.requiresCompatibilityFlow;
  const disabled = isGenerating || (needsCredits && isAddingCredits);

  return (
    <div className="flex flex-col md:flex-row md:items-center gap-3 p-3">
      <div className="flex items-start gap-3 flex-1">
        <div className="h-11 w-11 rounded-xl bg-gold/10 text-gold flex items-center justify-center shrink-0">
          <Icon size={19} />
        </div>
        <div>
          <h3 className="type-card-title text-white">{product.title}</h3>
          <p className="type-body-sm text-white/45">{product.description}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 md:justify-end">
        <span className="platform-chip shrink-0 whitespace-nowrap text-gold border-gold/20">
          {product.creditCost} credits
        </span>
        <button
          onClick={needsCredits ? onAddCredits : onGenerate}
          disabled={disabled}
          className="platform-button-primary min-w-36 disabled:opacity-45"
        >
          {isGenerating ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Creating
            </>
          ) : needsAuth ? (
            "Sign in"
          ) : needsCredits ? (
            <>
              {isAddingCredits && (
                <Loader2 size={14} className="animate-spin" />
              )}
              Add credits
            </>
          ) : (
            product.cta
          )}
        </button>
      </div>
    </div>
  );
}

function SavedReportRow({
  report,
  isDownloading,
  onDownload,
}: {
  report: ReportRecord;
  isDownloading: boolean;
  onDownload: () => void;
}) {
  const createdAtDate =
    typeof report.createdAt === "string"
      ? new Date(report.createdAt)
      : report.createdAt?.toDate?.();

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="type-card-title text-white">
            {report.title || "AstroYou Report"}
          </p>
          <p className="type-meta text-white/35 mt-1">
            {report.reportType || "report"} · {report.status || "unknown"} ·{" "}
            {report.chargedCredits ?? report.creditCost ?? 0} credits
          </p>
          {createdAtDate && !Number.isNaN(createdAtDate.getTime()) && (
            <p className="type-meta text-white/25 mt-1">
              {createdAtDate.toLocaleDateString()}
            </p>
          )}
        </div>
        <button
          onClick={onDownload}
          disabled={isDownloading || report.status !== "completed"}
          className="platform-icon-button shrink-0 disabled:opacity-35"
          title="Download report"
        >
          {isDownloading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Download size={15} />
          )}
        </button>
      </div>
    </div>
  );
}
