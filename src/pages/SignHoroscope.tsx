import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, ArrowLeft } from "lucide-react";

const SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
];
const SIGN_EMOJIS: Record<string, string> = {
  Aries: "\u2648",
  Taurus: "\u2649",
  Gemini: "\u264A",
  Cancer: "\u264B",
  Leo: "\u264C",
  Virgo: "\u264D",
  Libra: "\u264E",
  Scorpio: "\u264F",
  Sagittarius: "\u2650",
  Capricorn: "\u2651",
  Aquarius: "\u2652",
  Pisces: "\u2653",
};
const PERIODS = ["daily", "weekly", "monthly", "yearly"];

export default function SignHoroscope() {
  const { sign = "aries", period = "daily" } = useParams();
  const signName = sign.charAt(0).toUpperCase() + sign.slice(1);
  const [horoscope, setHoroscope] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/sign-horoscope", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sign: signName, period }),
    })
      .then((r) => r.json())
      .then((d) => {
        setHoroscope(d.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sign, period]);

  // Set page title for SEO
  useEffect(() => {
    document.title = `${signName} ${period.charAt(0).toUpperCase() + period.slice(1)} Horoscope | AstroYou`;
  }, [signName, period]);

  return (
    <div className="min-h-screen bg-[#030308] text-white p-6">
      <div className="max-w-2xl mx-auto pt-8">
        <Link
          to="/free-kundali"
          className="flex items-center gap-2 text-white/40 hover:text-white mb-8 text-sm"
        >
          <ArrowLeft size={16} /> Free Kundali
        </Link>

        <div className="text-center mb-8">
          <span className="text-5xl">{SIGN_EMOJIS[signName] || ""}</span>
          <h1 className="text-3xl font-display mt-4">
            {signName} {period.charAt(0).toUpperCase() + period.slice(1)}{" "}
            Horoscope
          </h1>
          <p className="text-white/40 text-sm mt-2">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {/* Period tabs */}
        <div className="flex gap-2 justify-center mb-8">
          {PERIODS.map((p) => (
            <Link
              key={p}
              to={`/horoscope/${sign}/${p}`}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                period === p
                  ? "bg-gold/10 border-gold/50 text-gold border"
                  : "bg-white/5 border-white/10 text-white/40 border hover:border-white/30"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={32} className="animate-spin text-white/30" />
          </div>
        ) : horoscope ? (
          <div className="glass rounded-[2rem] p-8">
            <p className="text-lg text-white/80 leading-relaxed font-light">
              {typeof horoscope === "string"
                ? horoscope
                : horoscope.text ||
                  horoscope.horoscope ||
                  horoscope.prediction ||
                  JSON.stringify(horoscope)}
            </p>
          </div>
        ) : (
          <p className="text-white/40 text-center py-16">
            Horoscope data unavailable. Try again later.
          </p>
        )}

        {/* Other signs */}
        <div className="mt-12">
          <h2 className="text-xs text-white/30 uppercase tracking-widest text-center mb-4">
            Other Signs
          </h2>
          <div className="flex flex-wrap gap-2 justify-center">
            {SIGNS.filter((s) => s.toLowerCase() !== sign).map((s) => (
              <Link
                key={s}
                to={`/horoscope/${s.toLowerCase()}/${period}`}
                className="px-3 py-1.5 rounded-lg bg-white/5 text-white/40 text-xs hover:text-gold hover:border-gold/30 border border-white/10 transition-all"
              >
                {SIGN_EMOJIS[s]} {s}
              </Link>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <p className="text-white/40 text-sm mb-4">
            Want personalized predictions based on YOUR birth chart?
          </p>
          <Link
            to="/free-kundali"
            className="inline-block px-6 py-3 rounded-xl bg-gold text-black font-bold text-sm"
          >
            Get Free Kundali
          </Link>
        </div>
      </div>
    </div>
  );
}
