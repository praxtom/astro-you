import { useNavigate } from "react-router-dom";
import { Lock, ArrowRight } from "lucide-react";

export function UpgradePrompt({
  feature,
  tier = "premium",
}: {
  feature: string;
  tier?: string;
}) {
  const navigate = useNavigate();
  return (
    <div className="p-6 rounded-[2rem] bg-gold/5 border border-gold/20 text-center">
      <Lock size={24} className="text-gold mx-auto mb-3" />
      <p className="text-white/80 text-sm mb-1">
        {feature} requires {tier}
      </p>
      <p className="text-white/40 text-xs mb-4">
        Upgrade to unlock this feature
      </p>
      <button
        onClick={() => navigate("/pricing")}
        className="px-5 py-2.5 rounded-xl bg-gold text-black font-bold text-xs uppercase tracking-widest flex items-center gap-2 mx-auto"
      >
        View Plans <ArrowRight size={14} />
      </button>
    </div>
  );
}
