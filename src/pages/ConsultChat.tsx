import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/useAuth";
import { useUserProfile } from "../hooks";
import {
  getPersonaById,
  getPersonaAccent,
  type AstrologerPersona,
} from "../lib/personas";
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
import { STORAGE_KEYS } from "../lib/constants";

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
  const requestedLanguage = new URLSearchParams(queryString)
    .get("lang")
    ?.trim();
  const matchedLanguage = persona.languages.find(
    (language) => language.toLowerCase() === requestedLanguage?.toLowerCase(),
  );
  if (matchedLanguage) return matchedLanguage;

  const preferredProfileLanguage = profileLanguage
    ? getPlatformLanguage(profileLanguage).label
    : "";
  const matchedProfileLanguage = persona.languages.find(
    (language) =>
      language.toLowerCase() === preferredProfileLanguage.toLowerCase(),
  );
  return matchedProfileLanguage || persona.languages[0] || "English";
};

const getConsultSessionStorageKey = (personaId: string, language: string) =>
  `astroyou:consult-session:${personaId}:${language}`;
// Transcript lives beside the session id so a refresh resumes the
// conversation, not just the billing meter.
const getConsultTranscriptStorageKey = (personaId: string, language: string) =>
  `astroyou:consult-transcript:${personaId}:${language}`;

export default function ConsultChat() {
  const { personaId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { profile, birthData, loading: isLoadingProfile } = useUserProfile();
  const { buyCredits, isPaying, error: paymentError } = useCreditTopup();
  const persona = getPersonaById(personaId || "");
  const accent = persona ? getPersonaAccent(persona.id) : "#ffcd6a";
  const preferredLanguage = useMemo(
    () =>
      getPreferredConsultLanguage(persona, location.search, profile?.language),
    [location.search, persona, profile?.language],
  );

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (!persona) return [];
    try {
      const stored = sessionStorage.getItem(
        getConsultTranscriptStorageKey(persona.id, preferredLanguage),
      );
      return stored ? (JSON.parse(stored) as ChatMessage[]) : [];
    } catch {
      return [];
    }
  });
  // Seeded from the dossier's "open with one of these" questions.
  const [input, setInput] = useState(() => {
    const draft = sessionStorage.getItem(STORAGE_KEYS.CONSULT_DRAFT) || "";
    if (draft) sessionStorage.removeItem(STORAGE_KEYS.CONSULT_DRAFT);
    return draft;
  });
  const [isStreaming, setIsStreaming] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [interactionId, setInteractionId] = useState<string | undefined>(
    undefined,
  );
  const [kundaliData, setKundaliData] = useState<any>(null);
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
  const idTokenRef = useRef<string | null>(null);

  // The marketplace promise is "chart-aware": load the cached kundali from the
  // user doc so the guide actually receives planetary positions.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getDoc(doc(db, "users", user.uid))
      .then((snap) => {
        if (!cancelled && snap.exists()) {
          setKundaliData(snap.data().kundaliData ?? null);
        }
      })
      .catch(() => {
        // Chart context is an enhancement — the session still works without it.
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Keep the transcript in sessionStorage while the session is live.
  useEffect(() => {
    if (!persona || sessionEndedRef.current) return;
    const key = getConsultTranscriptStorageKey(persona.id, preferredLanguage);
    if (messages.length > 0) {
      sessionStorage.setItem(key, JSON.stringify(messages));
    }
  }, [messages, persona, preferredLanguage]);

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
        idTokenRef.current = idToken;
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
        const language = sessionInfo.preferredLanguage || preferredLanguage;
        sessionStorage.removeItem(
          getConsultSessionStorageKey(persona.id, language),
        );
        sessionStorage.removeItem(
          getConsultTranscriptStorageKey(persona.id, language),
        );
      } catch (err: any) {
        console.error("Failed to finalize consultation billing:", err);
        setBillingError(
          err.message || "Could not finalize billing for this session.",
        );
      }
    }
  }, [user, persona, sessionInfo, messages.length, preferredLanguage]);

  // Keep a permanent transcript under the consultation receipt so past
  // sittings can be reopened later. Fire-and-forget: a failed write must
  // never interrupt the conversation.
  const persistMessage = useCallback(
    (sessionId: string, role: "user" | "assistant", content: string) => {
      if (!user) return;
      addDoc(
        collection(
          db,
          "users",
          user.uid,
          "consultations",
          sessionId,
          "messages",
        ),
        { role, content, timestamp: serverTimestamp() },
      ).catch(() => {});
    },
    [user],
  );

  const sendMessage = async (preset?: string) => {
    const content = (preset ?? input).trim();
    if (!content || !sessionActive || isStreaming) return;
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

    const userMsg: ChatMessage = { role: "user", content };
    setMessages((prev) => [...prev, userMsg]);
    persistMessage(sessionInfo.sessionId, "user", content);
    setInput("");
    setIsStreaming(true);

    try {
      const idToken = await user.getIdToken();
      idTokenRef.current = idToken;
      const res = await fetch("/api/consult/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          sessionId: sessionInfo.sessionId,
          messages: [...messages, userMsg],
          birthData,
          kundaliData,
          previousInteractionId: interactionId,
        }),
      });

      if (!res.ok) {
        // Surface the server's message (e.g. 402 "time is up — top up").
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Request failed");
      }

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
        let chunkText = "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "delta") {
              chunkText += data.text;
            } else if (data.type === "done" && data.interactionId) {
              setInteractionId(data.interactionId);
            }
          } catch {
            // skip malformed SSE lines
          }
        }
        fullContent += chunkText;
        // Capture an immutable snapshot for the state updater — the React
        // compiler forbids updaters closing over mutated locals.
        const snapshot = fullContent;
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant") {
            return [
              ...updated.slice(0, -1),
              { role: "assistant" as const, content: snapshot },
            ];
          } else {
            return [
              ...updated,
              { role: "assistant" as const, content: snapshot },
            ];
          }
        });
      }
      if (fullContent) {
        persistMessage(sessionInfo.sessionId, "assistant", fullContent);
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

  // Bill on tab close. fetch() is unreliable during unload, so fire a beacon to
  // close the session immediately. The scheduled reaper is the server-side
  // backstop if even this doesn't land.
  useEffect(() => {
    const flushOnHide = () => {
      if (sessionEndedRef.current) return;
      const token = idTokenRef.current;
      const sessionId = sessionInfo?.sessionId;
      if (!token || !sessionId || !navigator.sendBeacon) return;
      sessionEndedRef.current = true;
      const payload = new Blob(
        [
          JSON.stringify({
            idToken: token,
            sessionId,
            messageCount: messages.length,
          }),
        ],
        { type: "application/json" },
      );
      navigator.sendBeacon("/api/consult/end", payload);
    };
    window.addEventListener("pagehide", flushOnHide);
    return () => window.removeEventListener("pagehide", flushOnHide);
  }, [sessionInfo, messages.length]);

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

  const markdownComponents = useMemo(
    () => ({
      p: ({ children }: any) => (
        <p className="mb-3 last:mb-0 text-sm leading-relaxed font-light">
          {children}
        </p>
      ),
      li: ({ children }: any) => (
        <li className="mb-1.5 last:mb-0">{children}</li>
      ),
      h1: ({ children }: any) => (
        <h1 className="font-display text-lg text-gold mt-4 mb-2">{children}</h1>
      ),
      h2: ({ children }: any) => (
        <h2 className="font-display text-base text-gold mt-3 mb-1.5">
          {children}
        </h2>
      ),
      h3: ({ children }: any) => (
        <h3 className="font-display text-sm text-gold mt-3 mb-1.5">
          {children}
        </h3>
      ),
    }),
    [],
  );

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
    <div className="min-h-screen bg-bg-app text-white flex flex-col selection:bg-gold/30">
      {/* ── Session bar ── */}
      <div className="sticky top-0 z-20 bg-bg-app/85 backdrop-blur-xl border-b border-white/5 px-4 py-2.5">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => {
                if (sessionActive) endSession();
                else navigate("/consult");
              }}
              className="p-1.5 rounded-lg text-white/35 hover:text-gold transition-colors"
              aria-label="Leave session"
            >
              <ArrowLeft size={16} />
            </button>
            <PersonaPortrait persona={persona} size="sm" />
            <div className="min-w-0">
              <p className="font-display italic text-base leading-tight truncate">
                {persona.name}
              </p>
              <p
                className="flex items-center gap-1.5 text-[0.55rem] font-bold uppercase tracking-[0.25em]"
                style={{ color: accent }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                With you now · {preferredLanguage}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[0.7rem] font-mono px-2.5 py-1 rounded-full border border-gold/25 text-gold bg-gold/5">
              <Clock size={10} />
              {formatTime(elapsedSeconds)}
              <span className="text-gold/50">·</span>
              {cost} cr
            </div>
            {isLowBalance && sessionActive && (
              <button
                onClick={() => buyCredits(DEFAULT_CREDIT_PACK.minutes)}
                disabled={isPaying}
                className="hidden sm:flex text-[0.65rem] text-red-300 items-center gap-1 rounded-full border border-red-400/20 px-2.5 py-1 hover:bg-red-500/10"
              >
                {isPaying ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <Wallet size={11} />
                )}
                Add time
              </button>
            )}
            {sessionActive && (
              <button
                onClick={endSession}
                className="px-3 py-1 rounded-full border border-red-400/25 text-red-300 text-[0.65rem] font-bold uppercase tracking-[0.15em] hover:bg-red-500/10 transition-colors"
              >
                End
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-5">
          {/* Welcome */}
          <div className="max-w-2xl">
            <p
              className="text-[0.6rem] font-bold uppercase tracking-[0.3em] mb-1.5"
              style={{ color: `${accent}99` }}
            >
              {persona.name}
            </p>
            <div
              className="pl-5 border-l"
              style={{ borderColor: `${accent}55` }}
            >
              <p className="font-display italic text-base text-white/70 leading-relaxed">
                Namaste. I am {persona.name}. Your chart is open in front of me,
                and I have all the time you need. We will speak in{" "}
                {preferredLanguage}. What shall we look at today?
              </p>
            </div>
          </div>

          {/* Opening questions, until the conversation begins */}
          {messages.length === 0 && sessionActive && (
            <div className="flex flex-wrap gap-2 pl-5">
              {persona.sampleQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  disabled={isStreaming || !sessionInfo}
                  className="px-4 py-2 rounded-full border border-white/10 text-xs text-white/45 hover:text-gold hover:border-gold/30 transition-colors disabled:opacity-40"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-2xl ${msg.role === "user" ? "ml-auto" : ""}`}
            >
              {msg.role === "user" ? (
                <div className="px-5 py-3 rounded-2xl rounded-tr-md bg-gold/8 border border-gold/15 text-white/85 text-sm whitespace-pre-wrap">
                  {msg.content}
                </div>
              ) : (
                <div
                  className="pl-5 border-l text-white/80"
                  style={{ borderColor: `${accent}55` }}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents as any}
                  >
                    {msg.content}
                  </ReactMarkdown>
                  {isStreaming &&
                    i === messages.length - 1 &&
                    msg.role === "assistant" && (
                      <span
                        className="inline-block w-0.5 h-4 ml-0.5 animate-pulse align-middle"
                        style={{ background: accent }}
                      />
                    )}
                </div>
              )}
            </div>
          ))}

          {isStreaming && messages[messages.length - 1]?.role === "user" && (
            <div
              className="max-w-2xl pl-5 border-l flex items-center gap-3 py-1"
              style={{ borderColor: `${accent}55` }}
            >
              <Loader2
                size={13}
                className="animate-spin"
                style={{ color: accent }}
              />
              <span className="text-[0.65rem] uppercase tracking-[0.3em] text-white/35 animate-pulse">
                {persona.name.split(" ")[0]} is writing…
              </span>
            </div>
          )}

          {!sessionActive && !sessionInfo && billingError && (
            <div className="max-w-sm mx-auto my-6 rounded-3xl border border-white/10 bg-white/3 backdrop-blur-xl p-6 text-center">
              <div className="flex justify-center">
                <PersonaPortrait persona={persona} />
              </div>
              <p className="text-sm text-white/80 mt-3">
                The sitting could not begin.
              </p>
              <p className="mt-2 text-xs text-white/40">{billingError}</p>
              <button
                onClick={() => navigate(`/consult/${persona.id}/profile`)}
                className="mt-5 w-full px-4 py-2.5 rounded-xl border border-gold/30 text-gold text-[0.65rem] font-bold uppercase tracking-[0.2em] hover:bg-gold hover:text-black transition-colors"
              >
                Back to dossier
              </button>
            </div>
          )}

          {!sessionActive && sessionInfo && (
            <div className="max-w-sm mx-auto my-6 rounded-3xl border border-white/10 bg-white/3 backdrop-blur-xl p-6 text-center">
              <div className="flex justify-center">
                <PersonaPortrait persona={persona} />
              </div>
              <p className="text-sm text-white/60 mt-3">
                Sitting with {persona.name}
              </p>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/40">Duration</span>
                  <span>{displayedMinutes} min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Rate</span>
                  <span>{pricePerMin} cr / min</span>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-2">
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

      {/* ── Input ── */}
      {sessionActive && (
        <div className="sticky bottom-0 bg-bg-app/85 backdrop-blur-xl border-t border-white/5 px-4 py-3">
          {paymentError && (
            <div className="max-w-3xl mx-auto mb-3 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {paymentError}
            </div>
          )}
          {isLowBalance && (
            <div className="max-w-3xl mx-auto mb-3 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-red-200 text-sm">
                <AlertCircle size={15} />
                <span>
                  Low balance: about{" "}
                  {Math.max(0, Math.floor(creditsRemaining / pricePerMin))} min
                  left.
                </span>
              </div>
              <button
                onClick={() => buyCredits(DEFAULT_CREDIT_PACK.minutes)}
                disabled={isPaying}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-gold text-black text-[0.65rem] font-bold uppercase tracking-[0.15em]"
              >
                {isPaying ? "Opening" : "Add time"}
              </button>
            </div>
          )}
          <div className="relative max-w-3xl mx-auto group">
            <div className="absolute -inset-px rounded-2xl bg-linear-to-r from-gold/0 via-gold/25 to-gold/0 opacity-0 group-focus-within:opacity-100 transition-opacity duration-700 blur-sm pointer-events-none" />
            <div className="relative flex items-center gap-3 rounded-2xl border border-white/10 bg-white/4 backdrop-blur-xl px-4 py-2.5 transition-colors group-focus-within:border-gold/40">
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
                placeholder={`Write to ${persona.name.split(" ")[0]}…`}
                className="flex-1 min-w-0 bg-transparent outline-none text-sm text-white/85 placeholder:text-white/30"
                disabled={isStreaming || !sessionInfo}
              />
              <button
                onClick={() => sendMessage()}
                disabled={isStreaming || !input.trim() || !sessionInfo}
                className={`shrink-0 p-2 rounded-xl transition-all ${
                  input.trim() && sessionInfo
                    ? "bg-gold text-black hover:bg-gold/90"
                    : "text-white/20"
                }`}
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Rating ── */}
      {showRating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0a0a12] border border-white/10 rounded-3xl p-8 max-w-sm w-full text-center">
            <p className="font-display italic text-2xl mb-1">
              How was the sitting?
            </p>
            <p className="text-white/40 text-sm mb-1">with {persona.name}</p>
            <p className="text-white/30 text-xs mb-6">
              {displayedMinutes} min · {displayedCost} credits
            </p>
            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setSelectedRating(star)}
                  className={`text-2xl hover:scale-125 transition-transform ${
                    star <= selectedRating ? "opacity-100" : "opacity-30"
                  }`}
                  aria-label={`${star} star${star > 1 ? "s" : ""}`}
                >
                  ⭐
                </button>
              ))}
            </div>
            <textarea
              value={reviewText}
              onChange={(event) => setReviewText(event.target.value)}
              placeholder="What felt useful? Optional."
              className="w-full min-h-24 mb-4 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-gold/40 resize-none placeholder:text-white/25"
            />
            <label className="mb-4 flex items-start gap-3 rounded-xl border border-white/10 bg-white/3 p-3 text-left text-xs text-white/45">
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
              className="w-full py-3 rounded-xl bg-gold text-black text-[0.65rem] font-bold uppercase tracking-[0.2em] hover:bg-gold/90 transition-colors disabled:opacity-50"
            >
              {reviewSubmitting ? "Saving…" : "Done"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
