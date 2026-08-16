import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth as firebaseAuth } from "../lib/firebase";
import { useAuth } from "../lib/useAuth";
import { useUserProfile, useSubscription } from "../hooks";
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
import { ConsultMessageRow } from "../components/consult/ConsultMessageRow";
import AuthModal from "../components/AuthModal";
import { useCreditTopup } from "../hooks/useCreditTopup";
import { DEFAULT_CREDIT_PACK } from "../lib/credit-packs";
import { getPlatformLanguage } from "../lib/languages";
import { STORAGE_KEYS } from "../lib/constants";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface SessionInfo {
  sessionId: string;
  startedAt: number;
  pricePerMin: number;
  estimatedMinutes: number;
  preferredLanguage: string;
}

// Kept as constants so recovery paths (e.g. a top-up landing) can clear
// exactly the error they created and nothing else.
const INSUFFICIENT_CREDITS_MSG =
  "Insufficient credits to start this consultation.";
const TIME_UP_MSG = "Your funded time is up.";
const SESSION_CLOSED_MSG = "This sitting was closed. Start a new one.";

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
  const { profile, birthData } = useUserProfile();
  const { credits: liveCredits, loading: creditsLoading } = useSubscription();
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
  const [sendError, setSendError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [replyAnnouncement, setReplyAnnouncement] = useState("");
  const [activeConflict, setActiveConflict] = useState<{
    activeSessionId: string;
    activePersonaId: string;
  } | null>(null);
  const [conflictEnding, setConflictEnding] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);
  // The server closed this session out-of-band (409/404 on message) — we have
  // no receipt numbers, so render a distinct closed state, never a guess.
  const [closedByServer, setClosedByServer] = useState(false);
  const [sessionReceipt, setSessionReceipt] = useState<{
    durationSeconds: number;
    cost: number;
  } | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionEndedRef = useRef(false);
  const sessionStartingRef = useRef(false);
  const startPromiseRef = useRef<Promise<SessionInfo | null> | null>(null);
  const idTokenRef = useRef<string | null>(null);
  const sessionInfoRef = useRef<SessionInfo | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const sendingRef = useRef(false);
  const streamAbortRef = useRef<AbortController | null>(null);
  const pendingLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  // True once the SPA-unmount flush has run. An ensureSession that resolves
  // after this must end the just-created session immediately instead of
  // orphaning a running meter (the flush saw sessionInfoRef as null).
  const leftRef = useRef(false);
  const ratingModalRef = useRef<HTMLDivElement>(null);
  const firstStarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    sessionInfoRef.current = sessionInfo;
  }, [sessionInfo]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Missing persona → back to the marketplace. In an effect, never during
  // render (navigate() during render is a React error).
  useEffect(() => {
    if (!persona) navigate("/consult", { replace: true });
  }, [persona, navigate]);

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

  // Wall-clock meter: recompute from the server's startedAt on every tick so
  // background-tab throttling and refresh-resume can never desync the display
  // from what the server will actually bill.
  useEffect(() => {
    if (!sessionInfo || !sessionActive) return;
    const update = () =>
      setElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - sessionInfo.startedAt) / 1000)),
      );
    update();
    timerRef.current = setInterval(update, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionActive, sessionInfo]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Guest gate: offer sign-in in place, never bounce to /onboarding (which has
  // no sign-in step — that redirect was a dead loop).
  useEffect(() => {
    if (!authLoading && !user) setShowAuthModal(true);
  }, [authLoading, user]);

  /**
   * Lazily create (or resume) the billing session. Called on mount only when a
   * stored session id exists (the meter is already running server-side), and
   * otherwise from the first sendMessage — so billing never starts before the
   * user actually says something.
   */
  const ensureSession = useCallback(async (): Promise<SessionInfo | null> => {
    if (sessionInfoRef.current) return sessionInfoRef.current;
    if (sessionEndedRef.current || !user || !persona) return null;
    if (startPromiseRef.current) return startPromiseRef.current;

    sessionStartingRef.current = true;
    const startPromise = (async (): Promise<SessionInfo | null> => {
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

        if (
          res.status === 409 &&
          data?.code === "active_session" &&
          typeof data.activeSessionId === "string"
        ) {
          // Another sitting's meter is running — let the user choose.
          setActiveConflict({
            activeSessionId: data.activeSessionId,
            activePersonaId:
              typeof data.activePersonaId === "string"
                ? data.activePersonaId
                : "",
          });
          return null;
        }
        if (!res.ok) throw new Error(data.error || "Could not start session");

        const info: SessionInfo = {
          sessionId: data.sessionId,
          startedAt: data.startedAt,
          pricePerMin: data.pricePerMin,
          estimatedMinutes: data.estimatedMinutes,
          preferredLanguage: data.preferredLanguage || preferredLanguage,
        };

        if (leftRef.current) {
          // The user navigated away while start was in flight — the unmount
          // flush found nothing to end, so end this session right now rather
          // than leaving a billed meter running until the reaper.
          sessionEndedRef.current = true;
          const endBody = JSON.stringify({
            idToken,
            sessionId: info.sessionId,
            messageCount: messagesRef.current.length,
          });
          if (navigator.sendBeacon) {
            navigator.sendBeacon(
              "/api/consult/end",
              new Blob([endBody], { type: "application/json" }),
            );
          } else {
            fetch("/api/consult/end", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: endBody,
              keepalive: true,
            }).catch(() => {});
          }
          sessionStorage.removeItem(
            getConsultSessionStorageKey(persona.id, preferredLanguage),
          );
          sessionStorage.removeItem(
            getConsultTranscriptStorageKey(persona.id, preferredLanguage),
          );
          return null;
        }

        sessionInfoRef.current = info;
        setSessionInfo(info);
        setSessionActive(true);
        setBillingError(null);
        setInteractionId(undefined);
        setElapsedSeconds(
          Math.max(0, Math.floor((Date.now() - info.startedAt) / 1000)),
        );
        sessionStorage.setItem(
          getConsultSessionStorageKey(persona.id, preferredLanguage),
          info.sessionId,
        );
        trackAcquisitionEvent("consult_started", { personaId: persona.id });
        return info;
      } catch (err) {
        console.error("Failed to start consultation session:", err);
        const rawMsg =
          err instanceof Error && err.message
            ? err.message
            : "Could not start consultation session.";
        // The server's 402 wording varies slightly — normalize it so the
        // "Add time" CTA (keyed on the constant) always appears.
        setBillingError(
          rawMsg.startsWith("Insufficient credits")
            ? INSUFFICIENT_CREDITS_MSG
            : rawMsg,
        );
        setSessionActive(false);
        return null;
      } finally {
        sessionStartingRef.current = false;
        startPromiseRef.current = null;
      }
    })();
    startPromiseRef.current = startPromise;
    return startPromise;
  }, [user, persona, preferredLanguage]);

  // Refresh-resume: only when a stored session id exists is the meter already
  // running server-side, so only then do we call start on mount.
  useEffect(() => {
    if (authLoading || !user || !persona) return;
    const stored = sessionStorage.getItem(
      getConsultSessionStorageKey(persona.id, preferredLanguage),
    );
    if (!stored) return;
    ensureSession();
  }, [authLoading, user, persona, preferredLanguage, ensureSession]);

  // Credit gate before a session exists. Uses the live wallet balance so a
  // top-up mid-error re-enables the composer without a reload.
  useEffect(() => {
    if (
      !user ||
      !persona ||
      creditsLoading ||
      sessionInfo ||
      sessionEndedRef.current ||
      sessionStartingRef.current
    ) {
      return;
    }
    if (liveCredits < persona.pricePerMin) {
      setBillingError(INSUFFICIENT_CREDITS_MSG);
      setSessionActive(false);
    } else {
      setBillingError((prev) =>
        prev === INSUFFICIENT_CREDITS_MSG ? null : prev,
      );
      setSessionActive(true);
    }
  }, [user, persona, creditsLoading, liveCredits, sessionInfo]);

  const pricePerMin = sessionInfo?.pricePerMin || persona?.pricePerMin || 5;
  const elapsedMinutes = Math.ceil(elapsedSeconds / 60);
  const cost = elapsedMinutes * pricePerMin;
  // Display only — the server is the billing truth.
  const creditsRemaining = user && !creditsLoading ? liveCredits - cost : 0;
  // The wallet funds this many seconds in full; the server serves (and bills)
  // up to floor(credits/price) whole minutes, so this is the honest cutoff.
  const fundedSeconds = Math.floor(liveCredits / pricePerMin) * 60;

  const endSession = useCallback(
    async (options?: { showRatingModal?: boolean }) => {
      const info = sessionInfoRef.current;
      if (sessionEndedRef.current || !persona || !info) return;
      sessionEndedRef.current = true;

      if (timerRef.current) clearInterval(timerRef.current);
      streamAbortRef.current?.abort();
      setSessionActive(false);
      if (options?.showRatingModal !== false) setShowRating(true);

      const durationSeconds = Math.max(
        0,
        Math.round((Date.now() - info.startedAt) / 1000),
      );
      const finalMinutes = Math.max(1, Math.ceil(durationSeconds / 60));
      const fallbackCost = finalMinutes * (info.pricePerMin || pricePerMin);
      setSessionReceipt({ durationSeconds, cost: fallbackCost });

      // Final billing is server-side so users cannot bypass Firestore rules.
      if (user) {
        try {
          const idToken = await user.getIdToken();
          const res = await fetch("/api/consult/end", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              idToken,
              sessionId: info.sessionId,
              messageCount: messagesRef.current.length,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || "Billing failed");
          setSessionReceipt({
            durationSeconds: data.durationSeconds,
            cost: data.cost,
          });
          const language = info.preferredLanguage || preferredLanguage;
          sessionStorage.removeItem(
            getConsultSessionStorageKey(persona.id, language),
          );
          sessionStorage.removeItem(
            getConsultTranscriptStorageKey(persona.id, language),
          );
        } catch (err: any) {
          console.error("Failed to finalize consultation billing:", err);
          // Never clobber a 402 "time is up" message — it carries the
          // "Add time" CTA the user needs on exactly this path.
          setBillingError((prev) =>
            prev === TIME_UP_MSG
              ? prev
              : err.message || "Could not finalize billing for this session.",
          );
        }
      }
    },
    [user, persona, preferredLanguage, pricePerMin],
  );

  // The server said this session no longer exists / is closed — stop the meter
  // locally without re-billing. No client-guessed receipt: the server settled
  // (or waived) the charge when it closed the session.
  const markSessionClosed = useCallback(() => {
    sessionEndedRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    setSessionActive(false);
    setClosedByServer(true);
    setSessionReceipt(null);
    if (persona) {
      const language =
        sessionInfoRef.current?.preferredLanguage || preferredLanguage;
      sessionStorage.removeItem(
        getConsultSessionStorageKey(persona.id, language),
      );
      sessionStorage.removeItem(
        getConsultTranscriptStorageKey(persona.id, language),
      );
    }
  }, [persona, preferredLanguage]);

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
    if (!content || !sessionActive || isStreaming || sendingRef.current) return;
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    sendingRef.current = true;
    setSendError(null);
    setReplyAnnouncement("");

    // First message starts the meter; later messages reuse the session.
    const info = await ensureSession();
    if (!info) {
      // Start failed / conflict card is showing — keep the draft so nothing
      // the user typed is lost.
      sendingRef.current = false;
      return;
    }

    const userMsg: ChatMessage = { role: "user", content };
    setMessages((prev) => [...prev, userMsg]);
    persistMessage(info.sessionId, "user", content);
    if (preset === undefined) setInput("");
    setIsStreaming(true);

    const controller = new AbortController();
    streamAbortRef.current = controller;

    try {
      const idToken = await user.getIdToken();
      idTokenRef.current = idToken;
      const res = await fetch("/api/consult/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          sessionId: info.sessionId,
          messages: [...messages, userMsg],
          birthData,
          kundaliData,
          previousInteractionId: interactionId,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        // Surface the server's message (e.g. 402 "time is up — top up").
        const errData = await res.json().catch(() => ({}));
        const httpError = new Error(
          errData.error || "Request failed",
        ) as Error & { status?: number };
        httpError.status = res.status;
        throw httpError;
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
        let contentReplaced = false;
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let data: any;
          try {
            data = JSON.parse(line.slice(6));
          } catch {
            continue; // skip malformed SSE lines
          }
          if (data.type === "delta") {
            chunkText += data.text;
          } else if (data.type === "done") {
            // Reply complete — re-enable input now; the trailing `brain`
            // event is optional bookkeeping and must not hold the composer.
            if (typeof data.interactionId === "string" && data.interactionId) {
              setInteractionId(data.interactionId);
            }
            if (typeof data.content === "string" && data.content) {
              fullContent = data.content;
              chunkText = "";
              contentReplaced = true;
            }
            // Fully re-open the composer here: the send guard must not stay
            // held through the trailing brain work.
            sendingRef.current = false;
            setIsStreaming(false);
            setReplyAnnouncement("Reply received");
          } else if (data.type === "brain") {
            // Optional trailing event — nothing rendered for it here.
          } else if (data.type === "error") {
            // A mid-stream server error (e.g. Gemini failure) must surface —
            // otherwise the reply silently stalls while the meter keeps running.
            throw new Error(data.error || "The consultation was interrupted.");
          }
        }
        fullContent += chunkText;
        // Skip no-op iterations (e.g. the trailing brain event): once `done`
        // re-opened the composer, a new user message may already be last in
        // the transcript, and an unconditional write would append a duplicate
        // assistant bubble after it.
        if (!chunkText && !contentReplaced) continue;
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
        persistMessage(info.sessionId, "assistant", fullContent);
      }
    } catch (err) {
      if (controller.signal.aborted) {
        // Session ended or page left mid-reply — nothing to surface.
        return;
      }
      const status =
        err instanceof Error && typeof (err as any).status === "number"
          ? ((err as any).status as number)
          : undefined;
      const msg =
        err instanceof Error && err.message
          ? err.message
          : "Connection issue. Please try again.";
      if (status === 402) {
        // Funded time exhausted server-side — finalize billing and show the
        // ended state with a top-up path instead of a rating prompt.
        setBillingError(TIME_UP_MSG);
        endSession({ showRatingModal: false });
      } else if (status === 409 || status === 404) {
        markSessionClosed();
      } else {
        // 429 and everything else: show the server's own words.
        setSendError(msg);
      }
    } finally {
      // Only the invocation that still owns the stream may reset shared
      // send state — after an early `done`, a NEW send can already be in
      // flight while this stream drains its brain event, and its state must
      // not be stomped when the old stream closes.
      if (streamAbortRef.current === controller) {
        streamAbortRef.current = null;
        sendingRef.current = false;
        setIsStreaming(false);
      }
    }
  };

  // Bill on leave. One flush shared by the pagehide handler (tab close /
  // refresh — storage kept so the sitting resumes) and the SPA-unmount cleanup
  // (in-app navigation — storage cleared, the sitting is over). fetch() is
  // unreliable during unload, so prefer a beacon; the scheduled reaper is the
  // server-side backstop if even this doesn't land.
  const flushEndOnLeave = useCallback(
    (opts?: { clearStored?: boolean }) => {
      if (sessionEndedRef.current) return;
      const info = sessionInfoRef.current;
      const token = idTokenRef.current;
      if (!info || !token) return;
      sessionEndedRef.current = true;
      const body = JSON.stringify({
        idToken: token,
        sessionId: info.sessionId,
        messageCount: messagesRef.current.length,
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/consult/end",
          new Blob([body], { type: "application/json" }),
        );
      } else {
        fetch("/api/consult/end", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
      }
      if (opts?.clearStored && persona) {
        const language = info.preferredLanguage || preferredLanguage;
        sessionStorage.removeItem(
          getConsultSessionStorageKey(persona.id, language),
        );
        sessionStorage.removeItem(
          getConsultTranscriptStorageKey(persona.id, language),
        );
      }
    },
    [persona, preferredLanguage],
  );
  const flushEndRef = useRef(flushEndOnLeave);
  useEffect(() => {
    flushEndRef.current = flushEndOnLeave;
  }, [flushEndOnLeave]);

  useEffect(() => {
    const onPageHide = () => flushEndRef.current();
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, []);

  // End the meter on SPA navigation away (back button, route change).
  // StrictMode double-invokes effects in dev, so the actual end is deferred a
  // tick and the immediate re-run cancels it — only a real unmount fires it.
  useEffect(() => {
    if (pendingLeaveTimerRef.current !== null) {
      clearTimeout(pendingLeaveTimerRef.current);
      pendingLeaveTimerRef.current = null;
    }
    leftRef.current = false;
    return () => {
      pendingLeaveTimerRef.current = setTimeout(() => {
        pendingLeaveTimerRef.current = null;
        leftRef.current = true;
        streamAbortRef.current?.abort();
        flushEndRef.current({ clearStored: true });
      }, 0);
    };
  }, []);

  // Honest auto-end: only once the wallet-funded time is actually used up —
  // never a minute early. fundedSeconds tracks the live balance, so a mid-
  // session top-up extends the sitting automatically.
  useEffect(() => {
    if (!user || creditsLoading || !sessionInfo || !sessionActive) return;
    if (elapsedSeconds >= fundedSeconds) {
      endSession();
    }
  }, [
    creditsLoading,
    elapsedSeconds,
    endSession,
    fundedSeconds,
    sessionActive,
    sessionInfo,
    user,
  ]);

  // Rating modal focus: land on the first star when it opens, and hand focus
  // back to whatever triggered it (End / back button) when it closes.
  useEffect(() => {
    if (!showRating) return;
    const returnFocusTo =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const t = setTimeout(() => firstStarRef.current?.focus(), 50);
    return () => {
      clearTimeout(t);
      // Best effort — the trigger may have unmounted with the session bar.
      if (returnFocusTo?.isConnected) returnFocusTo.focus();
    };
  }, [showRating]);

  const handleRatingKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setShowRating(false);
      return;
    }
    if (e.key !== "Tab" || !ratingModalRef.current) return;
    const focusable = ratingModalRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // From the server-closed card: reset local session state so the next
  // message lazily opens a fresh meter (transcript stays for continuity).
  const startNewSitting = () => {
    sessionEndedRef.current = false;
    sessionInfoRef.current = null;
    setClosedByServer(false);
    setSessionInfo(null);
    setSessionReceipt(null);
    setBillingError(null);
    setSendError(null);
    setElapsedSeconds(0);
    setInteractionId(undefined);
    setSessionActive(true);
    setShowRating(false);
  };

  const endConflictAndStartHere = async () => {
    if (!user || !activeConflict || conflictEnding) return;
    setConflictEnding(true);
    setConflictError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/consult/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          sessionId: activeConflict.activeSessionId,
          messageCount: 0,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not end the other sitting.");
      }
      // Drop the ended sitting's stored keys (any language) so revisiting
      // that guide lazy-starts instead of auto-opening a fresh billed session
      // from a stale resume id.
      const stalePrefixes = [
        `astroyou:consult-session:${activeConflict.activePersonaId}:`,
        `astroyou:consult-transcript:${activeConflict.activePersonaId}:`,
      ];
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key && stalePrefixes.some((p) => key.startsWith(p))) {
          sessionStorage.removeItem(key);
        }
      }
      setActiveConflict(null);
      await ensureSession();
    } catch (err) {
      setConflictError(
        err instanceof Error && err.message
          ? err.message
          : "Could not end the other sitting.",
      );
    } finally {
      setConflictEnding(false);
    }
  };

  if (!persona) return null;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const conflictPersona = activeConflict
    ? getPersonaById(activeConflict.activePersonaId)
    : undefined;
  const isLowBalance =
    !!sessionInfo &&
    sessionActive &&
    !creditsLoading &&
    fundedSeconds - elapsedSeconds <= 120;
  const canCompose =
    sessionActive &&
    !activeConflict &&
    (!!sessionInfo ||
      (!!user && !creditsLoading && liveCredits >= pricePerMin));
  const displayedDurationSeconds =
    sessionReceipt?.durationSeconds ?? elapsedSeconds;
  const displayedMinutes = Math.max(
    1,
    Math.ceil(displayedDurationSeconds / 60),
  );
  const displayedCost = sessionReceipt?.cost ?? cost;

  return (
    <div className="min-h-[100dvh] bg-bg-app text-white flex flex-col selection:bg-gold/30">
      {/* Screen-reader announcement when a reply finishes streaming. */}
      <span className="sr-only" role="status" aria-live="polite">
        {replyAnnouncement}
      </span>

      {/* ── Session bar ── */}
      <div className="sticky top-0 z-20 bg-bg-app/85 backdrop-blur-xl border-b border-white/5 px-4 py-2.5">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => {
                if (sessionInfo && sessionActive && !sessionEndedRef.current) {
                  endSession();
                } else {
                  navigate("/consult");
                }
              }}
              className="min-h-11 min-w-11 p-2.5 flex items-center justify-center rounded-lg text-white/35 hover:text-gold transition-colors"
              aria-label="Leave session"
            >
              <ArrowLeft size={16} />
            </button>
            <PersonaPortrait persona={persona} size="sm" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <p className="font-display italic text-base leading-tight truncate">
                  {persona.name}
                </p>
                <span className="shrink-0 text-[0.65rem] uppercase tracking-widest border border-white/15 rounded-full px-2 py-0.5 text-white/60">
                  AI guide
                </span>
              </div>
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
              <Clock size={10} className="shrink-0" />
              {sessionInfo ? (
                <>
                  {formatTime(elapsedSeconds)}
                  <span className="text-gold/50">·</span>
                  {cost} cr
                </>
              ) : (
                <span className="font-sans text-[0.65rem] uppercase tracking-wider">
                  Meter starts with your first message
                </span>
              )}
            </div>
            {isLowBalance && (
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
            {sessionActive && sessionInfo && (
              <button
                onClick={() => endSession()}
                className="min-h-11 px-4 rounded-full border border-red-400/25 text-red-300 text-[0.65rem] font-bold uppercase tracking-[0.15em] hover:bg-red-500/10 transition-colors"
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
                  disabled={isStreaming || !canCompose}
                  className="px-4 py-2 rounded-full border border-white/10 text-xs text-white/45 hover:text-gold hover:border-gold/30 transition-colors disabled:opacity-40"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {messages.map((msg, i) => (
            <ConsultMessageRow
              key={i}
              role={msg.role}
              content={msg.content}
              isStreaming={
                isStreaming &&
                i === messages.length - 1 &&
                msg.role === "assistant"
              }
              accent={accent}
            />
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

          {/* Another sitting's meter is already running (409 from start). */}
          {activeConflict && (
            <div className="max-w-sm mx-auto my-6 rounded-3xl border border-white/10 bg-white/3 backdrop-blur-xl p-6 text-center">
              <p className="text-sm text-white/80">
                You have a sitting in progress with{" "}
                {conflictPersona?.name ?? "another guide"}.
              </p>
              <p className="mt-2 text-xs text-white/40">
                Only one meter can run at a time.
              </p>
              {conflictError && (
                <p className="mt-3 text-xs text-red-400">{conflictError}</p>
              )}
              <div className="mt-5 space-y-2">
                <button
                  onClick={() =>
                    navigate(`/consult/${activeConflict.activePersonaId}/chat`)
                  }
                  className="w-full min-h-11 px-4 py-2.5 rounded-xl bg-gold text-black text-[0.65rem] font-bold uppercase tracking-[0.2em] hover:bg-gold/90 transition-colors"
                >
                  Resume
                </button>
                <button
                  onClick={endConflictAndStartHere}
                  disabled={conflictEnding}
                  className="w-full min-h-11 px-4 py-2.5 rounded-xl border border-white/15 text-white/70 text-[0.65rem] font-bold uppercase tracking-[0.2em] hover:border-gold/30 hover:text-gold transition-colors disabled:opacity-50"
                >
                  {conflictEnding ? "Ending…" : "End it and start here"}
                </button>
              </div>
            </div>
          )}

          {/* Server closed the sitting out-of-band — no receipt to show. */}
          {closedByServer && (
            <div className="max-w-sm mx-auto my-6 rounded-3xl border border-white/10 bg-white/3 backdrop-blur-xl p-6 text-center">
              <div className="flex justify-center">
                <PersonaPortrait persona={persona} />
              </div>
              <p className="text-sm text-white/80 mt-3">{SESSION_CLOSED_MSG}</p>
              <p className="mt-2 text-xs text-white/40">
                The meter has stopped; anything owed was settled when it closed.
              </p>
              <button
                onClick={startNewSitting}
                className="mt-5 w-full min-h-11 px-4 py-2.5 rounded-xl bg-gold text-black text-[0.65rem] font-bold uppercase tracking-[0.2em] hover:bg-gold/90 transition-colors"
              >
                Start a new sitting
              </button>
            </div>
          )}

          {!sessionActive &&
            !sessionInfo &&
            !closedByServer &&
            billingError && (
              <div className="max-w-sm mx-auto my-6 rounded-3xl border border-white/10 bg-white/3 backdrop-blur-xl p-6 text-center">
                <div className="flex justify-center">
                  <PersonaPortrait persona={persona} />
                </div>
                <p className="text-sm text-white/80 mt-3">
                  The sitting could not begin.
                </p>
                <p className="mt-2 text-xs text-white/40">{billingError}</p>
                {paymentError && (
                  <p className="mt-2 text-xs text-red-400">{paymentError}</p>
                )}
                {billingError === INSUFFICIENT_CREDITS_MSG && (
                  <button
                    onClick={() => buyCredits(DEFAULT_CREDIT_PACK.minutes)}
                    disabled={isPaying}
                    className="mt-5 w-full min-h-11 px-4 py-2.5 rounded-xl bg-gold text-black text-[0.65rem] font-bold uppercase tracking-[0.2em] hover:bg-gold/90 transition-colors disabled:opacity-50"
                  >
                    {isPaying ? "Opening…" : "Add time"}
                  </button>
                )}
                <button
                  onClick={() => navigate(`/consult/${persona.id}/profile`)}
                  className="mt-3 w-full min-h-11 px-4 py-2.5 rounded-xl border border-gold/30 text-gold text-[0.65rem] font-bold uppercase tracking-[0.2em] hover:bg-gold hover:text-black transition-colors"
                >
                  Back to dossier
                </button>
              </div>
            )}

          {!sessionActive && sessionInfo && !closedByServer && (
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
              {paymentError && (
                <p className="mt-2 text-xs text-red-400">{paymentError}</p>
              )}
              {billingError === TIME_UP_MSG && (
                <button
                  onClick={() => buyCredits(DEFAULT_CREDIT_PACK.minutes)}
                  disabled={isPaying}
                  className="mt-4 w-full min-h-11 px-4 py-2.5 rounded-xl bg-gold text-black text-[0.65rem] font-bold uppercase tracking-[0.2em] hover:bg-gold/90 transition-colors disabled:opacity-50"
                >
                  {isPaying ? "Opening…" : "Add time"}
                </button>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Input ── */}
      {sessionActive && (
        <div className="sticky bottom-0 bg-bg-app/85 backdrop-blur-xl border-t border-white/5 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {paymentError && (
            <div className="max-w-3xl mx-auto mb-3 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {paymentError}
            </div>
          )}
          {sendError && (
            <div
              role="alert"
              className="max-w-3xl mx-auto mb-3 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 flex items-start gap-2 text-sm text-red-200"
            >
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <span>{sendError}</span>
            </div>
          )}
          {isLowBalance && (
            <div
              role="status"
              aria-live="polite"
              className="max-w-3xl mx-auto mb-3 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 flex items-center justify-between gap-3"
            >
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
                className="shrink-0 min-h-11 px-3 py-1.5 rounded-lg bg-gold text-black text-[0.65rem] font-bold uppercase tracking-[0.15em]"
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
                disabled={isStreaming || !canCompose}
              />
              <button
                onClick={() => sendMessage()}
                disabled={isStreaming || !input.trim() || !canCompose}
                className={`shrink-0 min-h-11 min-w-11 p-2 flex items-center justify-center rounded-xl transition-all ${
                  input.trim() && canCompose
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

      {/* ── Guest sign-in ── */}
      <AuthModal
        isOpen={showAuthModal && !user}
        onClose={() => {
          // AuthModal calls onClose after a successful sign-in too — only a
          // real dismissal (still signed out) should leave the chat.
          if (firebaseAuth.currentUser) {
            setShowAuthModal(false);
          } else {
            navigate(`/consult/${persona.id}`);
          }
        }}
        onSuccess={() => setShowAuthModal(false)}
        title="Sign in to begin your sitting"
        message="New here? You start with 15 free credits — enough for a first conversation with any guide."
      />

      {/* ── Rating ── */}
      {showRating && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onKeyDown={handleRatingKeyDown}
        >
          <div
            ref={ratingModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="consult-rating-title"
            className="bg-[#0a0a12] border border-white/10 rounded-3xl p-8 max-w-sm w-full text-center"
          >
            <p
              id="consult-rating-title"
              className="font-display italic text-2xl mb-1"
            >
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
                  ref={star === 1 ? firstStarRef : undefined}
                  onClick={() => setSelectedRating(star)}
                  className={`min-h-11 min-w-11 text-2xl hover:scale-125 transition-transform ${
                    star <= selectedRating ? "opacity-100" : "opacity-30"
                  }`}
                  aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                  aria-pressed={star <= selectedRating}
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
              className="w-full py-3 min-h-11 rounded-xl bg-gold text-black text-[0.65rem] font-bold uppercase tracking-[0.2em] hover:bg-gold/90 transition-colors disabled:opacity-50"
            >
              {reviewSubmitting ? "Saving…" : "Done"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
