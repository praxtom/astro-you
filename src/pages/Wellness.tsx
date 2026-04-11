import { useState, useEffect } from 'react';
import { useUserProfile } from '../hooks';
import { Heart, Loader2, Activity, Zap, Brain, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';

export default function Wellness() {
    const navigate = useNavigate();
    const { birthData, loading: profileLoading } = useUserProfile();
    const [biorhythms, setBiorhythms] = useState<any>(null);
    const [wellnessScore, setWellnessScore] = useState<any>(null);
    const [energy, setEnergy] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!birthData?.dob) return;
        const controller = new AbortController();
        setLoading(true);
        Promise.all([
            fetch('/api/kundali', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ birthData, chartType: 'BIORHYTHMS' }), signal: controller.signal }).then(r => r.json()).catch(() => null),
            fetch('/api/kundali', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ birthData, chartType: 'WELLNESS_SCORE' }), signal: controller.signal }).then(r => r.json()).catch(() => null),
            fetch('/api/kundali', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ birthData, chartType: 'ENERGY_PATTERNS' }), signal: controller.signal }).then(r => r.json()).catch(() => null),
        ]).then(([bio, well, eng]) => {
            setBiorhythms(bio?.data);
            setWellnessScore(well?.data);
            setEnergy(eng?.data);
            setLoading(false);
        });
        return () => controller.abort();
    }, [birthData?.dob]);

    return (
        <div className="min-h-screen bg-[#030308] text-white">
            <Header />
            <main className="container mx-auto pt-24 px-6 pb-12">
                <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-white/40 hover:text-white mb-6 text-sm">
                    <ArrowLeft size={16} /> Back
                </button>
                <h1 className="text-3xl md:text-4xl font-display mb-2">Wellness & Biorhythms</h1>
                <p className="text-white/50 mb-8">Your cosmic energy cycles and health insights</p>

                {loading ? (
                    <div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-white/30" /></div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Biorhythm Cycles */}
                        <div className="glass rounded-[2rem] p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Activity size={18} className="text-gold" />
                                <h2 className="text-gold text-sm font-bold uppercase tracking-widest">Biorhythm Cycles</h2>
                            </div>
                            {biorhythms ? (
                                <div className="space-y-4">
                                    {[
                                        { label: 'Physical', key: 'physical', color: 'bg-red-400', icon: <Heart size={14} /> },
                                        { label: 'Emotional', key: 'emotional', color: 'bg-blue-400', icon: <Heart size={14} /> },
                                        { label: 'Intellectual', key: 'intellectual', color: 'bg-emerald-400', icon: <Brain size={14} /> },
                                    ].map(cycle => {
                                        const val = biorhythms[cycle.key] ?? biorhythms[`${cycle.key}_cycle`] ?? 0;
                                        const pct = typeof val === 'number' ? Math.round((val + 100) / 2) : 50;
                                        return (
                                            <div key={cycle.key}>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs text-white/60 flex items-center gap-1">{cycle.icon} {cycle.label}</span>
                                                    <span className="text-xs text-white/40 font-mono">{typeof val === 'number' ? val.toFixed(0) : val}%</span>
                                                </div>
                                                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full ${cycle.color}`} style={{ width: `${pct}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : <p className="text-white/40 text-sm">Biorhythm data unavailable</p>}
                        </div>

                        {/* Wellness Score */}
                        <div className="glass rounded-[2rem] p-6 text-center">
                            <Zap size={18} className="text-gold mx-auto mb-3" />
                            <h2 className="text-gold text-sm font-bold uppercase tracking-widest mb-4">Wellness Score</h2>
                            {wellnessScore ? (
                                <>
                                    <div className="text-5xl font-display text-white mb-2">
                                        {wellnessScore.score ?? wellnessScore.overall_score ?? '\u2014'}
                                    </div>
                                    <p className="text-white/40 text-sm">{wellnessScore.interpretation || wellnessScore.description || 'Overall cosmic wellness'}</p>
                                </>
                            ) : <p className="text-white/40 text-sm">Score unavailable</p>}
                        </div>

                        {/* Energy Patterns */}
                        <div className="glass rounded-[2rem] p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Zap size={18} className="text-gold" />
                                <h2 className="text-gold text-sm font-bold uppercase tracking-widest">Energy Patterns</h2>
                            </div>
                            {energy ? (
                                <div className="space-y-3">
                                    {(energy.patterns || energy.periods || []).slice(0, 6).map((p: any, i: number) => (
                                        <div key={i} className="flex items-start gap-2 py-1.5 border-b border-white/5 last:border-0">
                                            <span className="text-amber-400 text-xs min-w-[60px]">{p.time || p.period}</span>
                                            <p className="text-white/60 text-xs">{p.description || p.energy_level || p.advice}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-white/40 text-sm">Energy data unavailable</p>}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
