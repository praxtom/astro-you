import { useState, useEffect } from "react";
import { postJson } from "../lib/apiFetch";
import { captureChartImage } from "../lib/chartStorage";
import { createChartShareFile } from "../lib/chart-share";
import { Share2, Download, Copy, X } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  birthData: { name?: string; dob: string; tob: string; pob?: string; lat?: number; lng?: number } | null;
  chartElementId?: string;
  filename?: string;
}

export default function ChartShareModal({
  isOpen,
  onClose,
  birthData,
  chartElementId,
  filename = "astroyou-natal-chart.png",
}: Props) {
  const [chartUrl, setChartUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || (!chartElementId && !birthData)) return;
    let cancelled = false;
    setLoading(true);
    setChartUrl(null);
    setError(null);

    const loadChart = chartElementId
      ? captureChartImage(chartElementId)
      : postJson("/api/kundali", { birthData, chartType: "RENDER_NATAL" })
          .then(async (response) => {
            if (!response.ok) throw new Error("Chart rendering failed");
            const data = await response.json();
            if (!data.url) throw new Error("Chart image was missing");
            return data.url as string;
          });

    loadChart
      .then((url) => {
        if (!cancelled) setChartUrl(url);
      })
      .catch(() => {
        if (!cancelled) {
          setChartUrl(null);
          setError("The chart image could not be prepared. Please try again.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, birthData, chartElementId]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!chartUrl) return;
    const a = document.createElement("a");
    a.href = chartUrl;
    a.download = filename;
    a.click();
  };

  const handleCopy = async () => {
    if (!chartUrl) return;
    await navigator.clipboard.writeText(chartUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!chartUrl) return;
    const shareData: ShareData = {
      title: "My AstroYou birth chart",
      text: "My Vedic birth chart from AstroYou",
    };

    if (chartUrl.startsWith("data:")) {
      const file = createChartShareFile(chartUrl, filename);
      if (navigator.canShare?.({ files: [file] })) shareData.files = [file];
    } else {
      shareData.url = chartUrl;
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (shareError) {
        if (shareError instanceof DOMException && shareError.name === "AbortError") return;
      }
    }

    handleDownload();
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="chart-share-title" className="bg-[#0a0a0f] border border-white/10 rounded-[2rem] p-6 w-full max-w-md mx-4 relative shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Close share dialog" className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors">
          <X size={20} />
        </button>
        <h3 id="chart-share-title" className="text-xl font-display text-white mb-4">Share Your Chart</h3>

        {loading ? (
          <div className="h-48 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
          </div>
        ) : chartUrl ? (
          <img src={chartUrl} alt="Natal Chart" className="w-full rounded-xl mb-4 border border-white/5" />
        ) : (
          <div className="h-48 flex items-center justify-center px-6 text-center text-white/40 text-sm">{error || "Chart unavailable"}</div>
        )}

        <div className="flex gap-3">
          <button onClick={handleDownload} disabled={!chartUrl} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-30">
            <Download size={16} /> Download
          </button>
          <button onClick={handleShare} disabled={!chartUrl} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gold/10 border border-gold/20 text-sm text-gold hover:bg-gold/20 transition-colors disabled:opacity-30">
            <Share2 size={16} /> Share
          </button>
          <button onClick={handleCopy} disabled={!chartUrl} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-30">
            <Copy size={16} /> {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>
      </div>
    </div>
  );
}
