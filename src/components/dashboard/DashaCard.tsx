import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { useUserProfile } from '../../hooks';

interface DashaPeriod {
  planet: string;
  endDate: string;
  isCurrent?: boolean;
  subPeriods?: DashaPeriod[];
}

export function DashaCard() {
  const { profile } = useUserProfile();
  const [maha, setMaha] = useState<DashaPeriod | null>(null);
  const [antar, setAntar] = useState<DashaPeriod | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.dob || !profile?.tob) { setLoading(false); return; }
    const birthData = {
      dob: profile.dob, tob: profile.tob,
      pob: profile.pob || "Unknown",
      lat: profile.coordinates?.lat, lng: profile.coordinates?.lng,
    };
    fetch('/api/kundali', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ birthData, chartType: 'DASHAS' }),
    })
      .then(r => r.json())
      .then(res => {
        const periods: DashaPeriod[] = res.periods || res.data?.periods || res || [];
        if (!Array.isArray(periods)) { setLoading(false); return; }
        const current = periods.find(p => p.isCurrent);
        if (current) {
          setMaha(current);
          const sub = current.subPeriods?.find(s => s.isCurrent);
          if (sub) setAntar(sub);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [profile]);

  const timeLeft = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - Date.now();
    if (diff <= 0) return 'ended';
    const days = Math.floor(diff / 86400000);
    if (days > 365) return `${Math.floor(days / 365)}y ${Math.floor((days % 365) / 30)}m left`;
    if (days > 30) return `${Math.floor(days / 30)}m ${days % 30}d left`;
    return `${days}d left`;
  };

  if (loading) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-[2rem] p-5 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-28 mb-4" />
        <div className="h-3 bg-white/5 rounded w-40 mb-2" />
        <div className="h-3 bg-white/5 rounded w-36" />
      </div>
    );
  }

  if (!maha) return null;

  return (
    <div className="bg-white/5 border border-white/10 rounded-[2rem] p-5">
      <div className="flex items-center gap-2 mb-4">
        <Clock size={16} className="text-gold" />
        <h4 className="text-sm font-bold uppercase tracking-widest text-gold">Current Dasha</h4>
      </div>
      <div className="space-y-3">
        <div>
          <p className="text-white/90 text-sm font-medium">Mahadasha: {maha.planet}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-white/40 text-xs">ends {new Date(maha.endDate).toLocaleDateString()}</span>
            <span className="text-amber-400 text-xs">{timeLeft(maha.endDate)}</span>
          </div>
        </div>
        {antar && (
          <div>
            <p className="text-white/90 text-sm font-medium">Antardasha: {antar.planet}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-white/40 text-xs">ends {new Date(antar.endDate).toLocaleDateString()}</span>
              <span className="text-amber-400 text-xs">{timeLeft(antar.endDate)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
