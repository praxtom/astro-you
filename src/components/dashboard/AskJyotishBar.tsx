import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { STORAGE_KEYS } from "../../lib/constants";
import type { LastChat } from "../../hooks/useLastChat";

interface AskJyotishBarProps {
  lastChat: LastChat | null;
}

const SUGGESTIONS = [
  "What does my current dasha ask of me?",
  "Why does this week feel heavy?",
  "When is a good time to start something new?",
  "What is my Moon trying to teach me?",
  "How do I work with my Saturn?",
];

/**
 * The dashboard's command line to Jyotish. Typing a question stashes it in
 * sessionStorage (STORAGE_KEYS.SYNTHESIS_DRAFT) and opens Synthesis, which
 * picks it up as the initial input.
 */
export const AskJyotishBar: React.FC<AskJyotishBarProps> = ({ lastChat }) => {
  const navigate = useNavigate();
  const [question, setQuestion] = useState("");
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const intervalRef = useRef<number | null>(null);

  // Rotate placeholder suggestions while the field is empty
  useEffect(() => {
    intervalRef.current = window.setInterval(
      () => setSuggestionIndex((i) => (i + 1) % SUGGESTIONS.length),
      5000,
    );
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, []);

  const ask = (text: string) => {
    const trimmed = text.trim();
    if (trimmed) {
      sessionStorage.setItem(STORAGE_KEYS.SYNTHESIS_DRAFT, trimmed);
    }
    navigate("/synthesis");
  };

  return (
    <section className="animate-reveal-progressive">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="group relative"
      >
        <div className="absolute -inset-px rounded-2xl bg-linear-to-r from-gold/0 via-gold/25 to-gold/0 opacity-0 group-focus-within:opacity-100 transition-opacity duration-700 blur-sm pointer-events-none" />
        <div className="relative flex items-center gap-3 rounded-2xl border border-white/10 bg-white/4 backdrop-blur-xl px-5 py-4 transition-colors group-focus-within:border-gold/40">
          <Sparkles size={18} className="text-gold shrink-0" />
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={`Ask Jyotish — “${SUGGESTIONS[suggestionIndex]}”`}
            aria-label="Ask Jyotish a question"
            className="flex-1 min-w-0 bg-transparent outline-none text-white/85 placeholder:text-white/30 text-sm md:text-base"
          />
          <button
            type="submit"
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gold text-black text-xs font-bold uppercase tracking-[0.15em] hover:bg-gold/90 transition-colors"
          >
            Ask
            <ArrowUpRight size={13} />
          </button>
        </div>
      </form>

      {lastChat && (
        <button
          onClick={() => navigate(`/synthesis/${lastChat.chatId}`)}
          className="mt-2.5 ml-1 text-xs text-white/35 hover:text-gold transition-colors inline-flex items-center gap-1.5"
        >
          <span className="w-1 h-1 rounded-full bg-gold/60" />
          Continue “
          {lastChat.title.length > 48
            ? lastChat.title.slice(0, 48) + "…"
            : lastChat.title}
          ”
        </button>
      )}
    </section>
  );
};
