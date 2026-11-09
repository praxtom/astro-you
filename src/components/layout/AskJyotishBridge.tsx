import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { STORAGE_KEYS } from "../../lib/constants";

interface AskJyotishBridgeProps {
  /** A prewritten question that seeds the Jyotish conversation. */
  question: string;
  /** Short label above the question, e.g. "Take this further". */
  eyebrow?: string;
  /**
   * Optional reading context handed to the chat alongside the question.
   * Written to sessionStorage under `storageKey` as
   * `{ summary, createdAt }`; the chat client forwards it to the server.
   */
  context?: { storageKey: string; summary: string };
}

/** sessionStorage key the chat client reads for a just-run compatibility match. */
export const COMPATIBILITY_CONTEXT_KEY = "astroyou.compatibilityContext";
const MAX_CONTEXT_CHARS = 1500;

/**
 * The loop-closer. Placed at the end of a reading so the user can carry what
 * they just saw straight into a conversation with Jyotish — turning a
 * dead-end page into the start of the next step.
 */
export const AskJyotishBridge: React.FC<AskJyotishBridgeProps> = ({
  question,
  eyebrow = "Take this further",
  context,
}) => {
  const navigate = useNavigate();

  const ask = () => {
    try {
      sessionStorage.setItem(STORAGE_KEYS.SYNTHESIS_DRAFT, question);
      if (context?.summary) {
        sessionStorage.setItem(
          context.storageKey,
          JSON.stringify({
            summary: context.summary.slice(0, MAX_CONTEXT_CHARS),
            createdAt: Date.now(),
          }),
        );
      }
    } catch {
      // Storage can be unavailable (private mode, quota); the chat still opens.
    }
    navigate("/synthesis");
  };

  return (
    <button
      onClick={ask}
      className="group mt-10 flex w-full items-center gap-4 rounded-2xl border border-gold/15 bg-gold/3 hover:bg-gold/8 hover:border-gold/30 transition-colors p-5 text-left"
    >
      <span className="shrink-0 rounded-xl bg-gold/10 p-2.5 text-gold">
        <Sparkles size={16} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.6875rem] font-bold uppercase tracking-[0.3em] text-gold/70">
          {eyebrow}
        </span>
        <span className="mt-1 block font-display italic text-base text-white/80 group-hover:text-white transition-colors">
          “{question}”
        </span>
      </span>
      <ArrowUpRight
        size={16}
        aria-hidden="true"
        className="shrink-0 text-gold/40 group-hover:text-gold transition-[color,transform] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
      />
    </button>
  );
};
