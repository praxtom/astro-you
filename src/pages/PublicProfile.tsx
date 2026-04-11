import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Star, Moon, Sun } from 'lucide-react';

export default function PublicProfile() {
    const { username } = useParams();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            const q = query(
                collection(db, "users"),
                where("profile.username", "==", username),
                where("profile.isPublic", "==", true)
            );
            const snap = await getDocs(q);
            if (snap.empty) {
                setNotFound(true);
                setLoading(false);
                return;
            }
            const data = snap.docs[0].data();
            setProfile(data.profile);
            setLoading(false);
        };
        if (username) fetchProfile();
    }, [username]);

    if (loading) return (
        <div className="min-h-screen bg-[#030308] flex items-center justify-center text-white/40">
            Loading...
        </div>
    );

    if (notFound) return (
        <div className="min-h-screen bg-[#030308] flex flex-col items-center justify-center text-white">
            <p className="text-2xl font-display mb-4">Profile not found</p>
            <Link to="/" className="text-gold hover:underline">Go home</Link>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#030308] text-white p-6">
            <div className="max-w-lg mx-auto pt-20">
                <div className="glass rounded-[2rem] p-8 text-center">
                    <div className="w-20 h-20 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">{profile.name?.[0]?.toUpperCase() || '?'}</span>
                    </div>
                    <h1 className="text-2xl font-display">{profile.name}</h1>
                    <p className="text-white/40 text-sm">@{profile.username}</p>
                    {profile.bio && <p className="text-white/60 text-sm mt-3">{profile.bio}</p>}

                    <div className="grid grid-cols-3 gap-4 mt-8">
                        {profile.moonSign && (
                            <div className="p-3 rounded-xl bg-white/5">
                                <Moon size={16} className="text-white/40 mx-auto mb-1" />
                                <p className="text-xs text-white/40">Moon</p>
                                <p className="text-sm text-white/80">{profile.moonSign}</p>
                            </div>
                        )}
                        {profile.sunSign && (
                            <div className="p-3 rounded-xl bg-white/5">
                                <Sun size={16} className="text-amber-400 mx-auto mb-1" />
                                <p className="text-xs text-white/40">Sun</p>
                                <p className="text-sm text-white/80">{profile.sunSign}</p>
                            </div>
                        )}
                        {profile.ascendant && (
                            <div className="p-3 rounded-xl bg-white/5">
                                <Star size={16} className="text-gold mx-auto mb-1" />
                                <p className="text-xs text-white/40">Rising</p>
                                <p className="text-sm text-white/80">
                                    {typeof profile.ascendant === 'string'
                                        ? profile.ascendant
                                        : profile.ascendant.sign}
                                </p>
                            </div>
                        )}
                    </div>

                    <Link
                        to="/free-kundali"
                        className="inline-block mt-8 px-6 py-3 rounded-xl bg-gold text-black font-bold text-sm"
                    >
                        Get Your Free Chart
                    </Link>
                </div>
            </div>
        </div>
    );
}
