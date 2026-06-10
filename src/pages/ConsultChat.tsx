import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { useUserProfile } from "../hooks";
import { getPersonaById, type AstrologerPersona } from "../lib/personas";
import { trackAcquisitionEvent } from "../lib/acquisition";
import {
  AlertCircle,
  ArrowLeft,
  Clock,
  Loader2,
  Send,
  Wallet,
} from "lucide-react";
import { PersonaPortrait } from "../components/consult/PersonaPortrait";
import { useCreditTopup } from "../hooks/useCreditTopup";
import { DEFAULT_CREDIT_PACK } from "../lib/credit-packs";
import { getPlatformLanguage } from "../lib/languages";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const getPreferredConsultLanguage = (
  persona: AstrologerPersona | undefined,
  queryString: string,
  profileLanguage?: string,
) => {
  if (!persona) return "English";
  const requestedLanguage = new URLSearchParams(queryString).get("lang")?.trim();
  const matchedLanguage = persona.languages.find(
    (language) =>
      language.toLowerCase() === requestedLanguage?.toLowerCase(),
  );
  if (matchedLanguage) return matchedLanguage;

  const preferredProfileLanguage = profileLanguage
    ? getPlatformLanguage(profileLanguage).label
    : "";
  const matchedProfileLanguage = persona.languages.find(
    (language) => language.toLowerCase() === preferredProfileLanguage.toLowerCase(),
  );
  return matchedProfileLanguage || persona.languages[0] || "English";
};

const getConsultSessionStorageKey = (personaId: string, language: string) =>
  `astroyou:consult-session:${personaId}:${language}`;

export default function ConsultChat() {
  const { personaId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { profile, birthData, loading: isLoadingProfile } = useUserProfile();
  const { buyCredits, isPaying, error: paymentError } = useCreditTopup();
  const persona = getPersonaById(personaId || "");
  const preferredLanguage = useMemo(
    () => getPreferredConsultLanguage(persona, location.search, profile?.language),
    [location.search, persona, profile?.language],
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [interactionId, setInteractionId] = useState<string | undefined>(undefined);
  const [sessionActive, setSessionActive] = useState(true);
  const [showRating, setShowRating] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [shareReviewPublic, setShareReviewPublic] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [sessionReceipt, setSessionReceipt] = useState<{
    durationSeconds: number;
    cost: number;
  } | null>(null);
  const [sessionInfo, setSessionInfo] = useState<{
    sessionId: string;
    startedAt: number;
    pricePerMin: number;
    estimatedMinutes: number;
    preferredLanguage: string;
  } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef(Date.now());
  const sessionEndedRef = useRef(false);
  const sessionStartingRef = useRef(false);

  // Start timer after the server has created the billing session.
  useEffect(() => {
    if (!sessionInfo || !sessionActive) return;
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionActive, sessionInfo]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/onboarding", { replace: true });
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (
      authLoading ||
      isLoadingProfile ||
      !user ||
      !persona ||
      sessionInfo ||
      sessionStartingRef.current
    ) {
      return;
    }

    const credits = profile?.credits ?? 0;
    if (credits < persona.pricePerMin) {
      setBillingError("Insufficient credits to start this consultation.");
      setSessionActive(false);
      return;
    }

    sessionStartingRef.current = true;
    const startSession = async () => {
      try {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/consult/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idToken,
            personaId: persona.id,
            preferredLanguage,
            existingSessionId: sessionStorage.getItem(
              getConsultSessionStorageKey(persona.id, preferredLanguage),
            ),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Could not start session");

        startTimeRef.current = data.startedAt;
        setElapsedSeconds(0);
        setInteractionId(undefined);
        setSessionInfo({
          sessionId: data.sessionId,
          startedAt: data.startedAt,
          pricePerMin: data.pricePerMin,
          estimatedMinutes: data.estimatedMinutes,
          preferredLanguage: data.preferredLanguage || preferredLanguage,
        });
        sessionStorage.setItem(
          getConsultSessionStorageKey(persona.id, preferredLanguage),
          data.sessionId,
        );
        trackAcquisitionEvent("consult_started", { personaId: persona.id });
      } catch (err: any) {
        console.error("Failed to start consultation session:", err);
        setBillingError(err.message || "Could not start consultation session.");
        setSessionActive(false);
      }
    };

    startSession();
  }, [
    authLoading,
    isLoadingProfile,
    persona,
    preferredLanguage,
    profile?.credits,
    sessionInfo,
    user,
  ]);

  const elapsedMinutes = Math.ceil(elapsedSeconds / 60);
  const pricePerMin = sessionInfo?.pricePerMin || persona?.pricePerMin || 5;
  const cost = elapsedMinutes * pricePerMin;
  const creditsRemaining =
    user && !isLoadingProfile ? (profile?.credits || 0) - cost : 0;

  const endSession = useCallback(async () => {
    if (sessionEndedRef.current || !persona) return;
    sessionEndedRef.current = true;

    if (timerRef.current) clearInterval(timerRef.current);
    setSessionActive(false);
    setShowRating(true);

    const durationSeconds = Math.round(
      (Date.now() - startTimeRef.current) / 1000,
    );
    const finalMinutes = Math.max(1, Math.ceil(durationSeconds / 60));
    const fallbackCost = finalMinutes * persona.pricePerMin;
    setSessionReceipt({ durationSeconds, cost: fallbackCost });

    // Final billing is server-side so users cannot bypass Firestore rules.
    if (user && sessionInfo) {
      try {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/consult/end", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idToken,
            sessionId: sessionInfo.sessionId,
            messageCount: messages.length,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Billing failed");
        setSessionReceipt({
          durationSeconds: data.durationSeconds,
          cost: data.cost,
        });
        sessionStorage.removeItem(
          getConsultSessionStorageKey(
            persona.id,
            sessionInfo.preferredLanguage || preferredLanguage,
          ),
        );
      } catch (err: any) {
        console.error("Failed to finalize consultation billing:", err);
        setBillingError(
          err.message || "Could not finalize billing for this session.",
        );
      }
    }
  }, [user, persona, sessionInfo, messages.length, preferredLanguage]);

  const sendMessage = async () => {
    if (!input.trim() || !sessionActive || isStreaming) return;
    if (!user) {
      navigate("/onboarding", { replace: true });
      return;
    }
    if (!isLoadingProfile && creditsRemaining <= 0) {
      endSession();
      return;
    }
    if (!sessionInfo) {
      setBillingError("Consultation session is still starting.");
      return;
    }

    const userMsg: ChatMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/consult/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          sessionId: sessionInfo.sessionId,
          messages: [...messages, userMsg],
          birthData,
          kundaliData: null,
          previousInteractionId: interactionId,
        }),
      });

      if (!res.ok) throw new Error("Request failed");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let pendingBuffer = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        pendingBuffer += decoder.decode(value, { stream: true });
        const lines = pendingBuffer.split("\n");
        pendingBuffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "delta") {
              fullContent += data.text;
            } else if (data.type === "done" && data.interactionId) {
              setInteractionId(data.interactionId);
            }
          } catch {
            // skip malformed SSE lines
          }
        }
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant") {
            return [
              ...updated.slice(0, -1),
              { role: "assistant" as const, content: fullContent },
            ];
          } else {
            return [
              ...updated,
              { role: "assistant" as const, content: fullContent },
            ];
          }
        });
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I apologize, there was a connection issue. Please try again.",
        },
      ]);
    }
    setIsStreaming(false);
  };

  // Auto-end when credits exhausted
  useEffect(() => {
    if (
      user &&
      !isLoadingProfile &&
      creditsRemaining <= 0 &&
      sessionActive &&
      elapsedSeconds > 0
    ) {
      endSession();
    }
  }, [
    creditsRemaining,
    elapsedSeconds,
    endSession,
    isLoadingProfile,
    sessionActive,
    user,
  ]);

  if (!persona) {
    navigate("/consult");
    return null;
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const isLowBalance = creditsRemaining <= 2 * pricePerMin;
  const displayedDurationSeconds =
    sessionReceipt?.durationSeconds ?? elapsedSeconds;
  const displayedMinutes = Math.max(
    1,
    Math.ceil(displayedDurationSeconds / 60),
  );
  const displayedCost = sessionReceipt?.cost ?? cost;

  return (
    <div className="min-h-screen bg-[#030308] text-white flex flex-col">
      {/* Persona bar */}
      <div className="sticky top-0 z-20 bg-[#030308]/90 backdrop-blur border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (sessionActive) endSession();
                else navigate("/consult");
              }}
              className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            >
              <ArrowLeft size={18} className="text-white/50" />
            </button>
            <PersonaPortrait persona={persona} size="sm" />
            <div>
              <p className="text-sm font-medium">{persona.name}</p>
              <p className="text-[10px] text-white/40">
                AI astrologer · {persona.specialty} · {preferredLanguage}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-amber-400">
              <Clock size={14} />
              <span className="text-sm font-mono">
                {formatTime(elapsedSeconds)}
              </span>
            </div>
            <span className="text-sm text-amber-300 font-bold">{cost} cr</span>
            {isLowBalance && sessionActive && (
              <button
                onClick={() => buyCredits(DEFAULT_CREDIT_PACK.minutes)}
                disabled={isPaying}
                className="text-xs text-red-300 flex items-center gap-1 rounded-lg border border-red-400/20 px-2 py-1 hover:bg-red-500/10"
              >
                {isPaying ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Wallet size={12} />
                )}
                Add time
              </button>
            )}
            {sessionActive && (
              <button
                onClick={endSession}
                className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/30 transition-colors"
              >
                End
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Welcome message */}
          <div className="max-w-2xl">
            <div className="rounded-2xl px-4 py-3 text-sm bg-white/5 text-white/70">
              <p className="italic">
                Namaste. I am your AI astrologer for this session. I will guide
                you in {preferredLanguage}. What would you like to understand
                through your chart today?
              </p>
            </div>
            <p className="text-[10px] text-white/20 mt-1 ml-1">
              {persona.name}
            </p>
          </div>

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-2xl ${msg.role === "user" ? "ml-auto" : ""}`}
            >
              <div
                className={`rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-amber-500/10 text-white border border-amber-500/10"
                    : "bg-white/5 text-white/80"
                }`}
              >
                {msg.content}
                {isStreaming &&
                  i === messages.length - 1 &&
                  msg.role === "assistant" && (
                    <span className="inline-block w-1.5 h-4 ml-0.5 bg-amber-400/70 animate-pulse" />
                  )}
              </div>
            </div>
          ))}

          {!sessionActive && !sessionInfo && billingError && (
            <div className="max-w-sm mx-auto my-6 glass rounded-[1.5rem] p-5 text-center">
              <div className="flex justify-center">
                <PersonaPortrait persona={persona} />
              </div>
              <p className="text-sm text-white/80 mt-3">
                Consultation could not start.
              </p>
              <p className="mt-2 text-xs text-white/40">{billingError}</p>
              <button
                onClick={() => navigate(`/consult/${persona.id}/profile`)}
                className="platform-button-secondary mt-5 w-full"
              >
                Back to profile
              </button>
            </div>
          )}

          {!sessionActive && sessionInfo && (
            <div className="max-w-sm mx-auto my-6 glass rounded-[2rem] p-6 text-center">
              <div className="flex justify-center">
                <PersonaPortrait persona={persona} />
              </div>
              <p className="text-sm text-white/60 mt-2">
                Session with {persona.name}
              </p>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">Duration</span>
                  <span>{displayedMinutes} min</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">Rate</span>
                  <span>{pricePerMin} credits/min</span>
                </div>
                <div className="flex justify-between text-sm border-t border-white/10 pt-2">
                  <span className="text-white/60 font-medium">Total</span>
                  <span className="text-gold font-bold">
                    {displayedCost} credits
                  </span>
                </div>
              </div>
              {billingError && (
                <p className="mt-4 text-xs text-red-400">{billingError}</p>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      {sessionActive && (
        <div className="sticky bottom-0 bg-[#030308]/90 backdrop-blur border-t border-white/10 px-4 py-3">
          {paymentError && (
            <div className="max-w-3xl mx-auto mb-3 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {paymentError}
            </div>
          )}
          {isLowBalance && (
            <div className="max-w-3xl mx-auto mb-3 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-red-200 text-sm">
                <AlertCircle size={16} />
                <span>Low balance: about {Math.max(0, Math.floor(creditsRemaining / pricePerMin))} min left.</span>
              </div>
              <button
                onClick={() => buyCredits(DEFAULT_CREDIT_PACK.minutes)}
                disabled={isPaying}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-gold text-black text-xs font-bold uppercase tracking-widest"
              >
                {isPaying ? "Opening" : "Add time"}
              </button>
            </div>
          )}
          <div className="flex gap-2 max-w-3xl mx-auto">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask your question..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/50 transition-colors placeholder:text-white/30"
              disabled={isStreaming || !sessionInfo}
            />
            <button
              onClick={sendMessage}
              disabled={isStreaming || !input.trim() || !sessionInfo}
              className="p-3 rounded-xl bg-amber-500 text-black disabled:opacity-30 transition-opacity hover:bg-amber-400"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Rating modal */}
      {showRating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-[#0a0a0f] border border-white/10 rounded-[2rem] p-8 max-w-sm w-full text-center">
            <p className="text-lg font-semibold mb-2">How was your session?</p>
            <p className="text-white/40 text-sm mb-2">with {persona.name}</p>
            <p className="text-white/30 text-xs mb-6">
              {displayedMinutes} min &middot; {displayedCost} credits
            </p>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-left mb-5">
              <p className="text-xs uppercase tracking-widest text-white/35 mb-2">
                Session Summary
              </p>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-white/35 text-xs">Duration</p>
                  <p>{displayedMinutes} min</p>
                </div>
                <div>
                  <p className="text-white/35 text-xs">Rate</p>
                  <p>{pricePerMin} cr/min</p>
                </div>
                <div>
                  <p className="text-white/35 text-xs">Paid</p>
                  <p className="text-gold font-semibold">
                    {displayedCost} cr
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setSelectedRating(star)}
                  className={`text-2xl hover:scale-125 transition-transform ${
                    star <= selectedRating ? "opacity-100" : "opacity-30"
                  }`}
                >
                  ⭐
                </button>
              ))}
            </div>
            <textarea
              value={reviewText}
              onChange={(event) => setReviewText(event.target.value)}
              placeholder="What felt useful? Optional."
              className="w-full min-h-24 mb-5 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-amber-500/50 resize-none placeholder:text-white/25"
            />
            <label className="mb-4 flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left text-xs text-white/45">
              <input
                type="checkbox"
                checked={shareReviewPublic}
                onChange={(event) => setShareReviewPublic(event.target.checked)}
                className="mt-0.5"
              />
              <span>
                Allow AstroYou to use this as a public review after moderation.
                We do not publish reviews automatically.
              </span>
            </label>
            {reviewError && (
              <p className="mb-4 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-left text-xs text-red-200">
                {reviewError}
              </p>
            )}
            <button
              onClick={async () => {
                if (user && persona && selectedRating > 0) {
                  try {
                    setReviewSubmitting(true);
                    setReviewError(null);
                    const idToken = await user.getIdToken();
                    const response = await fetch("/api/trust/submit", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        idToken,
                        kind: "consult_review",
                        personaId: persona.id,
                        sessionId: sessionInfo?.sessionId,
                        rating: selectedRating,
                        reviewText,
                        sharePublic: shareReviewPublic,
                      }),
                    });
                    const data = await response.json().catch(() => ({}));
                    if (!response.ok) {
                      throw new Error(data.error || "Could not save review.");
                    }
                    trackAcquisitionEvent("consult_review_submitted", {
                      personaId: persona.id,
                      rating: selectedRating,
                      sharePublic: shareReviewPublic,
                    });
                  } catch (err: any) {
                    console.error("Failed to save rating:", err);
                    setReviewError(err.message || "Could not save review.");
                    setReviewSubmitting(false);
                    return;
                  }
                }
                navigate("/consult");
              }}
              disabled={reviewSubmitting}
              className="w-full py-3 rounded-xl bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 transition-colors disabled:opacity-50"
            >
              {reviewSubmitting ? "Saving..." : "Done"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
