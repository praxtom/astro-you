import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { Download, FileText, Loader2, Wallet } from "lucide-react";
import { PageShell } from "../components/layout/PageShell";
import AuthModal from "../components/AuthModal";
import { StatusNotice } from "../components/ui/StatusNotice";
import { useAuth } from "../lib/useAuth";
import { db } from "../lib/firebase";
import {
  useDashaPeriods,
  useKundali,
  useSubscription,
  useUserProfile,
} from "../hooks";
import Kundali from "../components/astrology/Kundali";
import { ChartThreeLinesCard } from "../components/dashboard/ChartThreeLinesCard";
import { STORAGE_KEYS } from "../lib/constants";
import { parseStoredJSON } from "../lib/safeStorage";
import { useCreditTopup } from "../hooks/useCreditTopup";
import { DEFAULT_CREDIT_PACK } from "../lib/credit-packs";
import { trackAcquisitionEvent } from "../lib/acquisition";
import {
  createReportRequestId,
  REPORT_PRODUCTS,
  type ClientReportProduct,
  type ClientReportType,
} from "../lib/report-products";
import { viewerDateKey } from "../lib/viewer-timezone";

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
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  // One request id per purchase attempt, kept until the server answers, so a
  // retry after a dropped connection reuses it and is never charged twice.
  const pendingRequestIds = useRef<Partial<Record<ClientReportType, string>>>(
    {},
  );

  // "My Chart" leads with the chart itself; the report store follows. Guests
  // see the chart they just cast (session profile) too.
  const [guestBirthData] = useState<any>(() =>
    parseStoredJSON(sessionStorage, STORAGE_KEYS.GUEST_PROFILE),
  );
  const chartBirthData: any = birthData?.dob ? birthData : guestBirthData;
  const hasChartBirthData = Boolean(chartBirthData?.dob && chartBirthData?.tob);
  const natal = useKundali(
    hasChartBirthData ? chartBirthData : null,
    "D1",
    profile?.zodiacMode,
  );
  const dasha = useDashaPeriods(hasChartBirthData ? chartBirthData : null);

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

  const reloadLibrary = useCallback(() => {
    setLibraryLoading(true);
    loadReports()
      .catch((err) => {
        console.error("Failed to load reports:", err);
        setLibraryError(
          "Your saved reports couldn't be loaded. Check your connection and try again.",
        );
      })
      .finally(() => setLibraryLoading(false));
  }, [loadReports]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setReports([]);
      setLibraryLoading(false);
      return;
    }

    reloadLibrary();
  }, [reloadLibrary, loading, user]);

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
      const requestId =
        pendingRequestIds.current[product.type] ?? createReportRequestId();
      pendingRequestIds.current[product.type] = requestId;
      const send = () =>
        fetch("/api/pdf-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idToken,
            requestId,
            birthData: reportBirthData,
            reportType: product.type,
            date: viewerDateKey(),
            localDate: viewerDateKey(),
          }),
        });
      let response: Response;
      try {
        response = await send();
      } catch {
        // Network drop: retry once with the SAME request id. The server either
        // finishes the original (served free) or reports it in progress.
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
        response = await send();
      }
      // The server answered: this purchase attempt is settled either way.
      delete pendingRequestIds.current[product.type];
      const errorPayload = response.ok
        ? null
        : await response.json().catch(() => null);
      if (response.status === 409 && errorPayload?.code === "report_in_progress") {
        await loadReports();
        throw new Error(
          errorPayload.error ||
            "This report is still being prepared. It will appear in your library shortly.",
        );
      }
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
      if (
        response.status === 409 &&
        errorPayload?.code === "report_not_available"
      ) {
        // Only completed reports re-download for free. Offer a fresh (charged)
        // report of the same type instead of failing silently.
        const product = REPORT_PRODUCTS.find(
          (p) => p.type === report.reportType,
        );
        if (
          product &&
          window.confirm(
            `This report can't be downloaded. Generate a new ${product.title} for ${product.creditCost} credits?`,
          )
        ) {
          setDownloadingId(null);
          await generateReport(product);
          return;
        }
        setError(
          "This report isn't available to download. Please generate a new report.",
        );
        return;
      }
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
        <section className="mb-8" aria-labelledby="my-chart-title">
          <p className="platform-eyebrow mb-2">My Chart</p>
          <h1 id="my-chart-title" className="type-page-title max-w-3xl">
            Your birth chart
          </h1>
          {!hasChartBirthData ? (
            <StatusNotice
              tone="info"
              size="section"
              className="mt-4"
              message="Add your birth date, time and place to see your chart."
              action={{ label: "Add birth details", to: "/onboarding" }}
            />
          ) : (
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-[minmax(0,28rem)_1fr] gap-4 items-start">
              <div className="platform-panel p-3">
                {natal.kundaliData ? (
                  <Kundali data={natal.kundaliData as any} />
                ) : natal.loading ? (
                  <div className="aspect-square w-full rounded-xl bg-white/5 animate-pulse" />
                ) : (
                  <StatusNotice
                    size="section"
                    message="Your chart is temporarily unavailable. Please try again in a little while."
                    onRetry={() => void natal.refetch()}
                  />
                )}
              </div>
              <ChartThreeLinesCard
                kundali={natal.kundaliData}
                kundaliLoading={natal.loading}
                dashaPeriods={dasha.periods}
                dashaLoading={dasha.loading}
                errorKind={dasha.errorKind}
                showFullChartLink={false}
                onRetry={() => {
                  dasha.retry();
                  void natal.refetch();
                }}
              />
            </div>
          )}
        </section>

        {/* Same column widths as the section below so the credits card lines
            up with the library column. The page already has its h1 above, so
            this is a section heading, not a second page title. */}
        <section className="grid grid-cols-1 xl:grid-cols-[1fr_22rem] gap-4 items-start mb-4">
          <div>
            <p className="platform-eyebrow mb-2">Reports</p>
            <h2 className="type-section-title max-w-3xl">
              Downloadable readings
            </h2>
            <p className="mt-2 max-w-2xl text-[0.95rem] leading-relaxed text-white/60">
              A PDF written from your birth details: what your chart says about
              you and which dates matter ahead. Keep it, print it or share it.
              Once made, it stays in your library and downloads again free.
            </p>
          </div>

          <aside className="platform-panel p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="type-meta uppercase text-white/55">
                  Your credits
                </p>
                <p className="type-kpi text-white mt-1">{credits}</p>
                <p className="type-meta text-white/55 mt-1">
                  Spend them on reports and consults.
                </p>
              </div>
              <Wallet className="text-gold" size={24} aria-hidden="true" />
            </div>
            <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="type-body-sm text-white/55">Plan</span>
                <span className="type-body-sm text-gold capitalize">
                  {tier}
                </span>
              </div>
              <button
                type="button"
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
          <StatusNotice
            size="section"
            className="mb-3"
            message={error || paymentError}
          />
        )}
        {success && (
          <p
            role="status"
            className="platform-panel mb-3 border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-200"
          >
            {success}
          </p>
        )}

        <section className="grid grid-cols-1 xl:grid-cols-[1fr_22rem] gap-4">
          <div className="space-y-3">
            <div>
              <h2 className="type-section-title">Create a report</h2>
              <p className="type-body-sm text-white/55">
                Each one shows its price in credits. You pay once per report.
              </p>
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
            <div className="mb-3">
              <h2 className="type-section-title">Your saved reports</h2>
              <p className="type-body-sm text-white/55">
                {user && (loading || libraryLoading)
                  ? "Loading…"
                  : libraryError
                    ? "Unavailable"
                    : user
                      ? `${reports.length} saved`
                      : "Your saved PDFs"}
              </p>
            </div>

            <div className="platform-panel overflow-hidden">
              {!user ? (
                <div className="p-4 text-center">
                  <FileText className="mx-auto text-white/20 mb-3" size={34} aria-hidden="true" />
                  <p className="type-body text-white/70">Private library</p>
                  <p className="type-body-sm text-white/55 mt-1">
                    Sign in to generate reports and download saved PDFs.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAuthModal(true)}
                    className="platform-button-secondary mt-4"
                  >
                    Sign in
                  </button>
                </div>
              ) : loading || libraryLoading ? (
                <div className="divide-y divide-white/10" aria-busy="true">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center justify-between gap-4 p-4">
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-1/2 rounded bg-white/5 animate-pulse" />
                        <div className="h-3 w-1/3 rounded bg-white/5 animate-pulse" />
                      </div>
                      <div className="h-9 w-24 rounded-lg bg-white/5 animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : libraryError ? (
                <div className="p-4">
                  <StatusNotice
                    size="section"
                    message={libraryError}
                    onRetry={reloadLibrary}
                  />
                </div>
              ) : reports.length === 0 ? (
                <div className="p-4 text-center">
                  <FileText className="mx-auto text-white/20 mb-3" size={34} aria-hidden="true" />
                  <p className="type-body text-white/70">
                    No saved reports yet.
                  </p>
                  <p className="type-body-sm text-white/55 mt-1">
                    Reports you create land here, ready to
                    download again any time at no extra cost.
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
          <Icon size={19} aria-hidden="true" />
        </div>
        <div>
          <h3 className="type-card-title text-white">{product.title}</h3>
          <p className="type-body-sm text-white/55">{product.description}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 md:justify-end">
        <span className="platform-chip shrink-0 whitespace-nowrap text-gold border-gold/20">
          {product.creditCost} credits
        </span>
        <button
          type="button"
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
          <p className="type-meta text-white/55 mt-1">
            {[
              report.status && report.status !== "completed"
                ? report.status.replace(/_/g, " ")
                : null,
              `${report.chargedCredits ?? report.creditCost ?? 0} credits`,
              createdAtDate && !Number.isNaN(createdAtDate.getTime())
                ? createdAtDate.toLocaleDateString()
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <button
          type="button"
          onClick={onDownload}
          disabled={isDownloading || report.status !== "completed"}
          className="platform-icon-button shrink-0 disabled:opacity-35"
          title="Download report"
          aria-label={`Download ${report.title || "report"}`}
        >
          {isDownloading ? (
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          ) : (
            <Download size={15} aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
