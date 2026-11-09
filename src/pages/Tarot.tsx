import { useState, useEffect } from "react";
import { postJson } from "../lib/apiFetch";
import { Sparkles, RotateCw, RotateCcw, Send } from "lucide-react";
import { StatusNotice } from "../components/ui/StatusNotice";
import { PageShell } from "../components/layout/PageShell";

interface TarotCard {
  name: string;
  meaning: string;
  reversed_meaning?: string;
  image?: string;
  emoji?: string;
  position?: string;
  interpretation?: string;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export default function Tarot() {
  const [dailyCard, setDailyCard] = useState<TarotCard | null>(null);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [dailyError, setDailyError] = useState<string | null>(null);

  const [question, setQuestion] = useState("");
  const [threeCards, setThreeCards] = useState<TarotCard[]>([]);
  const [readingLoading, setReadingLoading] = useState(false);
  const [readingError, setReadingError] = useState<string | null>(null);
  const [readingInterpretation, setReadingInterpretation] = useState<
    string | null
  >(null);
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());

  const [dailyAttempt, setDailyAttempt] = useState(0);

  // Fetch daily card
  useEffect(() => {
    const controller = new AbortController();
    const fetchDaily = async () => {
      try {
        setDailyLoading(true);
        setDailyError(null);
        const res = await postJson(
          "/api/kundali",
          { chartType: "DAILY_TAROT" },
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`Daily tarot failed: ${res.status}`);
        const data = await res.json();
        const raw = data?.data ?? data ?? {};
        const name = str(raw.name) || str(raw.card_name) || str(raw.card);
        if (!name) throw new Error("Daily tarot response had no card name");
        setDailyCard({
          name,
          meaning: str(raw.meaning) || str(raw.upright_meaning) || str(raw.description),
          reversed_meaning: str(raw.reversed_meaning) || str(raw.reversed),
          image: str(raw.image) || str(raw.image_url),
          emoji: str(raw.emoji) || str(raw.symbol),
        });
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.error("Daily tarot error:", err);
        setDailyCard(null);
        setDailyError("We couldn't draw today's card. Check your connection and try again.");
      } finally {
        if (!controller.signal.aborted) setDailyLoading(false);
      }
    };
    fetchDaily();
    return () => controller.abort();
  }, [dailyAttempt]);

  const handleDrawThreeCards = async () => {
    try {
      setReadingLoading(true);
      setReadingError(null);
      setThreeCards([]);
      setFlippedCards(new Set());
      setReadingInterpretation(null);

      const res = await postJson("/api/kundali", {
        chartType: "TAROT_THREE",
        question: question || "What does the universe want me to know today?",
      });
      if (!res.ok) throw new Error(`Three card reading failed: ${res.status}`);
      const data = await res.json();
      const raw = data?.data ?? data ?? {};

      // Parse cards - handle various response shapes
      const cards: TarotCard[] = [];
      const positions = ["Past", "Present", "Future"];

      if (Array.isArray(raw.cards)) {
        raw.cards.forEach((c: any, i: number) => {
          cards.push({
            name: str(c?.name) || str(c?.card_name) || str(c?.card),
            meaning: str(c?.meaning) || str(c?.upright_meaning) || str(c?.description),
            reversed_meaning: str(c?.reversed_meaning) || str(c?.reversed),
            position: str(c?.position) || positions[i],
            interpretation: str(c?.interpretation) || str(c?.reading),
            emoji: str(c?.emoji) || str(c?.symbol),
          });
        });
      } else if (raw.past && raw.present && raw.future) {
        for (const [pos, key] of [
          ["Past", "past"],
          ["Present", "present"],
          ["Future", "future"],
        ] as const) {
          const c = raw[key];
          cards.push({
            name: typeof c === "string" ? c : str(c?.name) || str(c?.card_name),
            meaning:
              typeof c === "object" ? c.meaning || c.description || "" : "",
            reversed_meaning:
              typeof c === "object" ? c.reversed_meaning || "" : "",
            position: pos,
            interpretation: typeof c === "object" ? c.interpretation || "" : "",
            emoji: typeof c === "object" ? c.emoji || "" : "",
          });
        }
      }

      if (cards.length === 0 || cards.some((c) => !c.name)) {
        throw new Error("Three card reading response had no usable cards");
      }

      setThreeCards(cards);
      setReadingInterpretation(
        str(raw.interpretation) || str(raw.reading) || str(raw.summary) || null,
      );

      // Flip cards one by one
      for (let i = 0; i < cards.length; i++) {
        await new Promise((r) => setTimeout(r, 400));
        setFlippedCards((prev) => new Set(prev).add(i));
      }
    } catch (err) {
      console.error("Three card reading error:", err);
      setThreeCards([]);
      setReadingError("We couldn't draw your cards. Check your connection and try again.");
    } finally {
      setReadingLoading(false);
    }
  };

  const arcanaEmojis: Record<string, string> = {
    "The Fool": "🃏",
    "The Magician": "🎩",
    "The High Priestess": "🌙",
    "The Empress": "👑",
    "The Emperor": "🏰",
    "The Hierophant": "📿",
    "The Lovers": "💕",
    "The Chariot": "🏇",
    Strength: "🦁",
    "The Hermit": "🏔️",
    "Wheel of Fortune": "🎡",
    Justice: "⚖️",
    "The Hanged Man": "🔮",
    Death: "🦋",
    Temperance: "🌊",
    "The Devil": "🔥",
    "The Tower": "⚡",
    "The Star": "⭐",
    "The Moon": "🌕",
    "The Sun": "☀️",
    Judgement: "📯",
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
    <PageShell>
      <div>
        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
          <div className="p-3 rounded-2xl bg-gold/10 text-gold">
            <Sparkles size={28} />
          </div>
          <div>
            <h1 className="type-page-title">
              Tarot
            </h1>
            <p className="text-white/55 text-sm mt-1">
              Messages from the cosmic deck
            </p>
          </div>
        </div>

        {/* Daily Card Section */}
        <section className="mb-12">
          <h2 className="text-lg uppercase tracking-widest text-white/55 font-bold mb-5">
            Daily Card
          </h2>
          {dailyLoading ? (
            <div className="glass rounded-2xl p-10 text-center">
              <div className="h-24 w-20 bg-white/5 rounded-xl animate-pulse mx-auto mb-4" />
              <div className="h-5 bg-white/5 rounded animate-pulse w-32 mx-auto mb-2" />
              <div className="h-4 bg-white/5 rounded animate-pulse w-64 mx-auto" />
            </div>
          ) : dailyError ? (
            <StatusNotice
              message={dailyError}
              onRetry={() => setDailyAttempt((n) => n + 1)}
            />
          ) : dailyCard ? (
            <div className="glass rounded-2xl p-10 text-center max-w-lg mx-auto">
              <div className="text-7xl mb-5">{getCardEmoji(dailyCard)}</div>
              <h3 className="text-2xl font-display tracking-wider mb-4 text-white">
                {dailyCard.name}
              </h3>
              {dailyCard.meaning && (
                <div className="mb-4">
                  <p className="text-xs uppercase tracking-widest text-white/55 mb-1">
                    Upright
                  </p>
                  <p className="text-white/70 leading-relaxed">
                    {dailyCard.meaning}
                  </p>
                </div>
              )}
              {dailyCard.reversed_meaning && (
                <div>
                  <p className="text-xs uppercase tracking-widest text-white/55 mb-1">
                    Reversed
                  </p>
                  <p className="text-white/50 leading-relaxed italic">
                    {dailyCard.reversed_meaning}
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </section>

        {/* Three Card Reading Section */}
        <section>
          <h2 className="text-lg uppercase tracking-widest text-white/55 font-bold mb-5">
            Get a Reading
          </h2>

          {/* Question input */}
          <div className="glass rounded-2xl p-6 mb-6">
            <label htmlFor="tarot-question" className="text-sm text-white/60 block mb-2">
              Ask a question (optional)
            </label>
            <div className="flex gap-3">
              <input
                id="tarot-question"
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What does the universe want me to know?"
                className="platform-field flex-1 w-auto text-white placeholder:text-white/40"
                onKeyDown={(e) =>
                  e.key === "Enter" && !readingLoading && handleDrawThreeCards()
                }
              />
              <button
                type="button"
                onClick={handleDrawThreeCards}
                disabled={readingLoading}
                aria-label="Draw 3 cards"
                className="px-6 py-3 rounded-xl bg-gold text-black font-semibold hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
            <StatusNotice
              className="mb-6"
              message={readingError}
              action={{
                label: "Try again",
                icon: RotateCcw,
                onClick: handleDrawThreeCards,
                disabled: readingLoading,
              }}
            />
          )}

          {/* Three cards display */}
          {threeCards.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {threeCards.map((card, idx) => {
                const isFlipped = flippedCards.has(idx);
                const posColor =
                  positionColors[card.position || "Present"] ||
                  positionColors.Present;
                return (
                  <div
                    key={idx}
                    className={`relative rounded-2xl border p-8 text-center bg-gradient-to-b ${posColor} backdrop-blur-sm transition-all duration-500 ${
                      isFlipped
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 translate-y-4"
                    }`}
                  >
                    <p className="text-xs uppercase tracking-widest text-white/55 mb-3">
                      {card.position}
                    </p>
                    <div className="text-5xl mb-4">{getCardEmoji(card)}</div>
                    <h3 className="text-lg font-display tracking-wider mb-3 text-white">
                      {card.name}
                    </h3>
                    {card.meaning && (
                      <p className="text-sm text-white/60 leading-relaxed mb-2">
                        {card.meaning}
                      </p>
                    )}
                    {card.interpretation && (
                      <p className="text-sm text-white/50 italic mt-2">
                        {card.interpretation}
                      </p>
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
                <Sparkles size={18} className="text-gold" />
                <h3 className="text-lg font-display tracking-wider">
                  Reading Interpretation
                </h3>
              </div>
              <p className="text-white/70 leading-relaxed whitespace-pre-wrap">
                {readingInterpretation}
              </p>
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}
