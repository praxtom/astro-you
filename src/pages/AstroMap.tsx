import { useState, useEffect } from 'react';
import { useUserProfile } from '../hooks';
import { MapPin, Globe, Loader2, Star, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';

export default function AstroMap() {
    const navigate = useNavigate();
    const { birthData, loading: profileLoading } = useUserProfile();
    const [powerZones, setPowerZones] = useState<any>(null);
    const [lines, setLines] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [locationQuery, setLocationQuery] = useState('');
    const [locationAnalysis, setLocationAnalysis] = useState<any>(null);
    const [analyzingLocation, setAnalyzingLocation] = useState(false);

    // Fetch power zones + lines on mount
    useEffect(() => {
        if (!birthData?.dob) return;
        const fetchData = async () => {
            setLoading(true);
            const [zonesRes, linesRes] = await Promise.all([
                fetch('/api/kundali', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ birthData, chartType: 'POWER_ZONES' }) }).then(r => r.json()).catch(() => null),
                fetch('/api/kundali', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ birthData, chartType: 'ASTRO_LINES' }) }).then(r => r.json()).catch(() => null),
            ]);
            setPowerZones(zonesRes?.data);
            setLines(linesRes?.data);
            setLoading(false);
        };
        fetchData();
    }, [birthData?.dob]);

    const analyzeLocation = async () => {
        if (!locationQuery.trim() || !birthData) return;
        setAnalyzingLocation(true);
        // Use Nominatim to geocode, then analyze
        try {
            const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationQuery)}&limit=1`);
            const [geo] = await geoRes.json();
            if (!geo) { setAnalyzingLocation(false); return; }

            const res = await fetch('/api/kundali', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ birthData, chartType: 'LOCATION_ANALYSIS', targetLat: parseFloat(geo.lat), targetLng: parseFloat(geo.lon) })
            });
            const data = await res.json();
            setLocationAnalysis({ city: locationQuery, ...data.data });
        } catch {}
        setAnalyzingLocation(false);
    };

    return (
        <div className="min-h-screen bg-[#030308] text-white">
            <Header />
            <main className="container mx-auto pt-24 px-6 pb-12">
                <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-white/40 hover:text-white mb-6 text-sm">
                    <ArrowLeft size={16} /> Back
                </button>

                <h1 className="text-3xl md:text-4xl font-display mb-2">Astrocartography</h1>
                <p className="text-white/50 mb-8">Discover where on Earth your stars shine brightest</p>

                {/* Location Search */}
                <div className="flex gap-3 mb-8 max-w-lg">
                    <input value={locationQuery} onChange={e => setLocationQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && analyzeLocation()}
                        placeholder="Search a city (e.g., London, Tokyo, New York)"
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold/50" />
                    <button onClick={analyzeLocation} disabled={analyzingLocation}
                        className="px-5 py-3 rounded-xl bg-gold text-black font-bold text-sm disabled:opacity-50">
                        {analyzingLocation ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
                    </button>
                </div>

                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 size={32} className="animate-spin text-white/30" />
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Power Zones */}
                    {powerZones && (
                        <div className="glass rounded-[2rem] p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Star size={18} className="text-gold" />
                                <h2 className="text-gold text-sm font-bold uppercase tracking-widest">Your Power Zones</h2>
                            </div>
                            <div className="space-y-3">
                                {(powerZones.zones || powerZones.power_zones || []).slice(0, 8).map((zone: any, i: number) => (
                                    <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/10">
                                        <div className="flex items-center justify-between">
                                            <span className="text-white/90 text-sm font-medium">{zone.location || zone.city || zone.name}</span>
                                            {zone.score && <span className="text-gold text-xs font-bold">{zone.score}%</span>}
                                        </div>
                                        {zone.description && <p className="text-white/50 text-xs mt-1">{zone.description}</p>}
                                        {zone.themes && <p className="text-white/30 text-[10px] mt-1">{Array.isArray(zone.themes) ? zone.themes.join(' · ') : zone.themes}</p>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Planetary Lines */}
                    {lines && (
                        <div className="glass rounded-[2rem] p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Globe size={18} className="text-gold" />
                                <h2 className="text-gold text-sm font-bold uppercase tracking-widest">Planetary Lines</h2>
                            </div>
                            <div className="space-y-2">
                                {(lines.lines || []).slice(0, 10).map((line: any, i: number) => (
                                    <div key={i} className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
                                        <span className="text-amber-400 text-sm font-medium min-w-[80px]">{line.planet}</span>
                                        <span className="text-white/40 text-xs min-w-[30px]">{line.type || line.angle}</span>
                                        <p className="text-white/60 text-xs flex-1">{line.meaning || line.description || ''}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Location Analysis Result */}
                {locationAnalysis && (
                    <div className="mt-8 glass rounded-[2rem] p-6">
                        <h2 className="text-gold text-sm font-bold uppercase tracking-widest mb-4">
                            Analysis: {locationAnalysis.city}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(locationAnalysis.influences || locationAnalysis.aspects || []).map((inf: any, i: number) => (
                                <div key={i} className="p-3 rounded-xl bg-white/5">
                                    <p className="text-white/90 text-sm font-medium">{inf.planet || inf.name}</p>
                                    <p className="text-white/50 text-xs mt-1">{inf.interpretation || inf.description}</p>
                                </div>
                            ))}
                        </div>
                        {locationAnalysis.overall && (
                            <p className="text-white/60 text-sm mt-4 italic">{locationAnalysis.overall}</p>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
