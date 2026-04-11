import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  Users,
  CreditCard,
  TrendingUp,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import Header from "../components/layout/Header";

// Admin emails — move to env var or Firestore later
const ADMIN_EMAILS = ["prax.flash@gmail.com"];

interface Stats {
  totalUsers: number;
  premiumUsers: number;
  proUsers: number;
  totalChats: number;
  totalCreditsUsed: number;
  recentUsers: any[];
}

export default function Admin() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  // Auth check
  useEffect(() => {
    if (user && !ADMIN_EMAILS.includes(user.email || "")) {
      navigate("/dashboard");
    }
  }, [user]);

  // Fetch stats
  useEffect(() => {
    if (!user || !ADMIN_EMAILS.includes(user.email || "")) return;

    const fetchStats = async () => {
      try {
        // Get all users
        const usersSnap = await getDocs(collection(db, "users"));
        const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const premiumUsers = users.filter(
          (u: any) => u.subscription?.tier === "premium",
        ).length;
        const proUsers = users.filter(
          (u: any) => u.subscription?.tier === "pro",
        ).length;
        const totalCreditsUsed = users.reduce(
          (sum: number, u: any) => sum + (15 - (u.credits || 0)),
          0,
        );

        // Recent users (last 10 by updatedAt)
        const recentSnap = await getDocs(
          query(
            collection(db, "users"),
            orderBy("updatedAt", "desc"),
            limit(10),
          ),
        );
        const recentUsers = recentSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        setStats({
          totalUsers: users.length,
          premiumUsers,
          proUsers,
          totalChats: 0, // Would need to count sub-collections
          totalCreditsUsed: Math.max(0, totalCreditsUsed),
          recentUsers,
        });
      } catch (err) {
        console.error("Admin fetch error:", err);
      }
      setLoading(false);
    };
    fetchStats();
  }, [user]);

  if (!user || !ADMIN_EMAILS.includes(user.email || "")) return null;

  return (
    <div className="min-h-screen bg-[#030308] text-white">
      <Header />
      <main className="container mx-auto pt-24 px-6 pb-16">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 text-white/40 hover:text-white mb-6 text-sm"
        >
          <ArrowLeft size={16} /> Dashboard
        </button>
        <h1 className="text-3xl font-display mb-8">Admin Dashboard</h1>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-white/30" />
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
                  label="Credits Used"
                  value={stats.totalCreditsUsed}
                />
              </div>

              {/* Conversion */}
              <div className="glass rounded-[2rem] p-6 mb-6">
                <h2 className="text-gold text-sm font-bold uppercase tracking-widest mb-4">
                  Conversion
                </h2>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-3xl font-display">
                      {stats.totalUsers > 0
                        ? (
                            ((stats.premiumUsers + stats.proUsers) /
                              stats.totalUsers) *
                            100
                          ).toFixed(1)
                        : 0}
                      %
                    </p>
                    <p className="text-xs text-white/40">Paid conversion</p>
                  </div>
                  <div>
                    <p className="text-3xl font-display">
                      {stats.premiumUsers * 499 + stats.proUsers * 999}
                    </p>
                    <p className="text-xs text-white/40">MRR</p>
                  </div>
                  <div>
                    <p className="text-3xl font-display">
                      {stats.premiumUsers + stats.proUsers}
                    </p>
                    <p className="text-xs text-white/40">Paying users</p>
                  </div>
                </div>
              </div>

              {/* Recent Users */}
              <div className="glass rounded-[2rem] p-6">
                <h2 className="text-gold text-sm font-bold uppercase tracking-widest mb-4">
                  Recent Users
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-white/40 text-xs uppercase tracking-widest border-b border-white/10">
                        <th className="text-left py-2 px-2">Name</th>
                        <th className="text-left py-2 px-2">Email</th>
                        <th className="text-center py-2 px-2">Tier</th>
                        <th className="text-right py-2 px-2">Credits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentUsers.map((u: any) => (
                        <tr key={u.id} className="border-b border-white/5">
                          <td className="py-2 px-2 text-white/80">
                            {u.profile?.name || "\u2014"}
                          </td>
                          <td className="py-2 px-2 text-white/60">
                            {u.email || "\u2014"}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                u.subscription?.tier === "pro"
                                  ? "bg-gold/20 text-gold"
                                  : u.subscription?.tier === "premium"
                                    ? "bg-amber-500/20 text-amber-400"
                                    : "bg-white/10 text-white/40"
                              }`}
                            >
                              {u.subscription?.tier || "free"}
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
            </>
          )
        )}
      </main>
    </div>
  );
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
    <div className="glass rounded-2xl p-5">
      <div className="text-gold mb-2">{icon}</div>
      <p className={`text-2xl font-display ${color}`}>
        {value.toLocaleString()}
      </p>
      <p className="text-xs text-white/40 mt-1">{label}</p>
    </div>
  );
}
