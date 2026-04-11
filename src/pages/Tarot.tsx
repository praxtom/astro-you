import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, RotateCw, Send } from "lucide-react";

interface TarotCard {
  name: string;
  meaning: string;
  reversed_meaning?: string;
  image?: string;
  emoji?: string;
  position?: string;
  interpretation?: string;
}

export default function Tarot() {
  const navigate = useNavigate();
  const [dailyCard, setDailyCard] = useState<TarotCard | null>(null);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [dailyError, setDailyError] = useState<string | null>(null);

  const [question, setQuestion] = useState("");
  const [threeCards, setThreeCards] = useState<TarotCard[]>([]);
  const [readingLoading, setReadingLoading] = useState(false);
  const [readingError, setReadingError] = useState<string | null>(null);
  const [readingInterpretation, setReadingInterpretation] = useState<string | null>(null);
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());

  // Fetch daily card
  useEffect(() => {
    const fetchDaily = async () => {
      try {
        setDailyLoading(true);
        setDailyError(null);
        const res = await fetch("/api/kundali", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chartType: "DAILY_TAROT" }),
        });
        const data = await res.json();
        const raw = data.data || data;
        setDailyCard({
          name: raw.name || raw.card_name || raw.card || "The Star",
          meaning: raw.meaning || raw.upright_meaning || raw.description || "",
          reversed_meaning: raw.reversed_meaning || raw.reversed || "",
          image: raw.image || raw.image_url || "",
          emoji: raw.emoji || raw.symbol || "",
        });
      } catch (err) {
        console.error("Daily tarot error:", err);
        setDailyError("Could not draw your daily card.");
      } finally {
        setDailyLoading(false);
      }
    };
    fetchDaily();
  }, []);

  const handleDrawThreeCards = async () => {
    try {
      setReadingLoading(true);
      setReadingError(null);
      setThreeCards([]);
      setFlippedCards(new Set());
      setReadingInterpretation(null);

      const res = await fetch("/api/kundali", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chartType: "TAROT_THREE",
          question: question || "What does the universe want me to know today?",
        }),
      });
      const data = await res.json();
      const raw = data.data || data;

      // Parse cards - handle various response shapes
      const cards: TarotCard[] = [];
      const positions = ["Past", "Present", "Future"];

      if (Array.isArray(raw.cards)) {
        raw.cards.forEach((c: any, i: number) => {
          cards.push({
            name: c.name || c.card_name || c.card || `Card ${i + 1}`,
            meaning: c.meaning || c.upright_meaning || c.description || "",
            reversed_meaning: c.reversed_meaning || c.reversed || "",
            position: c.position || positions[i],
            interpretation: c.interpretation || c.reading || "",
            emoji: c.emoji || c.symbol || "",
          });
        });
      } else if (raw.past && raw.present && raw.future) {
        for (const [pos, key] of [["Past", "past"], ["Present", "present"], ["Future", "future"]] as const) {
          const c = raw[key];
          cards.push({
            name: typeof c === "string" ? c : c.name || c.card_name || pos,
            meaning: typeof c === "object" ? c.meaning || c.description || "" : "",
            reversed_meaning: typeof c === "object" ? c.reversed_meaning || "" : "",
            position: pos,
            interpretation: typeof c === "object" ? c.interpretation || "" : "",
            emoji: typeof c === "object" ? c.emoji || "" : "",
          });
        }
      }

      // Fallback
      if (cards.length === 0) {
        cards.push(
          { name: "Card 1", meaning: "Interpretation unavailable", position: "Past" },
          { name: "Card 2", meaning: "Interpretation unavailable", position: "Present" },
          { name: "Card 3", meaning: "Interpretation unavailable", position: "Future" },
        );
      }

      setThreeCards(cards);
      setReadingInterpretation(raw.interpretation || raw.reading || raw.summary || null);

      // Flip cards one by one
      for (let i = 0; i < cards.length; i++) {
        await new Promise((r) => setTimeout(r, 400));
        setFlippedCards((prev) => new Set(prev).add(i));
      }
    } catch (err) {
      console.error("Three card reading error:", err);
      setReadingError("Could not draw cards. Please try again.");
    } finally {
      setReadingLoading(false);
    }
  };

  const arcanaEmojis: Record<string, string> = {
    "The Fool": "🃏", "The Magician": "🎩", "The High Priestess": "🌙",
    "The Empress": "👑", "The Emperor": "🏰", "The Hierophant": "📿",
    "The Lovers": "💕", "The Chariot": "🏇", "Strength": "🦁",
    "The Hermit": "🏔️", "Wheel of Fortune": "🎡", "Justice": "⚖️",
    "The Hanged Man": "🔮", "Death": "🦋", "Temperance": "🌊",
    "The Devil": "🔥", "The Tower": "⚡", "The Star": "⭐",
    "The Moon": "🌕", "The Sun": "☀️", "Judgement": "📯",
    "The World": "🌍",
  };

  const getCardEmoji = (card: TarotCard) => {
    if (card.emoji) return card.emoji;
    return arcanaEmojis[card.name] || "🂡";
  };

  const positionColors: Record<string, string> = {
    Past: "from-blue-500/20 to-blue-900/10 border-blue-500/30",
    Present: "from-violet-500/20 to-violet-900/10 border-violet-500/30",
    Future: "from-amber-500/20 to-amber-900/10 border-amber-500/30",
  };

  return (
    <div className="min-h-screen bg-bg-app text-white selection:bg-violet-500/30">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 right-1/4 w-[35vw] h-[35vw] bg-indigo-600/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-1/4 left-1/3 w-[25vw] h-[25vw] bg-amber-600/3 blur-[100px] rounded-full" />
      </div>

      <div className="container mx-auto pt-8 px-6 pb-12 relative z-10">
        {/* Back button */}
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-8 group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm">Dashboard</span>
        </button>

        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
          <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400">
            <Sparkles size={28} />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-display tracking-wider">Tarot</h1>
            <p className="text-white/40 text-sm mt-1">Messages from the cosmic deck</p>
          </div>
        </div>

        {/* Daily Card Section */}
        <section className="mb-12">
          <h2 className="text-lg uppercase tracking-widest text-white/40 font-bold mb-5">Daily Card</h2>
          {dailyLoading ? (
            <div className="glass rounded-2xl p-10 text-center">
              <div className="h-24 w-20 bg-white/5 rounded-xl animate-pulse mx-auto mb-4" />
              <div className="h-5 bg-white/5 rounded animate-pulse w-32 mx-auto mb-2" />
              <div className="h-4 bg-white/5 rounded animate-pulse w-64 mx-auto" />
            </div>
          ) : dailyError ? (
            <div className="glass rounded-2xl p-8 text-center">
              <p className="text-red-400 mb-3">{dailyError}</p>
              <button
                onClick={() => window.location.reload()}
                className="text-sm text-white/50 hover:text-white transition-colors"
              >
                Try again
              </button>
            </div>
          ) : dailyCard ? (
            <div className="glass rounded-2xl p-10 text-center max-w-lg mx-auto">
              <div className="text-7xl mb-5">{getCardEmoji(dailyCard)}</div>
              <h3 className="text-2xl font-display tracking-wider mb-4 text-white">
                {dailyCard.name}
              </h3>
              {dailyCard.meaning && (
                <div className="mb-4">
                  <p className="text-xs uppercase tracking-widest text-white/30 mb-1">Upright</p>
                  <p className="text-white/70 leading-relaxed">{dailyCard.meaning}</p>
                </div>
              )}
              {dailyCard.reversed_meaning && (
                <div>
                  <p className="text-xs uppercase tracking-widest text-white/30 mb-1">Reversed</p>
                  <p className="text-white/50 leading-relaxed italic">{dailyCard.reversed_meaning}</p>
                </div>
              )}
            </div>
          ) : null}
        </section>

        {/* Three Card Reading Section */}
        <section>
          <h2 className="text-lg uppercase tracking-widest text-white/40 font-bold mb-5">Get a Reading</h2>

          {/* Question input */}
          <div className="glass rounded-2xl p-6 mb-6">
            <label className="text-sm text-white/50 block mb-2">Ask a question (optional)</label>
            <div className="flex gap-3">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What does the universe want me to know?"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 transition-colors"
                onKeyDown={(e) => e.key === "Enter" && !readingLoading && handleDrawThreeCards()}
              />
              <button
                onClick={handleDrawThreeCards}
                disabled={readingLoading}
                className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {readingLoading ? (
                  <RotateCw size={18} className="animate-spin" />
                ) : (
                  <Send size={18} />
                )}
                <span className="hidden sm:inline">Draw 3 Cards</span>
              </button>
            </div>
          </div>

          {/* Reading error */}
          {readingError && (
            <div className="glass rounded-2xl p-6 mb-6 border border-red-500/20 text-center">
              <p className="text-red-400">{readingError}</p>
            </div>
          )}

          {/* Three cards display */}
          {threeCards.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {threeCards.map((card, idx) => {
                const isFlipped = flippedCards.has(idx);
                const posColor = positionColors[card.position || "Present"] || positionColors.Present;
                return (
                  <div
                    key={idx}
                    className={`relative rounded-2xl border p-8 text-center bg-gradient-to-b ${posColor} backdrop-blur-sm transition-all duration-500 ${
                      isFlipped ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                    }`}
                  >
                    <p className="text-xs uppercase tracking-widest text-white/40 mb-3">
                      {card.position}
                    </p>
                    <div className="text-5xl mb-4">{getCardEmoji(card)}</div>
                    <h3 className="text-lg font-display tracking-wider mb-3 text-white">
                      {card.name}
                    </h3>
                    {card.meaning && (
                      <p className="text-sm text-white/60 leading-relaxed mb-2">{card.meaning}</p>
                    )}
                    {card.interpretation && (
                      <p className="text-sm text-white/50 italic mt-2">{card.interpretation}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Overall interpretation */}
          {readingInterpretation && (
            <div className="glass rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-4">
                <Sparkles size={18} className="text-indigo-400" />
                <h3 className="text-lg font-display tracking-wider">Reading Interpretation</h3>
              </div>
              <p className="text-white/70 leading-relaxed whitespace-pre-wrap">
                {readingInterpretation}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
