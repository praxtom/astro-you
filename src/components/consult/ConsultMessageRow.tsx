import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Module-level so every row shares one stable reference — otherwise
// ReactMarkdown re-parses on each parent render (the meter ticks every second).
const REMARK_PLUGINS = [remarkGfm];

const MARKDOWN_COMPONENTS = {
  p: ({ children }: any) => (
    <p className="mb-3 last:mb-0 text-sm leading-relaxed font-light">
      {children}
    </p>
  ),
  li: ({ children }: any) => <li className="mb-1.5 last:mb-0">{children}</li>,
  h1: ({ children }: any) => (
    <h1 className="font-display text-lg text-gold mt-4 mb-2">{children}</h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="font-display text-base text-gold mt-3 mb-1.5">{children}</h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="font-display text-sm text-gold mt-3 mb-1.5">{children}</h3>
  ),
};

interface ConsultMessageRowProps {
  role: "user" | "assistant";
  content: string;
  /** True only for the assistant row currently being streamed. */
  isStreaming: boolean;
  /** Persona accent colour (hex) for the guide's rule and caret. */
  accent: string;
}

/**
 * One transcript row. Memoised so the 1 s billing tick in ConsultChat only
 * re-renders the header/meter, not every markdown block in the conversation.
 */
export const ConsultMessageRow = memo(function ConsultMessageRow({
  role,
  content,
  isStreaming,
  accent,
}: ConsultMessageRowProps) {
  if (role === "user") {
    return (
      <div className="max-w-2xl ml-auto">
        <div className="px-5 py-3 rounded-2xl rounded-tr-md bg-gold/8 border border-gold/15 text-white/85 text-sm whitespace-pre-wrap">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div
        className="pl-5 border-l text-white/80"
        style={{ borderColor: `${accent}55` }}
      >
        <ReactMarkdown
          remarkPlugins={REMARK_PLUGINS}
          components={MARKDOWN_COMPONENTS as any}
        >
          {content}
        </ReactMarkdown>
        {isStreaming && (
          <span
            aria-hidden="true"
            className="inline-block w-0.5 h-4 ml-0.5 animate-pulse align-middle"
            style={{ background: accent }}
          />
        )}
      </div>
    </div>
  );
});
