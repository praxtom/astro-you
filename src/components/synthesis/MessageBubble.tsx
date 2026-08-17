import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Markdown renderers are defined once at module level so every bubble shares
 * the same component identities — ReactMarkdown would otherwise remount its
 * subtree whenever a new `components` object is passed.
 */
const markdownComponents = {
  p: ({ children }: any) => (
    <p className="mb-4 last:mb-0 text-sm md:text-base leading-relaxed whitespace-pre-wrap font-sans font-light">
      {children}
    </p>
  ),
  li: ({ children }: any) => <li className="mb-2 last:mb-0">{children}</li>,
  h1: ({ children }: any) => (
    <h1 className="font-display text-xl text-gold mt-6 mb-3">{children}</h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="font-display text-lg text-gold mt-5 mb-2">{children}</h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="font-display text-base text-gold mt-4 mb-2">{children}</h3>
  ),
};

const REMARK_PLUGINS = [remarkGfm];

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  /**
   * Persisted assistant replies (no clientId) get the progressive reveal;
   * replies we just streamed in do not, since the user already watched them
   * arrive.
   */
  reveal?: boolean;
  /**
   * Live streaming bubble: fade-in wrapper, marked aria-busy while it grows.
   * Deliberately NOT a live region — announcing every flushed delta would
   * re-read the whole reply; the page's single done-announcement covers SR.
   */
  streaming?: boolean;
}

function MessageBubbleImpl({
  role,
  content,
  reveal = false,
  streaming = false,
}: MessageBubbleProps) {
  const isUser = role === "user";

  const wrapperAnimation = streaming
    ? "animate-in fade-in duration-300"
    : isUser
      ? "animate-message-send"
      : reveal
        ? "animate-reveal-progressive"
        : "";

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} ${wrapperAnimation}`}
      aria-busy={streaming || undefined}
    >
      <div className="max-w-[90%] md:max-w-[85%] group">
        {isUser ? (
          <div className="px-4 py-2 rounded-2xl rounded-tr-md bg-gold/8 border border-gold/15 text-white/85 transition-colors group-hover:bg-gold/10">
            <ReactMarkdown
              remarkPlugins={REMARK_PLUGINS}
              components={markdownComponents as any}
            >
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          <div
            className={`prose-cosmic ${reveal ? "animate-reveal-progressive" : ""}`}
          >
            <ReactMarkdown
              remarkPlugins={REMARK_PLUGINS}
              components={markdownComponents as any}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

const MessageBubble = memo(MessageBubbleImpl);
MessageBubble.displayName = "MessageBubble";

export default MessageBubble;
