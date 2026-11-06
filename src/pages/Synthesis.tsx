import {
  Suspense,
  lazy,
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Send,
  Clock,
  Loader2,
  Sparkles,
  ChevronLeft,
  ArrowDown,
  Download,
  Save,
  Share2,
  Wind,
  RotateCcw,
  X,
  CalendarClock,
  BookHeart,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import ChartShareModal from "../components/ChartShareModal";
import AuthModal from "../components/AuthModal";
import OnboardingModal from "../components/OnboardingModal";
import { useAuth } from "../lib/useAuth";
import { useUserProfile, useKundali } from "../hooks";
import { useSubscription } from "../hooks/useSubscription";
import {
  doc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  setDoc,
  query,
  orderBy,
  limit,
  limitToLast,
  onSnapshot,
  getDoc,
  getDocs,
  serverTimestamp,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { postJson } from "../lib/apiFetch";
import { trackAcquisitionEvent } from "../lib/acquisition";
import { useCreditTopup } from "../hooks/useCreditTopup";
import { useCurrency } from "../hooks/useCurrency";
import { DEFAULT_CREDIT_PACK, getPackAmount } from "../lib/credit-packs";
import { formatMoney } from "../lib/currency";
import { AtmanService } from "../lib/atman";
import { recordPracticeSession } from "../lib/practice-streak";
import { isAnxiousMessage, isRelationshipMessage } from "../lib/chat-intent";
import { MemoryManager } from "../components/memory/MemoryManager";
import { COMPATIBILITY_CONTEXT_KEY } from "../components/layout/AskJyotishBridge";
import { SynthesisSEO } from "../components/SEO";
import Kundali from "../components/astrology/Kundali";
import { downloadChart } from "../lib/chartStorage";
import { useConsciousness } from "../hooks/useConsciousness";
import { PranaOverlay } from "../components/prana/PranaOverlay";
import { DharmaList } from "../components/dharma/DharmaList";
import { RoutineProposal } from "../components/dharma/RoutineProposal";
import { DailyAltar } from "../components/sadhana/DailyAltar";
import ConversationsList from "../components/synthesis/ConversationsList";
import {
  BlueprintPanelControls,
  BlueprintToggleButton,
  ChartTypeSelector,
  ComposerVoiceButton,
  ConversationPanelHeader,
  SynthesisComposerTextarea,
  SynthesisPanelLaunchers,
  appendDictationTranscript,
} from "../components/synthesis/ConversationsListView";
import MessageBubble from "../components/synthesis/MessageBubble";
import { NightSky } from "../components/layout/NightSky";
import type { UserRoutine } from "../types/user";
import { STORAGE_KEYS, FREE_LIMIT_SECONDS } from "../lib/constants";
import { parseCompletedBirthProfile } from "../lib/profile-readiness";
import {
  getDefaultSynthesisRails,
  SYNTHESIS_MESSAGE_SPACING_CLASS,
  SYNTHESIS_PANEL_SURFACE_CLASS,
} from "../lib/synthesis-layout";
import { useErrorToast, useSuccessToast } from "../components/ui/toast-context";
import {
  hasVisibleStreamingContent,
  mergeSynthesisMessages,
  type SynthesisMessage,
} from "../lib/synthesis-messages";

type Message = SynthesisMessage;

interface SpeechRecognitionResultEventLike extends Event {
  results: ArrayLike<{
    0: { transcript: string };
    isFinal: boolean;
  }>;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return (
    speechWindow.SpeechRecognition ||
    speechWindow.webkitSpeechRecognition ||
    null
  );
}

const CelestialChart = lazy(
  () => import("../components/astrology/CelestialChart"),
);

const OPENING_QUESTIONS = [
  "What does my current dasha ask of me?",
  "Why does this week feel heavy?",
  "Something's weighing on my heart about a relationship",
  "When is a good time to start something new?",
];

// COMPATIBILITY_CONTEXT_KEY is written by the Compatibility page
// (AskJyotishBridge) and consumed once, by the next message.
const COMPATIBILITY_CONTEXT_MAX_AGE_MS = 2 * 60 * 60 * 1000;

/** Returns a fresh compatibility summary, dropping stale or corrupt entries. */
function readCompatibilityContext(): string | null {
  try {
    const raw = sessionStorage.getItem(COMPATIBILITY_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      summary?: unknown;
      createdAt?: unknown;
    };
    const fresh =
      typeof parsed.createdAt === "number" &&
      Date.now() - parsed.createdAt < COMPATIBILITY_CONTEXT_MAX_AGE_MS;
    if (fresh && typeof parsed.summary === "string" && parsed.summary.trim()) {
      return parsed.summary;
    }
    sessionStorage.removeItem(COMPATIBILITY_CONTEXT_KEY);
  } catch {
    /* storage unavailable or corrupt JSON — no context */
  }
  return null;
}

function clearCompatibilityContext() {
  try {
    sessionStorage.removeItem(COMPATIBILITY_CONTEXT_KEY);
  } catch {
    /* ignore */
  }
}

const MEMORY_NOTICE_KEY_PREFIX = "astroyou.memoryNoticeDismissed.";

function readMemoryNoticeDismissed(uid: string): boolean {
  try {
    return localStorage.getItem(MEMORY_NOTICE_KEY_PREFIX + uid) === "1";
  } catch {
    return false;
  }
}

/**
 * Guest timer: a second only counts when the guest is actually using the chat
 * — the tab is visible AND either a reply is in flight or they typed within
 * this window. An idle or backgrounded tab no longer burns their 10 minutes.
 */
const GUEST_ACTIVE_TYPING_WINDOW_MS = 60_000;

/** Server keepalive events carry no content and must never reach the UI. */
const KEEPALIVE_EVENT_TYPES = new Set(["keepalive", "heartbeat", "ping"]);

const CHECK_IN_DELAY_MS = 3 * 24 * 60 * 60 * 1000;

/** The calm copy shown in place of any raw gateway / server error body. */
const QUIET_SKY_MESSAGE =
  "The sky went quiet for a moment — your question is safe. Try again";

interface SendFailure {
  /** The exact question that failed, resent verbatim by Retry. */
  content: string;
  clientId: string;
  /** Whether the user turn already reached Firestore (signed-in only). */
  persisted: boolean;
  /** The chat the failed turn belongs to. */
  chatId: string | null;
  message: string;
}

interface SendOptions {
  /** Resend a failed turn without adding a second user bubble. */
  retryOf?: SendFailure;
}

const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";

const getIsDesktopViewport = () =>
  typeof window !== "undefined" &&
  window.matchMedia(DESKTOP_MEDIA_QUERY).matches;

const CHAT_TITLE_MAX_CHARS = 40;
/** First-message chat title; the ellipsis is appended only when truncated. */
const makeChatTitle = (text: string) => {
  const trimmed = text.trim();
  return trimmed.length > CHAT_TITLE_MAX_CHARS
    ? `${trimmed.slice(0, CHAT_TITLE_MAX_CHARS).trimEnd()}…`
    : trimmed;
};

/** Auto-scroll only while the reader is this close to the latest message. */
const NEAR_BOTTOM_THRESHOLD_PX = 120;
/** Firestore batched writes cap at 500 operations; stay comfortably under. */
const DELETE_BATCH_SIZE = 400;
/** Cap the live message subscription — very long chats keep the newest turns. */
const MESSAGE_WINDOW = 200;

class SendError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "SendError";
    this.status = status;
  }
}

/**
 * Turn a non-OK response into a short, human message. Gateways (e.g. a 504
 * "Inactivity Timeout") return HTML — that must never be shown as text, so
 * only a JSON `error` string from our own function is surfaced.
 */
async function readSendError(response: Response): Promise<SendError> {
  let message = QUIET_SKY_MESSAGE;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      const body = (await response.json()) as { error?: unknown };
      if (
        typeof body.error === "string" &&
        body.error.trim() &&
        body.error.length < 300 &&
        !/<[a-z!/]/i.test(body.error)
      ) {
        message = body.error;
      }
    } catch {
      /* unparseable — keep the calm default */
    }
  }
  return new SendError(message, response.status);
}

/** An `error` event delivered inside the SSE stream by our own function. */
class StreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StreamError";
  }
}

const isKundaliRateLimited = (error: string | null) =>
  Boolean(error && /429|too many/i.test(error));

export default function Synthesis() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const showError = useErrorToast();
  const showSuccess = useSuccessToast();

  const [birthData, setBirthData] = useState<any>(null);
  // Active paid subscribers get unmetered chat server-side, so the client must
  // not paywall them at 0 credits (it would contradict the "unlimited" promise).
  const { isSubscribed } = useSubscription();

  // Atman Integration
  const { isAnxious, isChaotic, isReactive, atmanState, refreshAtman } =
    useConsciousness();
  const [showPrana, setShowPrana] = useState(false);
  // Breathing opened by hand (Breathe button / offer chip) always starts calm.
  const [pranaManual, setPranaManual] = useState(false);
  // Gentle "breathe first?" chip after an anxious-sounding message.
  const [showBreathOffer, setShowBreathOffer] = useState(false);
  const [showAltar, setShowAltar] = useState(false);
  const [suggestedRoutine, setSuggestedRoutine] = useState<UserRoutine | null>(
    null,
  );

  // Trigger Prana if Anxious/Chaotic/Reactive is detected (with 30-min cooldown)
  useEffect(() => {
    if (isAnxious || isChaotic || isReactive) {
      const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
      const lastShown = sessionStorage.getItem("astroyou_prana_last");
      const now = Date.now();
      if (!lastShown || now - parseInt(lastShown) > COOLDOWN_MS) {
        setShowPrana(true);
        sessionStorage.setItem("astroyou_prana_last", now.toString());
      }
    }
  }, [isAnxious, isChaotic, isReactive]);

  // Use centralized hooks for data access
  const [currentChartType, setCurrentChartType] = useState<"D1" | "D9">("D1");
  const {
    profile,
    birthData: hookBirthData,
    loading: isLoadingProfile,
  } = useUserProfile();
  // One chart fetch for everyone: `birthData` is the unified source (Firestore
  // profile for signed-in users, session storage for guests), so guests no
  // longer trigger a second ad-hoc /api/kundali request on top of this one.
  const {
    kundaliData: hookKundaliData,
    loading: isLoadingHookKundali,
    error: kundaliError,
  } = useKundali(birthData, currentChartType);
  // The hook keeps its last successful chart when birth data disappears
  // (e.g. sign-out into an empty guest session) — never show it in that case.
  const kundaliData = birthData ? hookKundaliData : null;
  const isLoadingKundali = Boolean(birthData) && isLoadingHookKundali;
  const kundaliRateLimited = isKundaliRateLimited(kundaliError);

  // Local state - needed for guest mode and chat functionality
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(id || null);
  // Seeded from the Dashboard's "Ask Jyotish" bar, which stashes the typed
  // question in sessionStorage before navigating here.
  const [input, setInput] = useState(() => {
    const draft = sessionStorage.getItem(STORAGE_KEYS.SYNTHESIS_DRAFT) || "";
    if (draft) sessionStorage.removeItem(STORAGE_KEYS.SYNTHESIS_DRAFT);
    return draft;
  });
  const [secondsUsed, setSecondsUsed] = useState(0);
  const [credits, setCredits] = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const { buyCredits, isPaying, error: topupError } = useCreditTopup();
  const { currency } = useCurrency();
  // Inline calm failure state with a Retry for the exact failed question.
  const [sendFailure, setSendFailure] = useState<SendFailure | null>(null);
  // "Check in with me in 3 days" offer after a heavy-hearted reply.
  const [checkInOffer, setCheckInOffer] = useState<{
    question: string;
    category: "relationship" | "health";
  } | null>(null);
  const [checkInScheduled, setCheckInScheduled] = useState<string | null>(null);
  const [showMemoryNotice, setShowMemoryNotice] = useState(false);
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);
  // Shown in-thread when a signed-in user tries to send with no credits left.
  const [showCreditsNotice, setShowCreditsNotice] = useState(false);
  // Visually-hidden live region so screen readers hear when a reply lands.
  const [replyAnnouncement, setReplyAnnouncement] = useState("");
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  // Rails are in-flow on desktop and modal drawers on smaller viewports.
  // Keep the state synchronized when the viewport crosses the breakpoint.
  const [isDesktopViewport, setIsDesktopViewport] =
    useState(getIsDesktopViewport);
  // Lazy: this is only ever read at mount, and computing it means a
  // matchMedia() call — don't pay for it on every render.
  const [initialRails] = useState(() =>
    getDefaultSynthesisRails(isDesktopViewport, Boolean(user)),
  );
  const [showConversations, setShowConversations] = useState(
    initialRails.conversations,
  );
  const [showBlueprint, setShowBlueprint] = useState(initialRails.blueprint);
  const [showExpandedChart, setShowExpandedChart] = useState(false);
  const [interactionId, setInteractionId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const isDictationSupported = getSpeechRecognitionConstructor() !== null;
  const scrollRef = useRef<HTMLDivElement>(null);
  const conversationsToggleRef = useRef<HTMLButtonElement>(null);
  const blueprintToggleRef = useRef<HTMLButtonElement>(null);
  const conversationsPanelRef = useRef<HTMLElement>(null);
  const blueprintPanelRef = useRef<HTMLElement>(null);
  const conversationsCloseRef = useRef<HTMLButtonElement>(null);
  const blueprintCloseRef = useRef<HTMLButtonElement>(null);
  const prevChatIdRef = useRef<string | null>(null); // Track previous chat ID to detect sidebar navigation
  const pendingMessagesRef = useRef<Message[]>([]);
  // Latest-value mirrors so async send/migration code can check state without
  // closing over a stale render.
  const currentChatIdRef = useRef<string | null>(id || null);
  const messagesRef = useRef<Message[]>([]);
  // In-flight send bookkeeping: one request at a time, abortable, and pinned
  // to the chat it was sent from.
  const sendAbortRef = useRef<AbortController | null>(null);
  const sendChatIdRef = useRef<string | null>(null);
  const sendingRef = useRef(false);
  // Streaming deltas accumulate here and flush to state once per frame.
  const streamBufferRef = useRef("");
  const streamFrameRef = useRef<number | null>(null);
  const isNearBottomRef = useRef(true);
  const composerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const replyAnnounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const guestMigrationRef = useRef(false);
  // Previous auth uid, so the guest-turn migration only fires on an actual
  // guest → signed-in transition (not on "New conversation" resets).
  const prevUidRef = useRef<string | null>(null);
  // Last time the guest typed in the composer (drives the active-time timer).
  const lastTypedAtRef = useRef(0);
  // A failed question auto-restored into the empty composer. Selected on
  // restore so the next keystroke replaces it instead of appending to it.
  const restoredDraftRef = useRef<string | null>(null);

  // Resetting both rails to their defaults is a visible jolt (an open drawer
  // snaps shut), so this must only re-run on things that actually change the
  // defaults: the viewport crossing the breakpoint, and signing in or out.
  // Depending on `user` itself re-ran it on every new user object — a token
  // refresh alone was enough to close a drawer mid-read.
  const isSignedIn = Boolean(user);
  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const syncLayout = (matches: boolean) => {
      const next = getDefaultSynthesisRails(matches, isSignedIn);
      setIsDesktopViewport(matches);
      setShowConversations(next.conversations);
      setShowBlueprint(next.blueprint);
    };
    const handleChange = (event: MediaQueryListEvent) =>
      syncLayout(event.matches);

    syncLayout(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [isSignedIn]);

  const closeConversations = useCallback(
    (restoreFocus = false) => {
      setShowConversations(false);
      if (restoreFocus && !isDesktopViewport) {
        requestAnimationFrame(() => conversationsToggleRef.current?.focus());
      }
    },
    [isDesktopViewport],
  );

  const closeBlueprint = useCallback(
    (restoreFocus = false) => {
      setShowBlueprint(false);
      if (restoreFocus && !isDesktopViewport) {
        requestAnimationFrame(() => blueprintToggleRef.current?.focus());
      }
    },
    [isDesktopViewport],
  );

  const toggleConversations = () => {
    const willOpen = !showConversations;
    setShowConversations(willOpen);
    if (willOpen && !isDesktopViewport) setShowBlueprint(false);
  };

  const toggleBlueprint = () => {
    const willOpen = !showBlueprint;
    setShowBlueprint(willOpen);
    if (willOpen && !isDesktopViewport) setShowConversations(false);
  };

  const toggleDictation = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      return;
    }

    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = navigator.language || "en-IN";
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      recognitionRef.current = null;
      const permissionDenied =
        event.error === "not-allowed" || event.error === "service-not-allowed";
      showError(
        permissionDenied ? "Microphone Access Needed" : "Dictation Unavailable",
        permissionDenied
          ? "Allow microphone access in your browser, then try again."
          : "Voice dictation could not start. Please try again.",
      );
    };
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result?.isFinal) transcript += result[0]?.transcript || "";
      }
      if (!transcript.trim()) return;
      setInput((current) => appendDictationTranscript(current, transcript));
      requestAnimationFrame(() => composerRef.current?.focus());
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      showError(
        "Dictation Unavailable",
        "Voice dictation could not start. Please try again.",
      );
    }
  }, [isListening, showError]);

  useEffect(
    () => () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (isDesktopViewport) return;

    const activePanel = showConversations
      ? conversationsPanelRef.current
      : showBlueprint
        ? blueprintPanelRef.current
        : null;
    const firstControl = showConversations
      ? conversationsCloseRef.current
      : blueprintCloseRef.current;
    if (!activePanel) return;

    requestAnimationFrame(() => firstControl?.focus());
    const handleDrawerKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (showConversations) closeConversations(true);
        else closeBlueprint(true);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        activePanel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("inert"));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleDrawerKeyDown);
    return () => document.removeEventListener("keydown", handleDrawerKeyDown);
  }, [
    closeBlueprint,
    closeConversations,
    isDesktopViewport,
    showBlueprint,
    showConversations,
  ]);

  // P0: Load recent chat summaries for guru's diary (last 3 chats with summaries)
  const loadRecentSummaries = useCallback(async () => {
    if (!user) return [];
    try {
      const chatsQuery = query(
        collection(db, "users", user.uid, "chats"),
        orderBy("lastUpdatedAt", "desc"),
        limit(4), // Fetch 4 to skip current chat
      );
      const snapshot = await getDocs(chatsQuery);
      return snapshot.docs
        .filter((d) => d.data().summary && d.id !== currentChatId)
        .slice(0, 3)
        .map((d) => ({
          title: d.data().title || "Untitled",
          summary: d.data().summary,
          date: d.data().lastUpdatedAt?.toDate()?.toLocaleDateString() || "",
        }));
    } catch (err) {
      console.error("[Synthesis] Failed to load summaries:", err);
      return [];
    }
  }, [user, currentChatId]);

  const welcomeName = user
    ? profile?.name || user.displayName || user.email?.split("@")[0] || ""
    : "";
  const welcomeMessage = useMemo<Message>(
    () => ({
      id: "welcome",
      role: "assistant",
      content: `${welcomeName ? `Hello ${welcomeName}.` : "Welcome."} I am your personal Jyotish, your guide to Vedic insights.`,
      timestamp: new Date(),
    }),
    [welcomeName],
  );

  // 1. Sync logged-in user data to local state
  useEffect(() => {
    if (hookBirthData) {
      setBirthData(hookBirthData);
    }
  }, [hookBirthData]);

  // Sync credits from profile. The server charges before generation and this
  // snapshot is the authoritative balance — the client never decrements.
  useEffect(() => {
    if (profile) {
      setCredits(profile.credits || 0);
    }
  }, [profile]);

  useEffect(() => {
    if (credits > 0 || isSubscribed) setShowCreditsNotice(false);
  }, [credits, isSubscribed]);

  // 2. Handle guest data and onboarding trigger
  useEffect(() => {
    if (isLoadingProfile) return;

    if (!user) {
      const guest = parseCompletedBirthProfile(
        sessionStorage.getItem(STORAGE_KEYS.GUEST_PROFILE),
        sessionStorage.getItem(STORAGE_KEYS.GUEST_COMPLETE),
      );

      if (guest) {
        setBirthData(guest);
        setShowOnboardingModal(false);
      } else {
        setBirthData(null);
        setShowOnboardingModal(true);
      }
    } else if (!hookBirthData) {
      // Logged in but no profile data found in Firestore
      setShowOnboardingModal(true);
    }
  }, [user, isLoadingProfile, hookBirthData]);

  const handleOnboardingComplete = () => {
    // For guest users, we need to manually pick up the data from sessionStorage
    if (!user) {
      const guest = parseCompletedBirthProfile(
        sessionStorage.getItem(STORAGE_KEYS.GUEST_PROFILE),
        sessionStorage.getItem(STORAGE_KEYS.GUEST_COMPLETE),
      );
      if (guest) {
        setBirthData(guest);
      }
    }
    // For logged-in users, useUserProfile's onSnapshot will auto-update hookBirthData
  };

  // Surface chart failures with the real cause. Keyed on the error string only:
  // useKundali resets it before every retry, so each failure announces once.
  const kundaliErrorContextRef = useRef({
    isGuest: !user,
    chartType: currentChartType,
  });
  useEffect(() => {
    kundaliErrorContextRef.current = {
      isGuest: !user,
      chartType: currentChartType,
    };
  }, [user, currentChartType]);
  useEffect(() => {
    if (!kundaliError) return;
    const { isGuest, chartType } = kundaliErrorContextRef.current;
    if (isKundaliRateLimited(kundaliError)) {
      showError(
        "Chart is rate-limited",
        "Try again in a few minutes — your birth details are fine.",
      );
      return;
    }
    if (isGuest && chartType !== "D1") {
      // Guest access covers the natal chart only — invite sign-in instead of
      // implying the birth data is wrong.
      setShowAuthModal(true);
      return;
    }
    console.error("Error fetching Kundali:", kundaliError);
    showError(
      "Chart Unavailable",
      isGuest
        ? "We couldn't load your chart right now. Sign in for full access, or try again shortly."
        : "We couldn't load your chart right now. Please try again shortly.",
    );
  }, [kundaliError, showError]);

  // Handle Chat Persistence & Loading
  useEffect(() => {
    // Only reset interaction ID when switching to a DIFFERENT existing chat from sidebar
    // Don't reset when: (1) creating a new chat (prevChatIdRef.current was null), or (2) same chat
    if (
      prevChatIdRef.current !== null &&
      prevChatIdRef.current !== currentChatId
    ) {
      setInteractionId(null);
      pendingMessagesRef.current = [];
    }
    prevChatIdRef.current = currentChatId;
    // Entering a (different) chat always starts pinned to the latest message.
    isNearBottomRef.current = true;
    setShowJumpToLatest(false);

    // Detect the guest → signed-in transition before recording the new uid.
    const wasGuest = prevUidRef.current === null;
    prevUidRef.current = user?.uid ?? null;

    if (!user) {
      guestMigrationRef.current = false;
      pendingMessagesRef.current = [];
      setMessages([welcomeMessage]);
      return;
    }

    if (!currentChatId) {
      if (guestMigrationRef.current) {
        // Migration already in flight — keep the guest turns on screen.
        return;
      }
      // The user just signed in mid-conversation: preserve their guest turns
      // by writing them into a fresh chat doc instead of resetting to the
      // welcome message. Only on a real guest → user transition; a signed-in
      // user starting a "New conversation" must simply get a fresh thread.
      const guestTurns = wasGuest
        ? messagesRef.current.filter((m) => m.id !== "welcome")
        : [];
      if (guestTurns.length > 0) {
        guestMigrationRef.current = true;
        const migrateGuestTurns = async () => {
          try {
            const firstUserTurn = guestTurns.find((m) => m.role === "user");
            const chatRef = await addDoc(
              collection(db, "users", user.uid, "chats"),
              {
                userId: user.uid,
                title: makeChatTitle(
                  firstUserTurn?.content || "Guest conversation",
                ),
                createdAt: serverTimestamp(),
                lastUpdatedAt: serverTimestamp(),
              },
            );
            const batch = writeBatch(db);
            guestTurns.forEach((m) => {
              batch.set(
                doc(
                  collection(
                    db,
                    "users",
                    user.uid,
                    "chats",
                    chatRef.id,
                    "messages",
                  ),
                ),
                {
                  role: m.role,
                  content: m.content,
                  clientId: m.clientId ?? m.id,
                  // Preserve the original ordering of the guest turns.
                  timestamp: Timestamp.fromDate(m.timestamp),
                },
              );
            });
            await batch.commit();
            setCurrentChatId(chatRef.id);
            navigate(`/synthesis/${chatRef.id}`, { replace: true });
            guestMigrationRef.current = false;
          } catch (err) {
            console.error(
              "[Synthesis] Guest conversation migration failed:",
              err,
            );
            guestMigrationRef.current = false;
            setMessages([welcomeMessage]);
          }
        };
        void migrateGuestTurns();
        // Keep the guest turns on screen while they migrate.
        return;
      }
      setMessages([welcomeMessage]);
      return;
    }

    const chatRef = doc(db, "users", user.uid, "chats", currentChatId);
    const unsubscribeChat = onSnapshot(chatRef, (snapshot) => {
      const lastInteractionId = snapshot.data()?.lastInteractionId;
      setInteractionId(
        typeof lastInteractionId === "string" && lastInteractionId.trim()
          ? lastInteractionId
          : null,
      );
    });

    // Load messages for specific chat (windowed: very long chats keep the
    // newest turns instead of subscribing to the full history).
    const q = query(
      collection(db, "users", user.uid, "chats", currentChatId, "messages"),
      orderBy("timestamp", "asc"),
      limitToLast(MESSAGE_WINDOW),
    );

    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date(),
      })) as Message[];

      const mergedMessages = mergeSynthesisMessages(
        welcomeMessage,
        msgs,
        pendingMessagesRef.current,
      );
      pendingMessagesRef.current = mergedMessages.filter(
        (message) => message.pending,
      );

      // Always prepend welcome message so it appears at the start of conversation
      setMessages(mergedMessages);

      // If a new assistant message arrived from Firestore, clear streaming overlay
      // This ensures seamless handoff: streaming bubble → persisted message
      const lastMsg = msgs[msgs.length - 1];
      if (lastMsg?.role === "assistant") {
        setStreamingContent(null);
      }
    });

    return () => {
      unsubscribeChat();
      unsubscribeMessages();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, currentChatId, welcomeMessage]);

  // Keep chat state in lockstep with the URL, including browser back/forward:
  // navigating back to /synthesis must reset to a fresh conversation.
  useEffect(() => {
    setCurrentChatId(id ?? null);
  }, [id]);

  // Latest-value mirrors for async code paths (send completion, migration).
  useEffect(() => {
    currentChatIdRef.current = currentChatId;
  }, [currentChatId]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Abort an in-flight send when the user moves to a different chat…
  useEffect(() => {
    if (sendAbortRef.current && sendChatIdRef.current !== currentChatId) {
      sendAbortRef.current.abort();
    }
  }, [currentChatId]);

  // …and on unmount (also drop any pending streaming flush / announcement).
  useEffect(() => {
    return () => {
      sendAbortRef.current?.abort();
      if (streamFrameRef.current !== null) {
        cancelAnimationFrame(streamFrameRef.current);
        streamFrameRef.current = null;
      }
      if (replyAnnounceTimerRef.current !== null) {
        clearTimeout(replyAnnounceTimerRef.current);
        replyAnnounceTimerRef.current = null;
      }
    };
  }, []);

  // Initialize trial timer from localStorage
  useEffect(() => {
    if (user) return;
    try {
      const saved = Number.parseInt(
        localStorage.getItem(STORAGE_KEYS.FREE_SECONDS) || "",
        10,
      );
      if (Number.isFinite(saved) && saved > 0) setSecondsUsed(saved);
    } catch {
      /* storage blocked — start from zero */
    }
  }, [user]);

  // Guest timer — counts ACTIVE time only. Each tick adds a second only when:
  //   1. the tab is visible, and
  //   2. a reply is in flight (sendingRef covers the request AND the stream),
  //      or the guest typed within the last GUEST_ACTIVE_TYPING_WINDOW_MS.
  // Reading refs inside one long-lived interval keeps this simple: no effect
  // re-subscribes every second.
  useEffect(() => {
    if (user) return;
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const typedRecently =
        Date.now() - lastTypedAtRef.current < GUEST_ACTIVE_TYPING_WINDOW_MS;
      if (!sendingRef.current && !typedRecently) return;
      setSecondsUsed((prev) => Math.min(FREE_LIMIT_SECONDS, prev + 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [user]);

  // Persist the guest's used seconds and prompt sign-in at the limit.
  useEffect(() => {
    if (user) return;
    if (secondsUsed > 0) {
      try {
        localStorage.setItem(STORAGE_KEYS.FREE_SECONDS, String(secondsUsed));
      } catch {
        /* storage blocked — the timer still works for this tab */
      }
    }
    if (secondsUsed >= FREE_LIMIT_SECONDS) setShowAuthModal(true);
  }, [secondsUsed, user]);

  // Composer edits: track guest activity and drop the restored-draft marker
  // once the user changes it themselves.
  const handleInputChange = useCallback((value: string) => {
    lastTypedAtRef.current = Date.now();
    if (
      restoredDraftRef.current !== null &&
      value !== restoredDraftRef.current
    ) {
      restoredDraftRef.current = null;
    }
    setInput(value);
  }, []);

  // ── Memory notice: one-time line on a signed-in user's first ever chat ──
  const memoryNoticeProfileFlag = Boolean(
    (profile as { memoryNoticeDismissed?: unknown } | null | undefined)
      ?.memoryNoticeDismissed,
  );
  const uid = user?.uid ?? null;
  useEffect(() => {
    if (!uid || memoryNoticeProfileFlag || readMemoryNoticeDismissed(uid)) {
      setShowMemoryNotice(false);
      return;
    }
    let cancelled = false;
    // "First ever chat" = at most one chat doc exists (the one being had).
    getDocs(query(collection(db, "users", uid, "chats"), limit(2)))
      .then((snap) => {
        if (!cancelled) setShowMemoryNotice(snap.size <= 1);
      })
      .catch(() => {
        /* offline or denied — simply don't show the notice */
      });
    return () => {
      cancelled = true;
    };
  }, [uid, memoryNoticeProfileFlag]);

  const dismissMemoryNotice = useCallback(() => {
    setShowMemoryNotice(false);
    if (!uid) return;
    try {
      localStorage.setItem(MEMORY_NOTICE_KEY_PREFIX + uid, "1");
    } catch {
      /* ignore — the profile flag below still persists it */
    }
    updateDoc(doc(db, "users", uid), { memoryNoticeDismissed: true }).catch(
      () => {},
    );
  }, [uid]);

  // Escape closes the "What I remember" panel.
  useEffect(() => {
    if (!showMemoryPanel) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowMemoryPanel(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showMemoryPanel]);

  // ── Breathing ──
  const openBreathing = useCallback(() => {
    setShowBreathOffer(false);
    setPranaManual(true);
    setShowPrana(true);
  }, []);
  const closeBreathing = useCallback(() => {
    setShowPrana(false);
    setPranaManual(false);
  }, []);
  const handleBreathingComplete = useCallback(() => {
    void recordPracticeSession(uid).then((streak) => {
      if (!streak) return;
      refreshAtman();
      showSuccess(
        "Breath complete",
        streak > 1
          ? `${streak} days of practice in a row.`
          : "Your practice streak has begun.",
      );
    });
  }, [uid, refreshAtman, showSuccess]);

  // ── Check-in follow-up (signed-in only) ──
  const scheduleCheckIn = async () => {
    if (!user || !checkInOffer) return;
    const due = new Date(Date.now() + CHECK_IN_DELAY_MS);
    const topic = checkInOffer.question.replace(/\s+/g, " ").trim();
    const title = `Check in about: ${
      topic.length > 80 ? `${topic.slice(0, 80).trimEnd()}…` : topic
    }`;
    setCheckInOffer(null);
    await AtmanService.addLifeEvent(user.uid, {
      title,
      date: due,
      status: "pending",
      category: checkInOffer.category,
      confidence: 1,
    });
    refreshAtman();
    setCheckInScheduled(due.toLocaleDateString(undefined, { weekday: "long" }));
  };

  // In-chat top-up buys the recommended pack (valid on the server); the full
  // pack picker lives on /wallet.
  const purchasePack = DEFAULT_CREDIT_PACK;
  const purchasePrice = formatMoney(
    getPackAmount(purchasePack, currency),
    currency,
  );
  const handlePurchase = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    const ok = await buyCredits(purchasePack.minutes);
    if (ok) {
      trackAcquisitionEvent("first_payment", {
        amount: getPackAmount(purchasePack, currency),
      });
      showSuccess(
        "Credits added",
        `${purchasePack.label} were added to your account.`,
      );
    }
  };

  useEffect(() => {
    if (topupError) showError("Payment didn't go through", topupError);
  }, [topupError, showError]);

  // Handle message sending. `retryOf` resends a failed turn verbatim without
  // adding a second user bubble (or a second Firestore user message).
  const handleSend = async ({ retryOf }: SendOptions = {}) => {
    const text = retryOf ? retryOf.content : input;
    if (
      !text.trim() ||
      isSynthesizing ||
      sendingRef.current ||
      streamingContent !== null ||
      authLoading
    )
      return;

    // Only gate on missing birth data once the profile has actually loaded —
    // useUserProfile has no synchronous hydration, so a signed-in user who
    // sends before the first snapshot must not have their send swallowed
    // (the server can build context from the uid). Matches the onboarding
    // effect's own isLoadingProfile gate.
    if (!birthData && !isLoadingProfile) {
      setShowOnboardingModal(true);
      return;
    }

    const isOutOfTime = !user
      ? secondsUsed >= FREE_LIMIT_SECONDS
      : credits <= 0 && !isSubscribed;

    if (isOutOfTime) {
      if (!user) setShowAuthModal(true);
      else setShowCreditsNotice(true);
      return;
    }
    setShowCreditsNotice(false);
    setSendFailure(null);
    setCheckInOffer(null);
    setCheckInScheduled(null);

    const userMsgContent = text;
    const userMsgClientId = retryOf ? retryOf.clientId : `user_${Date.now()}`;
    const soundsAnxious = isAnxiousMessage(userMsgContent);
    const aboutRelationship = isRelationshipMessage(userMsgContent);
    // Offer a breath before the reply lands — never forced, one tap away.
    setShowBreathOffer(soundsAnxious);

    if (!retryOf) {
      const userMsg: Message = {
        id: `pending_${userMsgClientId}`,
        clientId: userMsgClientId,
        pending: true,
        role: "user",
        content: userMsgContent,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      if (user) {
        pendingMessagesRef.current = [...pendingMessagesRef.current, userMsg];
      }
      setInput("");
    } else if (input === retryOf.content) {
      // Retry supersedes the auto-restored draft — don't leave a copy behind.
      setInput("");
    }
    restoredDraftRef.current = null;
    setIsSynthesizing(true);

    // One request at a time, abortable (unmount / chat switch), and pinned to
    // the chat it was sent from so a late completion can never leak its result
    // into a different conversation.
    sendingRef.current = true;
    // Whether the assistant reply reached the UI/store — a failure AFTER that
    // point (e.g. the convergence setDoc) must not restore the draft.
    let replyDelivered = false;
    // Whether the user turn is in Firestore, so a Retry doesn't write it twice.
    let userPersisted = Boolean(retryOf?.persisted);
    const controller = new AbortController();
    sendAbortRef.current = controller;
    let chatIdAtSend = currentChatId;
    sendChatIdRef.current = chatIdAtSend;
    const isCurrent = () =>
      !controller.signal.aborted && currentChatIdRef.current === chatIdAtSend;

    streamBufferRef.current = "";
    const flushStream = () => {
      streamFrameRef.current = null;
      if (!isCurrent()) return;
      setStreamingContent(streamBufferRef.current);
    };

    let chatId = currentChatId;
    try {
      // If logged in and first message, create chat doc
      if (user && !chatId) {
        const newChatRef = await addDoc(
          collection(db, "users", user.uid, "chats"),
          {
            userId: user.uid,
            title: makeChatTitle(userMsgContent),
            createdAt: serverTimestamp(),
            lastUpdatedAt: serverTimestamp(),
          },
        );
        chatId = newChatRef.id;
        // This send now belongs to the chat it just created — moving the app
        // into that chat must not abort it, and its results apply there.
        chatIdAtSend = chatId;
        sendChatIdRef.current = chatId;
        currentChatIdRef.current = chatId; // sync before React commits
        setCurrentChatId(chatId);
        navigate(`/synthesis/${chatId}`, { replace: true });
        trackAcquisitionEvent("first_chat");
      }

      // Save user message to Firestore if logged in (once, even across retries)
      if (user && chatId && !userPersisted) {
        await addDoc(
          collection(db, "users", user.uid, "chats", chatId, "messages"),
          {
            role: "user",
            content: userMsgContent,
            clientId: userMsgClientId,
            timestamp: serverTimestamp(),
          },
        );
        userPersisted = true;
        // Update lastUpdatedAt
        await updateDoc(doc(db, "users", user.uid, "chats", chatId), {
          lastUpdatedAt: serverTimestamp(),
        });
      }

      // P0: Load guru's diary (recent chat summaries) for new conversations
      const recentSummaries = !interactionId ? await loadRecentSummaries() : [];

      // Build enriched chat history for summary generation and fallback memory.
      // A retried turn is already in `messages` — exclude it so it isn't sent twice.
      const priorTurns = messages.filter(
        (m) =>
          m.id !== "welcome" &&
          !(retryOf && (m.clientId ?? m.id) === retryOf.clientId),
      );
      const chatMessagesForSummary = priorTurns
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));
      const currentTurn = { role: "user" as const, content: userMsgContent };
      const requestMessages =
        interactionId || chatMessagesForSummary.length === 0
          ? [currentTurn]
          : [...chatMessagesForSummary, currentTurn].slice(-10);

      // Pre-generate the assistant message id so the server can durably persist
      // the reply under the SAME doc id the client writes — if the tab closes
      // before the client's write, the server's copy survives (no duplicate).
      const aiMsgClientId = `assistant_${crypto.randomUUID()}`;

      // One-shot context handed over from the Compatibility page.
      const compatibilityContext = readCompatibilityContext();

      const idToken = user ? await user.getIdToken() : undefined;
      const response = await fetch("/api/synthesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          // If interactionId exists, Google manages history. If it is missing
          // after refresh/reopen, include recent visible turns as fallback.
          messages: requestMessages,
          birthData,
          kundaliData,
          previousInteractionId: interactionId, // Pass previous interaction for context
          atmanData: atmanState, // Pass current consciousness state to AI
          recentSummaries:
            recentSummaries.length > 0 ? recentSummaries : undefined,
          chatMessages:
            chatMessagesForSummary.length > 0
              ? chatMessagesForSummary
              : undefined,
          messageCount: priorTurns.length,
          idToken,
          chatId: user ? chatId : undefined,
          assistantMessageId: user ? aiMsgClientId : undefined,
          compatibilityContext: compatibilityContext ?? undefined,
        }),
      });

      // Read the status BEFORE touching the stream. Error bodies (gateway
      // HTML, JSON) are never rendered — readSendError maps them to calm copy.
      if (!response.ok) {
        throw await readSendError(response);
      }
      // A 200 that isn't our event stream (e.g. an HTML error page from a
      // proxy) must not be parsed or shown either.
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/event-stream") || !response.body) {
        throw new SendError(QUIET_SKY_MESSAGE, response.status);
      }
      // The server accepted the context; it applies to this message only.
      if (compatibilityContext) clearCompatibilityContext();

      // --- Real SSE Stream Consumption ---
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let metadata: any = null;

      setIsSynthesizing(false); // Hide loader, streaming content will show instead

      const handleEventLine = (line: string) => {
        // SSE comments (":keepalive") and non-data fields carry no content.
        if (!line.startsWith("data:")) return;
        const jsonStr = line.slice(5).trim();
        if (!jsonStr) return;
        let event: any;
        try {
          event = JSON.parse(jsonStr);
        } catch {
          return; // Ignore malformed SSE lines
        }
        if (!event || typeof event !== "object") return;
        if (KEEPALIVE_EVENT_TYPES.has(event.type)) return;

        if (event.type === "delta" && typeof event.text === "string") {
          // Deltas accumulate in a ref and flush at most once per frame —
          // per-token setState would re-render the whole thread per token.
          streamBufferRef.current += event.text;
          if (streamFrameRef.current === null) {
            streamFrameRef.current = requestAnimationFrame(flushStream);
          }
        } else if (event.type === "done") {
          metadata = event;
        } else if (event.type === "error") {
          throw new StreamError(
            typeof event.error === "string" ? event.error : QUIET_SKY_MESSAGE,
          );
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer
        for (const line of lines) handleEventLine(line);
      }
      // A final event without a trailing newline.
      buffer += decoder.decode();
      if (buffer) handleEventLine(buffer);

      // The stream is over: cancel any pending flush so a late frame cannot
      // repaint the streaming bubble after the final message is applied.
      if (streamFrameRef.current !== null) {
        cancelAnimationFrame(streamFrameRef.current);
        streamFrameRef.current = null;
      }

      const fullContent = streamBufferRef.current;
      if (!fullContent.trim() && !metadata?.content) {
        throw new SendError(QUIET_SKY_MESSAGE);
      }

      const finalContent = metadata?.content || fullContent;

      // NOTE: no client-side credit decrement here. The credit is charged
      // server-side before generation and the profile snapshot already
      // reflects the authoritative balance — decrementing locally as well
      // showed users a balance one lower than they actually had.

      // Announce the reply for screen readers (visually hidden live region).
      if (isCurrent()) {
        if (replyAnnounceTimerRef.current !== null) {
          clearTimeout(replyAnnounceTimerRef.current);
        }
        setReplyAnnouncement("Jyotish replied");
        // Clear after a beat so the next reply's identical text re-announces.
        replyAnnounceTimerRef.current = setTimeout(() => {
          setReplyAnnouncement("");
          replyAnnounceTimerRef.current = null;
        }, 3000);
      }

      // Handle Routine Suggestion — delay to let the response settle visually
      if (metadata?.suggestedRoutine && isCurrent()) {
        setTimeout(() => setSuggestedRoutine(metadata.suggestedRoutine), 2000);
      }

      // Conversation summaries are written server-side (and skipped while
      // memory is paused), so the client no longer saves them.

      // Store the new interaction ID for next turn
      if (metadata?.interactionId) {
        if (isCurrent()) setInteractionId(metadata.interactionId);
        if (user && chatId) {
          updateDoc(doc(db, "users", user.uid, "chats", chatId), {
            lastInteractionId: metadata.interactionId,
            lastInteractionAt: serverTimestamp(),
          }).catch(() => {});
        }
      }

      // Update chat title if AI generated one
      if (metadata?.generatedTitle && user && chatId) {
        updateDoc(doc(db, "users", user.uid, "chats", chatId), {
          title: metadata.generatedTitle,
        }).catch(() => {});
      }

      // Signed-in: after a heavy-hearted question, offer a gentle check-in.
      if (user && isCurrent() && (aboutRelationship || soundsAnxious)) {
        setCheckInOffer({
          question: userMsgContent,
          category: aboutRelationship ? "relationship" : "health",
        });
      }

      if (user && chatId) {
        replyDelivered = true;
        // UI state only applies to the chat this send belongs to — a reply
        // finishing after the user switched chats must not surface there.
        if (isCurrent()) {
          const aiMsg: Message = {
            id: `pending_${aiMsgClientId}`,
            clientId: aiMsgClientId,
            pending: true,
            role: "assistant",
            content: finalContent,
            timestamp: new Date(),
          };
          pendingMessagesRef.current = [...pendingMessagesRef.current, aiMsg];
          setStreamingContent(null);
          setMessages((prev) => [...prev, aiMsg]);
        }

        // Write to the deterministic doc id (same as the server's persist), so
        // the two writes converge instead of duplicating. onSnapshot then
        // confirms the local message by clientId. The write is keyed on the
        // originating chatId, so it is safe even after a chat switch.
        await setDoc(
          doc(
            db,
            "users",
            user.uid,
            "chats",
            chatId,
            "messages",
            aiMsgClientId,
          ),
          {
            role: "assistant",
            content: finalContent,
            clientId: aiMsgClientId,
            timestamp: serverTimestamp(),
          },
          { merge: true },
        );
      } else if (isCurrent()) {
        // Guest: clear streaming, then add message directly
        replyDelivered = true;
        setStreamingContent(null);
        const aiMsgClientId = `assistant_${Date.now()}`;
        const aiMsg: Message = {
          id: aiMsgClientId,
          clientId: aiMsgClientId,
          role: "assistant",
          content: finalContent,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
      }

      // Auto-action if suggested
      if (metadata?.suggestAction === "show_chart" && isCurrent()) {
        setTimeout(() => setShowExpandedChart(true), 1500);
      }
    } catch (err) {
      // Aborted sends (unmount / chat switch) end silently — the finally
      // block cleans up; no toast, no state applied to the wrong chat.
      if (
        controller.signal.aborted ||
        (err instanceof Error && err.name === "AbortError")
      ) {
        return;
      }
      console.error(
        "[Synthesis] Send failed:",
        err instanceof Error ? err.name : err,
      );
      setStreamingContent(null);
      // The reply already landed (only the convergence setDoc failed) —
      // nothing for the user to retry.
      if (replyDelivered) return;

      const status = err instanceof SendError ? err.status : undefined;
      if (status === 402) {
        setShowCreditsNotice(true);
      } else if (status === 401) {
        setShowAuthModal(true);
      }

      // Only our own short, plain messages are shown; anything else (network
      // errors, gateway pages) becomes the calm default.
      const message =
        status === 429
          ? "The sky needs a breath — please try again in a moment."
          : err instanceof StreamError || err instanceof SendError
            ? err.message
            : QUIET_SKY_MESSAGE;

      // Inline calm state + Retry (not for 401/402, which have their own flows).
      if (status !== 401 && status !== 402) {
        setSendFailure({
          content: userMsgContent,
          clientId: userMsgClientId,
          persisted: userPersisted,
          chatId,
          message,
        });
      }

      // Give the user their words back — ONLY into an empty composer, never
      // appended to text they typed while waiting. The restored text is
      // selected so typing a new question replaces it rather than gluing the
      // two together.
      setInput((current) => {
        if (current.trim()) return current;
        restoredDraftRef.current = userMsgContent;
        requestAnimationFrame(() => {
          const composer = composerRef.current;
          if (!composer || restoredDraftRef.current !== userMsgContent) return;
          composer.focus();
          const selection = window.getSelection();
          if (!selection) return;
          const range = document.createRange();
          range.selectNodeContents(composer);
          selection.removeAllRanges();
          selection.addRange(range);
        });
        return userMsgContent;
      });
    } finally {
      sendingRef.current = false;
      if (sendAbortRef.current === controller) {
        sendAbortRef.current = null;
        sendChatIdRef.current = null;
      }
      if (streamFrameRef.current !== null) {
        cancelAnimationFrame(streamFrameRef.current);
        streamFrameRef.current = null;
      }
      streamBufferRef.current = "";
      if (controller.signal.aborted) {
        // A stale flush must not leave the old reply on screen in a new chat.
        setStreamingContent(null);
      }
      setIsSynthesizing(false);
    }
  };

  const retryFailedSend = () => {
    if (!sendFailure) return;
    // The failure belongs to another chat now — just clear it.
    if (sendFailure.chatId && sendFailure.chatId !== currentChatId) {
      setSendFailure(null);
      return;
    }
    void handleSend({ retryOf: sendFailure });
  };

  // A failure banner or check-in offer never follows the user into another chat.
  useEffect(() => {
    // Our own first send moving into the chat it just created is not a switch.
    if (sendingRef.current && sendChatIdRef.current === currentChatId) return;
    setSendFailure(null);
    setCheckInOffer(null);
    setCheckInScheduled(null);
    setShowBreathOffer(false);
  }, [currentChatId]);

  // Follow the conversation only while the reader is already near the bottom;
  // never yank them down while they are re-reading earlier messages.
  const handleThreadScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight <
      NEAR_BOTTOM_THRESHOLD_PX;
    isNearBottomRef.current = nearBottom;
    setShowJumpToLatest(!nearBottom);
  }, []);

  const jumpToLatest = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    isNearBottomRef.current = true;
    setShowJumpToLatest(false);
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !isNearBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isSynthesizing, streamingContent, showCreditsNotice]);

  const remainingSeconds = Math.max(0, FREE_LIMIT_SECONDS - secondsUsed);
  const hasStreamingContent = hasVisibleStreamingContent(streamingContent);
  const isIntroConversation =
    !isSynthesizing &&
    !hasStreamingContent &&
    (messages.length === 0 ||
      (messages.length === 1 && messages[0]?.id === "welcome"));

  return (
    <>
      <SynthesisSEO />

      {/* Prana Overlay - Triggers on Anxiety/Chaos */}
      <PranaOverlay
        isOpen={showPrana}
        onClose={closeBreathing}
        onComplete={handleBreathingComplete}
        initialMode={!pranaManual && isChaotic ? "balance" : "calm"}
      />

      {/* Routine Proposal Modal */}
      <RoutineProposal
        isOpen={!!suggestedRoutine}
        routine={suggestedRoutine}
        userId={user?.uid || ""}
        onClose={() => setSuggestedRoutine(null)}
        onAccepted={() => {
          refreshAtman();
          setSuggestedRoutine(null);
        }}
      />

      {/* Daily Altar (Sadhana Dashboard) */}
      <DailyAltar
        isOpen={showAltar}
        onClose={() => setShowAltar(false)}
        userId={user?.uid || ""}
        atmanState={atmanState}
        onRefresh={refreshAtman}
      />

      <div className="h-[100dvh] min-h-[100dvh] flex flex-col bg-bg-app text-content-primary overflow-hidden relative selection:bg-gold/30 selection:text-white">
        <NightSky />

        {/* Screen-reader announcement when a reply completes. Lives at the
            page root: inside <main> it would go inert while a mobile drawer
            is open and announcements would be dropped. */}
        <div role="status" aria-live="polite" className="sr-only">
          {replyAnnouncement}
        </div>

        {/* ── Body: rails + conversation ── */}
        {!showPrana && (
          <div className="flex-1 flex relative z-10 overflow-hidden">
            <SynthesisPanelLaunchers
              canOpenConversations={Boolean(user)}
              conversationsOpen={showConversations}
              blueprintOpen={showBlueprint}
              onOpenConversations={toggleConversations}
              onOpenBlueprint={toggleBlueprint}
              conversationsButtonRef={conversationsToggleRef}
              blueprintButtonRef={blueprintToggleRef}
            />
            <main
              className="flex-1 flex flex-col overflow-hidden min-w-0 lg:order-2"
              inert={!isDesktopViewport && (showConversations || showBlueprint)}
            >
              <div className="relative flex-1 min-h-0">
                <div
                  ref={scrollRef}
                  onScroll={handleThreadScroll}
                  className="h-full overflow-y-auto overflow-x-hidden custom-scrollbar"
                >
                  <div
                    className={`mx-auto flex min-h-full max-w-3xl flex-col ${SYNTHESIS_MESSAGE_SPACING_CLASS} px-4 py-7 md:px-6 ${
                      isIntroConversation ? "justify-center" : "justify-end"
                    }`}
                  >
                    {isIntroConversation && (
                      <div className="flex flex-col items-center gap-6 px-3 py-8 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/25 bg-gold/10 shadow-[0_0_35px_rgba(255,205,106,0.12)]">
                          <Sparkles size={18} className="text-gold" />
                        </div>
                        <div className="max-w-xl">
                          <h1 className="font-display text-3xl italic leading-tight text-white/90 md:text-4xl">
                            What would you ask the sky?
                          </h1>
                          <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-white/48">
                            {messages[0]?.content || welcomeMessage.content}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-2 max-w-lg">
                          {OPENING_QUESTIONS.map((q) => (
                            <button
                              key={q}
                              onClick={() => setInput(q)}
                              className="rounded-full border border-white/10 bg-white/[0.02] px-4 py-2 text-xs text-white/50 transition-colors hover:border-gold/30 hover:text-gold"
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {messages
                      .filter((m, i, arr) => {
                        if (isIntroConversation && m.id === "welcome") {
                          return false;
                        }
                        // Hide the last assistant message while streaming to prevent duplicate bubbles
                        // onSnapshot may deliver the Firestore message before streamingContent clears
                        if (
                          hasStreamingContent &&
                          m.role === "assistant" &&
                          i === arr.length - 1
                        )
                          return false;
                        return true;
                      })
                      .map((m) => (
                        <MessageBubble
                          key={m.clientId || m.id}
                          role={m.role}
                          content={m.content}
                          reveal={m.role === "assistant" && !m.clientId}
                        />
                      ))}

                    {/* Streaming reveal */}
                    {hasStreamingContent && (
                      <MessageBubble
                        role="assistant"
                        content={streamingContent}
                        streaming
                      />
                    )}

                    {isSynthesizing && (
                      <div
                        className="flex justify-start animate-in fade-in duration-300"
                        role="status"
                        aria-live="polite"
                      >
                        <div className="max-w-[85%]">
                          <div className="text-[0.65rem] font-bold uppercase tracking-[0.3em] mb-1.5 text-gold/50">
                            Jyotish
                          </div>
                          <div className="pl-5 border-l border-gold/30 flex items-center gap-3 py-1">
                            <Loader2
                              size={14}
                              className="animate-spin text-gold"
                            />
                            <span className="text-[0.65rem] uppercase tracking-[0.3em] text-gold/60 animate-pulse">
                              Reading the sky…
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Routine suggestion teaser — shows in chat before modal opens */}
                    {suggestedRoutine && (
                      <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="max-w-[85%]">
                          <div className="px-4 py-3 rounded-2xl border border-gold/20 bg-gold/5 flex items-center gap-3">
                            <Sparkles
                              size={14}
                              className="text-gold shrink-0"
                            />
                            <span className="text-sm text-gold/80">
                              Jyotish has a practice suggestion for you...
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Out-of-credits notice — in-thread, replaces the old native alert() */}
                    {showCreditsNotice && user && (
                      <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="max-w-[85%] rounded-2xl border border-gold/20 bg-gold/5 px-5 py-4">
                          <p className="mb-1 text-sm text-white/85">
                            You're out of credits.
                          </p>
                          <p className="mb-3 text-xs text-white/45">
                            Add credits to continue this conversation.
                          </p>
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={() => void handlePurchase()}
                              disabled={isPaying}
                              className="flex min-h-11 items-center gap-2 rounded-xl bg-gold/90 px-4 py-2 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-black transition-colors hover:bg-gold disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isPaying ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Sparkles size={12} />
                              )}
                              Buy {purchasePack.label} · {purchasePrice}
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate("/wallet")}
                              className="flex min-h-11 items-center px-2 text-xs text-gold/70 transition-colors hover:text-gold"
                            >
                              See all packs
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowCreditsNotice(false)}
                              className="flex min-h-11 items-center px-2 text-xs text-white/40 transition-colors hover:text-white/70"
                            >
                              Not now
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Calm failure state — never the raw error body */}
                    {sendFailure && !isSynthesizing && !hasStreamingContent && (
                      <div
                        role="alert"
                        className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300"
                      >
                        <div className="max-w-[85%] rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4">
                          <p className="text-sm leading-6 text-white/75">
                            {sendFailure.message}
                          </p>
                          <button
                            type="button"
                            onClick={retryFailedSend}
                            className="mt-3 flex min-h-11 items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-4 py-2 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-gold transition-colors hover:bg-gold/20"
                          >
                            <RotateCcw size={12} />
                            Retry
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Gentle check-in offer after a heavy-hearted reply */}
                    {user &&
                      (checkInOffer || checkInScheduled) &&
                      !isSynthesizing &&
                      !hasStreamingContent && (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex justify-start"
                        >
                          {checkInScheduled ? (
                            <p className="flex items-center gap-2 rounded-full border border-gold/20 bg-gold/5 px-4 py-2 text-xs text-gold/80">
                              <CalendarClock size={12} />
                              I'll check in with you on {checkInScheduled}.
                            </p>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => void scheduleCheckIn()}
                                className="flex min-h-9 items-center gap-2 rounded-full border border-gold/25 bg-gold/5 px-4 py-2 text-xs text-gold/85 transition-colors hover:border-gold/40 hover:bg-gold/10"
                              >
                                <CalendarClock size={12} />
                                Check in with me in 3 days
                              </button>
                              <button
                                type="button"
                                onClick={() => setCheckInOffer(null)}
                                className="flex h-9 w-9 items-center justify-center rounded-full text-white/30 transition-colors hover:text-white/60"
                                aria-label="Dismiss check-in offer"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          )}
                        </motion.div>
                      )}
                  </div>
                </div>

                {/* Jump to latest — shown when the reader has scrolled up */}
                {showJumpToLatest && (
                  <button
                    type="button"
                    onClick={jumpToLatest}
                    className="absolute bottom-4 left-1/2 z-10 flex min-h-11 -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-[#06060c]/90 px-5 py-2 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-white/70 backdrop-blur-xl transition-colors hover:border-gold/30 hover:text-gold animate-in fade-in slide-in-from-bottom-2 duration-200"
                  >
                    <ArrowDown size={12} />
                    Jump to latest
                  </button>
                )}
              </div>

              {/* ── Input ── */}
              <div className="bg-bg-app/92 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl md:px-6">
                <AnimatePresence>
                  {showBreathOffer && (
                    <motion.div
                      key="breath-offer"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      className="mx-auto mb-2 flex max-w-2xl items-center gap-1"
                    >
                      <button
                        type="button"
                        onClick={openBreathing}
                        className="flex min-h-9 items-center gap-2 rounded-full border border-gold/25 bg-gold/5 px-4 py-2 text-xs text-gold/85 transition-colors hover:border-gold/40 hover:bg-gold/10"
                      >
                        <Wind size={12} />
                        Take a slow breath with me first?
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowBreathOffer(false)}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-white/30 transition-colors hover:text-white/60"
                        aria-label="Dismiss breathing offer"
                      >
                        <X size={12} />
                      </button>
                    </motion.div>
                  )}
                  {showMemoryNotice && user && (
                    <motion.div
                      key="memory-notice"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      className="mx-auto mb-2 flex max-w-2xl items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
                    >
                      <BookHeart
                        size={14}
                        className="mt-0.5 shrink-0 text-gold/70"
                      />
                      <p className="flex-1 text-xs leading-5 text-white/55">
                        I'll remember what matters to you so we can pick up
                        where we left off. You can see, edit or pause this
                        anytime in{" "}
                        <button
                          type="button"
                          onClick={() => setShowMemoryPanel(true)}
                          className="text-gold/80 underline-offset-2 hover:text-gold hover:underline"
                        >
                          What I remember
                        </button>
                        .
                      </p>
                      <button
                        type="button"
                        onClick={dismissMemoryNotice}
                        className="-m-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/30 transition-colors hover:text-white/60"
                        aria-label="Dismiss memory notice"
                      >
                        <X size={12} />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="mx-auto max-w-2xl">
                  <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2.5 transition-colors focus-within:border-gold/30 focus-within:bg-white/[0.05]">
                    <SynthesisComposerTextarea
                      composerRef={composerRef}
                      value={input}
                      onValueChange={handleInputChange}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          !e.shiftKey &&
                          !e.nativeEvent.isComposing
                        ) {
                          e.preventDefault();
                          void handleSend();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={openBreathing}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white/35 transition-colors hover:bg-white/5 hover:text-gold"
                      title="Breathe"
                      aria-label="Take a slow breath"
                    >
                      <Wind size={16} />
                    </button>
                    <ComposerVoiceButton
                      isListening={isListening}
                      isSupported={isDictationSupported}
                      onToggle={toggleDictation}
                    />
                    <button
                      onClick={() => void handleSend()}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors ${
                        input.trim()
                          ? "bg-gold/90 text-black hover:bg-gold"
                          : "text-white/20"
                      }`}
                      disabled={
                        isSynthesizing ||
                        hasStreamingContent ||
                        authLoading ||
                        !input.trim()
                      }
                      aria-label="Send message"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
                {!user && (
                  <div className="mx-auto mt-3 flex max-w-3xl flex-col items-center justify-center gap-2 rounded-xl border border-gold/15 bg-gold/5 px-4 py-3 text-center text-xs text-white/55 sm:flex-row">
                    <span>
                      Guest mode has a small server limit. Sign in to use your
                      account credits and save replies.
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAuthModal(true)}
                      className="text-gold hover:text-gold/80"
                    >
                      Sign in
                    </button>
                  </div>
                )}
              </div>
            </main>

            {/* ── Drawer backdrop (mobile only) ── */}
            {(showConversations || showBlueprint) && (
              <button
                onClick={() => {
                  if (showConversations) closeConversations(true);
                  if (showBlueprint) closeBlueprint(true);
                }}
                className="lg:hidden absolute inset-0 z-40 bg-black/55 backdrop-blur-sm animate-in fade-in duration-200 cursor-default"
                aria-label="Close panel"
              />
            )}

            {/* ── Left rail: Conversations (in-flow on desktop, drawer on mobile) ── */}
            {user && (
              <aside
                ref={conversationsPanelRef}
                id="synthesis-conversations-panel"
                role={isDesktopViewport ? "complementary" : "dialog"}
                aria-modal={!isDesktopViewport ? true : undefined}
                aria-labelledby="synthesis-conversations-title"
                inert={!showConversations}
                className={`z-50 flex flex-col ${SYNTHESIS_PANEL_SURFACE_CLASS} overscroll-contain transition-[width,transform,opacity] duration-300 max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:w-80 max-lg:max-w-[85vw] max-lg:backdrop-blur-2xl max-lg:border-r max-lg:border-white/10 ${
                  showConversations
                    ? "max-lg:translate-x-0"
                    : "max-lg:-translate-x-full"
                } lg:order-1 lg:relative lg:overflow-hidden ${
                  showConversations
                    ? "lg:w-72 lg:border-r lg:border-white/5"
                    : "lg:w-0 lg:opacity-0 lg:pointer-events-none"
                }`}
                aria-hidden={!showConversations}
              >
                <ConversationPanelHeader
                  closeButtonRef={conversationsCloseRef}
                  onHome={() => navigate("/dashboard")}
                  onNewConversation={() => {
                    setCurrentChatId(null);
                    closeConversations();
                    navigate("/synthesis");
                  }}
                  onClose={() => closeConversations(true)}
                />
                <span id="synthesis-conversations-title" className="sr-only">
                  Conversations
                </span>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <ConversationsList
                    userId={user.uid}
                    currentId={currentChatId}
                    onSelect={(id) => {
                      setCurrentChatId(id);
                      closeConversations();
                      navigate(`/synthesis/${id}`);
                    }}
                    onDelete={async (id) => {
                      try {
                        // Capture the provider conversation id before the
                        // chat doc is gone, so the server can also purge the
                        // stored conversation (covers chats created before
                        // the server-side interaction log existed).
                        let interactionIds: string[] = [];
                        try {
                          const chatSnap = await getDoc(
                            doc(db, "users", user.uid, "chats", id),
                          );
                          const lastId = chatSnap.data()?.lastInteractionId;
                          if (typeof lastId === "string" && lastId.trim()) {
                            interactionIds = [lastId];
                          }
                        } catch {
                          interactionIds = [];
                        }

                        // Deleting a document does NOT delete its
                        // subcollections — remove the chat's messages first
                        // (batched under Firestore's 500-op limit) so they
                        // don't linger orphaned.
                        const messagesCol = collection(
                          db,
                          "users",
                          user.uid,
                          "chats",
                          id,
                          "messages",
                        );
                        for (;;) {
                          const snap = await getDocs(
                            query(messagesCol, limit(DELETE_BATCH_SIZE)),
                          );
                          if (snap.empty) break;
                          const batch = writeBatch(db);
                          snap.docs.forEach((d) => batch.delete(d.ref));
                          await batch.commit();
                          if (snap.size < DELETE_BATCH_SIZE) break;
                        }
                        await deleteDoc(
                          doc(db, "users", user.uid, "chats", id),
                        );

                        // Forget the notes this conversation produced, so
                        // "delete conversation" really removes what was
                        // learned from it. The chat itself is already gone,
                        // so a failure here only affects memory.
                        try {
                          const forgetRes = await postJson(
                            "/api/memory/forget-chat",
                            { chatId: id, interactionIds },
                          );
                          if (!forgetRes.ok)
                            throw new Error(String(forgetRes.status));
                        } catch (forgetErr) {
                          console.error(
                            "Failed to forget chat memory:",
                            forgetErr,
                          );
                          showError(
                            "Memory not cleared",
                            "The conversation was deleted, but its notes could not be removed. Clear them in Settings → What I remember.",
                          );
                        }

                        // If we deleted the current chat, navigate to new chat
                        if (currentChatId === id) {
                          setCurrentChatId(null);
                          navigate("/synthesis");
                        }
                      } catch (err) {
                        console.error("Failed to delete chat:", err);
                        showError(
                          "Delete Failed",
                          "Could not delete the conversation. Please try again.",
                        );
                      }
                    }}
                  />
                </div>
                <div className="border-t border-white/5 p-3">
                  <button
                    type="button"
                    onClick={() => {
                      closeConversations();
                      setShowMemoryPanel(true);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-gold"
                  >
                    <BookHeart size={16} className="shrink-0" />
                    <span className="truncate">What I remember</span>
                  </button>
                </div>
              </aside>
            )}

            {/* ── Right rail: Celestial Blueprint (in-flow on desktop, drawer on mobile) ── */}
            <aside
              ref={blueprintPanelRef}
              id="synthesis-blueprint-panel"
              role={isDesktopViewport ? "complementary" : "dialog"}
              aria-modal={!isDesktopViewport ? true : undefined}
              aria-labelledby="synthesis-blueprint-title"
              inert={!showBlueprint}
              className={`z-50 flex flex-col ${SYNTHESIS_PANEL_SURFACE_CLASS} overflow-y-auto overscroll-contain custom-scrollbar transition-[width,transform,opacity,padding] duration-300 max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:w-96 max-lg:max-w-[90vw] max-lg:backdrop-blur-2xl max-lg:p-4 ${
                showBlueprint
                  ? "max-lg:translate-x-0"
                  : "max-lg:translate-x-full"
              } lg:order-3 lg:relative lg:overflow-x-hidden ${
                showBlueprint
                  ? "lg:w-[360px] lg:p-5"
                  : "lg:w-0 lg:p-0 lg:opacity-0 lg:pointer-events-none"
              }`}
              aria-hidden={!showBlueprint}
            >
              <header className="mb-5">
                {user && (
                  <div className="mb-3">
                    <BlueprintPanelControls
                      credits={credits}
                      isPaying={isPaying}
                      isOpen={showBlueprint}
                      onAddCredits={() => void handlePurchase()}
                      onToggleBlueprint={toggleBlueprint}
                      toggleButtonRef={blueprintCloseRef}
                    />
                  </div>
                )}
                {!user && (
                  <div className="mb-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => navigate("/dashboard")}
                      className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-white/45 transition-colors hover:bg-white/5 hover:text-gold"
                    >
                      <ChevronLeft size={14} />
                      Home
                    </button>
                    <div className="flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/5 px-2.5 py-1 font-mono text-[0.65rem] text-gold">
                      <Clock size={10} />
                      <span>
                        {Math.floor(remainingSeconds / 60)}:
                        {(remainingSeconds % 60).toString().padStart(2, "0")}
                      </span>
                    </div>
                    <BlueprintToggleButton
                      isOpen={showBlueprint}
                      onToggle={toggleBlueprint}
                      buttonRef={blueprintCloseRef}
                    />
                  </div>
                )}
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p
                    id="synthesis-blueprint-title"
                    className="text-gold/80 text-[0.58rem] font-bold uppercase tracking-[0.32em] leading-4"
                  >
                    Celestial Blueprint
                  </p>
                  <div className="flex items-center gap-2">
                    {user && (
                      <button
                        onClick={() => navigate("/reports")}
                        className="flex items-center gap-1 text-[0.65rem] px-2.5 py-1 rounded-full border border-white/10 text-white/45 hover:text-gold hover:border-gold/30 transition-colors"
                        title="My reports"
                      >
                        <Download size={10} />
                        Reports
                      </button>
                    )}
                  </div>
                </div>
                <ChartTypeSelector
                  value={currentChartType}
                  loading={isLoadingKundali}
                  onChange={setCurrentChartType}
                />
              </header>

              {isLoadingKundali ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-40">
                  <Loader2 className="animate-spin" size={32} />
                  <span className="text-xs uppercase tracking-widest text-center">
                    Calculating Planetary Alignments…
                  </span>
                </div>
              ) : kundaliData ? (
                <div
                  key={currentChartType}
                  className="animate-in fade-in zoom-in-95 duration-500"
                >
                  <div
                    id="kundali-chart-container"
                    className="mx-auto max-w-[300px]"
                  >
                    <button
                      onClick={() => setShowExpandedChart(true)}
                      className="relative block w-full cursor-zoom-in rounded-xl transition-transform duration-500 group hover:scale-[1.01]"
                      aria-label={`Expand ${currentChartType} chart`}
                    >
                      <div className="absolute inset-0 rounded-full bg-gold/5 opacity-0 blur-2xl transition-opacity group-hover:opacity-100" />
                      <Kundali data={kundaliData} className="compact" />
                      <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100">
                        <span className="text-[0.56rem] uppercase tracking-[0.22em] text-white/75">
                          Expand Chart
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* Chart Action Buttons */}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() =>
                        downloadChart(
                          "kundali-chart-container",
                          `kundali-${currentChartType.toLowerCase()}-${birthData?.name || "chart"}.png`,
                        )
                      }
                      className="flex items-center justify-center rounded-xl bg-white/5 p-2 transition-all hover:bg-white/10 group"
                      title="Download Chart"
                      aria-label="Download chart"
                    >
                      <Download
                        size={16}
                        className="text-white/60 group-hover:text-gold transition-colors"
                      />
                    </button>
                    <button
                      onClick={() => setShowShareModal(true)}
                      className="rounded-xl bg-white/5 p-2 text-white/40 transition-all hover:bg-white/10 hover:text-gold"
                      title="Share chart"
                      aria-label="Share chart"
                    >
                      <Share2 size={16} />
                    </button>
                    {/* Update Birth Data Button */}
                    <button
                      onClick={() => setShowOnboardingModal(true)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gold/10 p-2 transition-all hover:bg-gold/20 group"
                      title="Update Birth Data"
                      aria-label="Update birth details"
                    >
                      <Save
                        size={14}
                        className="text-gold group-hover:scale-110 transition-transform"
                      />
                      <span className="text-xs tracking font-bold text-gold">
                        Update Details
                      </span>
                    </button>
                  </div>

                  {/* Daily Altar Button */}
                  <button
                    onClick={() => setShowAltar(true)}
                    className="relative mt-3 w-full overflow-hidden rounded-xl bg-white/[0.04] p-3 transition-all hover:bg-gold/10 group"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Sparkles size={15} className="text-gold" />
                      <span className="text-sm font-display italic tracking-wide text-white/90">
                        Open the Daily Altar
                      </span>
                    </div>
                  </button>

                  <div className="mt-5">
                    {/* Dharma Routines List */}
                    {user && atmanState?.routines && (
                      <div className="pt-4">
                        <DharmaList
                          routines={atmanState.routines}
                          userId={user.uid}
                          onComplete={refreshAtman}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center opacity-30 text-center p-12">
                  <p className="text-xs uppercase tracking-[0.3em] font-light">
                    {kundaliRateLimited
                      ? "Chart is rate-limited — try again in a few minutes"
                      : birthData?.dob && birthData?.tob
                        ? "Chart unavailable — try again shortly"
                        : "Birth data required"}
                  </p>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>

      <OnboardingModal
        isOpen={showOnboardingModal}
        onClose={() => setShowOnboardingModal(false)}
        onComplete={handleOnboardingComplete}
        existingProfile={profile ?? birthData}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        title="Continue Your Journey"
        message="Sign in to save this synthesis and access it from any device."
      />

      {showExpandedChart && kundaliData && (
        <Suspense fallback={null}>
          <CelestialChart
            data={kundaliData}
            onClose={() => setShowExpandedChart(false)}
            onAskAbout={(question) => {
              setInput(question);
              setShowExpandedChart(false);
            }}
          />
        </Suspense>
      )}

      <AnimatePresence>
        {showMemoryPanel && user && (
          <motion.div
            key="memory-panel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-stretch justify-end bg-black/60 backdrop-blur-sm"
            onClick={() => setShowMemoryPanel(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="synthesis-memory-title"
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 40, opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={(event) => event.stopPropagation()}
              className="flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#06060c]/95 backdrop-blur-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
                <h2
                  id="synthesis-memory-title"
                  className="text-xs font-bold uppercase tracking-widest text-white/40"
                >
                  What I remember
                </h2>
                <button
                  type="button"
                  onClick={() => setShowMemoryPanel(false)}
                  className="rounded-lg p-2 text-white/40 transition-colors hover:bg-white/5 hover:text-white/80"
                  aria-label="Close what I remember"
                  autoFocus
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                <MemoryManager compact />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ChartShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        birthData={birthData}
        chartElementId="kundali-chart-container"
        filename={`kundali-${currentChartType.toLowerCase()}-${birthData?.name || "chart"}.png`}
      />
    </>
  );
}
