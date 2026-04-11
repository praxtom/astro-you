import { useState, useEffect } from "react";
import { Share2, Download, Copy, X } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  birthData: { name?: string; dob: string; tob: string; pob?: string; lat?: number; lng?: number } | null;
}

export default function ChartShareModal({ isOpen, onClose, birthData }: Props) {
  const [chartUrl, setChartUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !birthData) return;
    setLoading(true);
    setChartUrl(null);
    fetch("/api/kundali", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ birthData, chartType: "RENDER_NATAL" }),
    })
      .then((r) => r.json())
      .then((d) => setChartUrl(d.url || null))
      .catch(() => setChartUrl(null))
      .finally(() => setLoading(false));
  }, [isOpen, birthData]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!chartUrl) return;
    const a = document.createElement("a");
    a.href = chartUrl;
    a.download = "astroyou-natal-chart.png";
    a.click();
  };

  const handleCopy = async () => {
    if (!chartUrl) return;
    await navigator.clipboard.writeText(chartUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    if (!chartUrl) return;
    window.open(`https://wa.me/?text=Check+out+my+birth+chart!+${encodeURIComponent(chartUrl)}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0a0a0f] border border-white/10 rounded-[2rem] p-6 w-full max-w-md mx-4 relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors">
          <X size={20} />
        </button>
        <h3 className="text-xl font-display text-white mb-4">Share Your Chart</h3>

        {loading ? (
          <div className="h-48 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
          </div>
        ) : chartUrl ? (
          <img src={chartUrl} alt="Natal Chart" className="w-full rounded-xl mb-4 border border-white/5" />
        ) : (
          <div className="h-48 flex items-center justify-center text-white/40 text-sm">Chart unavailable</div>
        )}

        <div className="flex gap-3">
          <button onClick={handleDownload} disabled={!chartUrl} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-30">
            <Download size={16} /> Download
          </button>
          <button onClick={handleWhatsApp} disabled={!chartUrl} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-30">
            <Share2 size={16} /> WhatsApp
          </button>
          <button onClick={handleCopy} disabled={!chartUrl} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-30">
            <Copy size={16} /> {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>
      </div>
    </div>
  );
}
