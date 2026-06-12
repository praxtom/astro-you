import {
  Suspense,
  lazy,
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { postJson } from "../lib/apiFetch";
import { useNavigate, useParams } from "react-router-dom";
import {
  Send,
  Clock,
  Loader2,
  Sparkles,
  ChevronLeft,
  Plus,
  History,
  X,
  Compass,
  Download,
  Save,
  Share2,
} from "lucide-react";
import ChartShareModal from "../components/ChartShareModal";
import AuthModal from "../components/AuthModal";
import OnboardingModal from "../components/OnboardingModal";
import { useAuth } from "../lib/useAuth";
import { useUserProfile, useKundali } from "../hooks";
import type { ChartType } from "../hooks/useKundali";
import {
  doc,
  updateDoc,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { trackAcquisitionEvent } from "../lib/acquisition";
import { loadRazorpayCheckout } from "../lib/razorpay-loader";
import { SynthesisSEO } from "../components/SEO";
import Kundali from "../components/astrology/Kundali";
import type { KundaliData } from "../types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { downloadChart } from "../lib/chartStorage";
import { useConsciousness } from "../hooks/useConsciousness";
import { PranaOverlay } from "../components/prana/PranaOverlay";
import { DharmaList } from "../components/dharma/DharmaList";
import { RoutineProposal } from "../components/dharma/RoutineProposal";
import { DailyAltar } from "../components/sadhana/DailyAltar";
import ConversationsList from "../components/synthesis/ConversationsList";
import { NightSky } from "../components/layout/NightSky";
import type { UserRoutine } from "../types/user";
import { STORAGE_KEYS, FREE_LIMIT_SECONDS } from "../lib/constants";
import { useErrorToast, useSuccessToast } from "../components/ui/toast-context";
import {
  hasVisibleStreamingContent,
  mergeSynthesisMessages,
  type SynthesisMessage,
} from "../lib/synthesis-messages";

type Message = SynthesisMessage;

const CelestialChart = lazy(
  () => import("../components/astrology/CelestialChart"),
);

const OPENING_QUESTIONS = [
  "What does my current dasha ask of me?",
  "Why does this week feel heavy?",
  "What is my Moon trying to teach me?",
  "When is a good time to start something new?",
];

export default function Synthesis() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const showError = useErrorToast();
  const showSuccess = useSuccessToast();

  const [birthData, setBirthData] = useState<any>(null);

  // Atman Integration
  const { isAnxious, isChaotic, isReactive, atmanState, refreshAtman } =
    useConsciousness();
  const [showPrana, setShowPrana] = useState(false);
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

  // Use centralized hooks for data access (when user is logged in)
  const [currentChartType, setCurrentChartType] = useState<ChartType>("D1");
  const {
    profile,
    birthData: hookBirthData,
    loading: isLoadingProfile,
  } = useUserProfile();
  const { kundaliData: hookKundaliData, loading: isLoadingHookKundali } =
    useKundali(hookBirthData, currentChartType);

  // Memoize Markdown components to prevent remounting subtrees on every render
  const markdownComponents = useMemo(
    () => ({
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
        <h3 className="font-display text-base text-gold mt-4 mb-2">
          {children}
        </h3>
      ),
    }),
    [],
  );

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
  const [isPaying, setIsPaying] = useState(false);
  const [kundaliData, setKundaliData] = useState<KundaliData | null>(null);
  const [isLoadingKundali, setIsLoadingKundali] = useState(false);
  // Rails are open by default on desktop (in-flow panels) and closed on
  // mobile, where they act as overlay drawers instead.
  const isDesktop = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(min-width: 1024px)").matches;
  const [showConversations, setShowConversations] = useState(isDesktop);
  const [showBlueprint, setShowBlueprint] = useState(isDesktop);
  const [showExpandedChart, setShowExpandedChart] = useState(false);
  const [interactionId, setInteractionId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevChatIdRef = useRef<string | null>(null); // Track previous chat ID to detect sidebar navigation
  const pendingMessagesRef = useRef<Message[]>([]);

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

  // Sync credits from profile
  useEffect(() => {
    if (profile) {
      setCredits(profile.credits || 0);
    }
  }, [profile]);

  // 2. Handle guest data and onboarding trigger
  useEffect(() => {
    if (isLoadingProfile) return;

    if (!user) {
      const guestData = sessionStorage.getItem(STORAGE_KEYS.GUEST_PROFILE);
      const guestComplete = sessionStorage.getItem(STORAGE_KEYS.GUEST_COMPLETE);

      if (guestData && guestComplete) {
        setBirthData(JSON.parse(guestData));
      } else {
        // No guest data? Try localStorage before forcing onboarding
        const localData = localStorage.getItem(STORAGE_KEYS.PROFILE);
        if (localData) {
          setBirthData(JSON.parse(localData));
        } else {
          setShowOnboardingModal(true);
        }
      }
    } else if (!hookBirthData) {
      // Logged in but no profile data found in Firestore
      setShowOnboardingModal(true);
    }
  }, [user, isLoadingProfile, hookBirthData]);

  const handleOnboardingComplete = () => {
    // For guest users, we need to manually pick up the data from sessionStorage
    if (!user) {
      const guestData = sessionStorage.getItem(STORAGE_KEYS.GUEST_PROFILE);
      if (guestData) {
        setBirthData(JSON.parse(guestData));
      }
    }
    // For logged-in users, useUserProfile's onSnapshot will auto-update hookBirthData
  };

  // Fetch Kundali for guests or when data/type changes
  useEffect(() => {
    if (!user && birthData) {
      const fetchGuestKundali = async () => {
        setIsLoadingKundali(true);
        try {
          const response = await postJson("/api/kundali", {
            birthData,
            chartType: currentChartType,
          });

          if (!response.ok) throw new Error("API error");

          const data = await response.json();
          setKundaliData(data);
        } catch (err) {
          console.error("Error fetching guest Kundali:", err);
          showError(
            "Chart Error",
            "Could not calculate your birth chart. Please check your birth data.",
          );
        } finally {
          setIsLoadingKundali(false);
        }
      };
      fetchGuestKundali();
    }
  }, [birthData, user, currentChartType, showError]);

  // Sync hook data to local state when available (for logged-in users)
  useEffect(() => {
    if (hookKundaliData && user) {
      setKundaliData(hookKundaliData);
      setIsLoadingKundali(false);
    }
  }, [hookKundaliData, user]);

  useEffect(() => {
    if (user) {
      setIsLoadingKundali(isLoadingHookKundali);
    }
  }, [isLoadingHookKundali, user]);

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

    if (!user) {
      pendingMessagesRef.current = [];
      setMessages([welcomeMessage]);
      return;
    }

    if (!currentChatId) {
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

    // Load messages for specific chat
    const q = query(
      collection(db, "users", user.uid, "chats", currentChatId, "messages"),
      orderBy("timestamp", "asc"),
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
  }, [user, currentChatId, welcomeMessage]);

  // Update currentChatId when URL param changes
  useEffect(() => {
    if (id) setCurrentChatId(id);
  }, [id]);

  // Initialize trial timer from localStorage
  useEffect(() => {
    if (user) return;
    const saved = localStorage.getItem(STORAGE_KEYS.FREE_SECONDS);
    if (saved) setSecondsUsed(parseInt(saved));
  }, [user]);

  // Update timer every second
  useEffect(() => {
    if (user || secondsUsed >= FREE_LIMIT_SECONDS) {
      if (!user && secondsUsed >= FREE_LIMIT_SECONDS) setShowAuthModal(true);
      return;
    }

    const interval = setInterval(() => {
      setSecondsUsed((prev) => {
        const next = prev + 1;
        localStorage.setItem(STORAGE_KEYS.FREE_SECONDS, next.toString());
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [secondsUsed, user]);

  const handlePurchase = async (minutes: number, price: number) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setIsPaying(true);
    try {
      await loadRazorpayCheckout();
      const Razorpay = (window as Window & { Razorpay?: any }).Razorpay;
      if (!Razorpay || !import.meta.env.VITE_RAZORPAY_KEY_ID) {
        throw new Error("Payment checkout is not configured.");
      }

      const resp = await fetch("/api/pay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken: await user.getIdToken(),
          minutes,
          amount: price,
        }),
      });
      const order = await resp.json();
      if (!resp.ok) {
        throw new Error(order.error || "Could not create payment order.");
      }

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "AstroYou",
        description: `Purchase ${minutes} Minutes`,
        order_id: order.id,
        handler: async (response: any) => {
          const verifyResp = await fetch("/api/pay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...response,
              idToken: await user.getIdToken(),
            }),
          });
          const verifyData = await verifyResp.json();

          if (verifyData.status === "success") {
            setCredits((prev) => prev + minutes);
            trackAcquisitionEvent("first_payment", { amount: price });
            showSuccess(
              "Minutes Added",
              `${minutes} minutes were added to your account.`,
            );
          } else {
            showError("Payment Verification Failed", "Please contact support.");
          }
        },
        prefill: {
          name: user.displayName || "",
          email: user.email || "",
        },
        theme: {
          color: "#ffcd6a",
        },
      };

      const rzp = new Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error(err);
      showError(
        "Payment Error",
        "Payment failed to initialize. Please try again.",
      );
    } finally {
      setIsPaying(false);
    }
  };

  // Handle message sending
  const handleSend = async () => {
    if (!input.trim() || isSynthesizing || authLoading) return;

    const isOutOfTime = !user
      ? secondsUsed >= FREE_LIMIT_SECONDS
      : credits <= 0;

    if (isOutOfTime) {
      if (!user) setShowAuthModal(true);
      else
        alert(
          "Your celestial minutes have concluded. Purchase more to continue.",
        );
      return;
    }

    const userMsgContent = input;
    const userMsgClientId = `user_${Date.now()}`;
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
    setIsSynthesizing(true);

    try {
      let chatId = currentChatId;

      // If logged in and first message, create chat doc
      if (user && !chatId) {
        const newChatRef = await addDoc(
          collection(db, "users", user.uid, "chats"),
          {
            userId: user.uid,
            title: userMsgContent.substring(0, 40) + "...",
            createdAt: serverTimestamp(),
            lastUpdatedAt: serverTimestamp(),
          },
        );
        chatId = newChatRef.id;
        setCurrentChatId(chatId);
        navigate(`/synthesis/${chatId}`, { replace: true });
        trackAcquisitionEvent("first_chat");
      }

      // Save user message to Firestore if logged in
      if (user && chatId) {
        await addDoc(
          collection(db, "users", user.uid, "chats", chatId, "messages"),
          {
            role: "user",
            content: userMsgContent,
            clientId: userMsgClientId,
            timestamp: serverTimestamp(),
          },
        );
        // Update lastUpdatedAt
        await updateDoc(doc(db, "users", user.uid, "chats", chatId), {
          lastUpdatedAt: serverTimestamp(),
        });
      }

      // P0: Load guru's diary (recent chat summaries) for new conversations
      const recentSummaries = !interactionId ? await loadRecentSummaries() : [];

      // Build enriched chat history for summary generation and fallback memory.
      const chatMessagesForSummary = messages
        .filter((m) => m.id !== "welcome")
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));
      const requestMessages =
        interactionId || chatMessagesForSummary.length === 0
          ? [{ role: userMsg.role, content: userMsg.content }]
          : [
              ...chatMessagesForSummary,
              { role: userMsg.role, content: userMsg.content },
            ].slice(-10);

      const idToken = user ? await user.getIdToken() : undefined;
      const response = await fetch("/api/synthesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
          messageCount: messages.filter((m) => m.id !== "welcome").length,
          idToken,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        let errorMsg = "The cosmos is momentarily unreachable.";
        try {
          errorMsg = JSON.parse(errorText)?.error || errorMsg;
        } catch {
          errorMsg = errorText || errorMsg;
        }
        throw new Error(errorMsg);
      }

      // --- Real SSE Stream Consumption ---
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";
      let metadata: any = null;

      setIsSynthesizing(false); // Hide loader, streaming content will show instead

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === "delta" && event.text) {
              fullContent += event.text;
              setStreamingContent(fullContent);
            } else if (event.type === "done") {
              metadata = event;
            } else if (event.type === "error") {
              throw new Error(event.error || "Synthesis failed");
            }
          } catch (parseErr: any) {
            if (
              parseErr.message === "Synthesis failed" ||
              parseErr.message?.includes("Synthesis")
            ) {
              throw parseErr;
            }
            // Ignore malformed SSE lines
          }
        }
      }

      if (!fullContent && !metadata) {
        throw new Error("No response from the cosmos");
      }

      const finalContent = metadata?.content || fullContent;

      // The credit is now reserved/charged server-side inside /api/synthesis
      // (before the model runs, refunded on failure). The user-profile snapshot
      // will reflect the authoritative balance; decrement locally for snappy UI.
      if (user) {
        setCredits((prev) => Math.max(0, prev - 1));
      }

      // Handle Routine Suggestion — delay to let the response settle visually
      if (metadata?.suggestedRoutine) {
        setTimeout(() => setSuggestedRoutine(metadata.suggestedRoutine), 2000);
      }

      // P0: Save conversation summary to chat doc
      if (metadata?.conversationSummary && user && chatId) {
        updateDoc(doc(db, "users", user.uid, "chats", chatId), {
          summary: metadata.conversationSummary,
        }).catch(() => {});
      }

      // Store the new interaction ID for next turn
      if (metadata?.interactionId) {
        setInteractionId(metadata.interactionId);
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

      if (user && chatId) {
        const aiMsgClientId = `assistant_${Date.now()}`;
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

        // Write to Firestore — onSnapshot will confirm the local message.
        await addDoc(
          collection(db, "users", user.uid, "chats", chatId, "messages"),
          {
            role: "assistant",
            content: finalContent,
            clientId: aiMsgClientId,
            timestamp: serverTimestamp(),
          },
        );
      } else {
        // Guest: clear streaming, then add message directly
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
      if (metadata?.suggestAction === "show_chart") {
        setTimeout(() => setShowExpandedChart(true), 1500);
      }
    } catch (err) {
      console.error(err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Could not reach the cosmos. Please try sending your message again.";
      setStreamingContent(null);
      if (!user) {
        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: errorMessage,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
      }
      showError("Connection Lost", errorMessage);
    } finally {
      setIsSynthesizing(false);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSynthesizing, streamingContent]);

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
        onClose={() => setShowPrana(false)}
        initialMode={isChaotic ? "balance" : isReactive ? "calm" : "calm"}
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

      <div className="h-screen flex flex-col bg-bg-app text-content-primary overflow-hidden relative selection:bg-gold/30 selection:text-white">
        <NightSky />

        {/* ── Top bar ── */}
        {!showPrana && (
          <header className="relative z-30 flex items-center justify-between gap-3 px-4 md:px-6 py-3 border-b border-white/5 bg-bg-app/70 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("/dashboard")}
                className="p-2 rounded-xl text-white/35 hover:text-gold transition-colors"
                title="Back to the Ephemeris"
                aria-label="Back to dashboard"
              >
                <ChevronLeft size={16} />
              </button>
              {user && (
                <button
                  onClick={() => setShowConversations((v) => !v)}
                  className={`flex items-center gap-2 p-2 rounded-xl transition-colors ${
                    showConversations
                      ? "text-gold"
                      : "text-white/35 hover:text-gold"
                  }`}
                  title="Conversations"
                  aria-label="Toggle conversations"
                >
                  <History size={15} />
                  <span className="hidden md:inline text-[0.65rem] font-bold uppercase tracking-[0.2em]">
                    History
                  </span>
                </button>
              )}
            </div>

            <div className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none">
              <p className="font-display text-xl text-white/85 leading-none">
                Jyotish
              </p>
            </div>

            <div className="flex items-center gap-2">
              {!user ? (
                <div className="flex items-center gap-1.5 text-[0.65rem] font-mono px-2.5 py-1 rounded-full border border-gold/30 text-gold bg-gold/5">
                  <Clock size={10} />
                  <span>
                    {Math.floor(remainingSeconds / 60)}:
                    {(remainingSeconds % 60).toString().padStart(2, "0")}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1 rounded-full border border-gold/30 bg-gold/5 p-1 text-gold">
                  <div className="flex items-center gap-1.5 px-2 text-[0.65rem] font-mono">
                    <Sparkles size={10} />
                    <span>{credits}m</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePurchase(60, 499)}
                    disabled={isPaying}
                    className="flex h-6 items-center gap-1 rounded-full bg-gold/10 px-2 text-[0.58rem] font-bold uppercase tracking-[0.16em] text-gold transition-colors hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Add more minutes"
                    aria-label="Add more minutes"
                  >
                    {isPaying ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <Plus size={11} />
                    )}
                    <span className="hidden sm:inline">
                      {isPaying ? "Adding" : "Add"}
                    </span>
                  </button>
                </div>
              )}
              <button
                onClick={() => setShowBlueprint((v) => !v)}
                className={`flex items-center gap-2 p-2 rounded-xl transition-colors ${
                  showBlueprint ? "text-gold" : "text-white/35 hover:text-gold"
                }`}
                title="Your celestial blueprint"
                aria-label="Toggle chart panel"
              >
                <Compass size={15} />
                <span className="hidden md:inline text-[0.65rem] font-bold uppercase tracking-[0.2em]">
                  Blueprint
                </span>
              </button>
            </div>
          </header>
        )}

        {/* ── Body: rails + conversation ── */}
        {!showPrana && (
          <div className="flex-1 flex relative z-10 overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden min-w-0 lg:order-2">
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar"
              >
                <div
                  className={`mx-auto flex min-h-full max-w-3xl flex-col space-y-6 px-4 py-7 md:px-6 ${
                    isIntroConversation ? "justify-center" : "justify-end"
                  }`}
                >
                  {isIntroConversation && (
                    <div className="flex flex-col items-center gap-6 px-3 py-8 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/25 bg-gold/10 shadow-[0_0_35px_rgba(255,205,106,0.12)]">
                        <Sparkles size={18} className="text-gold" />
                      </div>
                      <div className="max-w-xl">
                        <h4 className="font-display text-3xl italic leading-tight text-white/90 md:text-4xl">
                          What would you ask the sky?
                        </h4>
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
                      <div
                        key={m.clientId || m.id}
                        className={`flex ${
                          m.role === "user" ? "justify-end" : "justify-start"
                        } ${
                          m.role === "user"
                            ? "animate-message-send"
                            : m.clientId
                              ? ""
                              : "animate-reveal-progressive"
                        }`}
                      >
                        <div className="max-w-[90%] md:max-w-[85%] group">
                          <div
                            className={`text-[0.6rem] font-bold uppercase tracking-[0.3em] mb-1.5 flex items-center gap-2 ${
                              m.role === "user"
                                ? "flex-row-reverse text-white/25"
                                : "flex-row text-gold/50"
                            }`}
                          >
                            {m.role === "user" ? "You" : "Jyotish"}
                            <span className="text-white/15">·</span>
                            <span className="text-white/20 font-normal tracking-[0.15em]">
                              {m.timestamp.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          {m.role === "user" ? (
                            <div className="px-5 py-3 rounded-2xl rounded-tr-md bg-gold/8 border border-gold/15 text-white/85 transition-colors group-hover:bg-gold/10">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={markdownComponents as any}
                              >
                                {m.content}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            <div className="pl-5 border-l border-gold/30">
                              <div
                                className={`prose-cosmic ${
                                  m.clientId ? "" : "animate-reveal-progressive"
                                }`}
                              >
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={markdownComponents as any}
                                >
                                  {m.content}
                                </ReactMarkdown>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                  {/* Streaming reveal */}
                  {hasStreamingContent && (
                    <div className="flex justify-start animate-in fade-in duration-300">
                      <div className="max-w-[90%] md:max-w-[85%]">
                        <div className="text-[0.6rem] font-bold uppercase tracking-[0.3em] mb-1.5 flex items-center gap-2 text-gold/50">
                          Jyotish
                          <span className="text-white/15">·</span>
                          <span className="text-white/20 font-normal tracking-[0.15em]">
                            Now
                          </span>
                        </div>
                        <div className="pl-5 border-l border-gold/30">
                          <div className="prose-cosmic">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={markdownComponents as any}
                            >
                              {streamingContent}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {isSynthesizing && (
                    <div className="flex justify-start animate-in fade-in duration-300">
                      <div className="max-w-[85%]">
                        <div className="text-[0.6rem] font-bold uppercase tracking-[0.3em] mb-1.5 text-gold/50">
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
                          <Sparkles size={14} className="text-gold shrink-0" />
                          <span className="text-sm text-gold/80">
                            Jyotish has a practice suggestion for you...
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Input ── */}
              <div className="border-t border-white/[0.04] bg-bg-app/92 px-4 pb-4 pt-3 backdrop-blur-xl md:px-6">
                <div className="mx-auto max-w-2xl">
                  <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2.5 transition-colors focus-within:border-gold/30 focus-within:bg-white/[0.05]">
                    <Sparkles
                      size={16}
                      className="mb-1.5 shrink-0 text-gold/75"
                    />
                    <textarea
                      rows={1}
                      placeholder="Ask Jyotish..."
                      className="max-h-32 min-w-0 flex-1 resize-none appearance-none overflow-hidden border-0 bg-transparent py-1 font-sans text-sm leading-6 text-white/85 outline-none placeholder:text-white/28 focus:border-0 focus:outline-none focus:ring-0 md:text-[0.95rem]"
                      style={{ height: "auto" }}
                      value={input}
                      onChange={(e) => {
                        setInput(e.target.value);
                        e.target.style.height = "auto";
                        e.target.style.height = e.target.scrollHeight + "px";
                      }}
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        !e.shiftKey &&
                        (e.preventDefault(), handleSend())
                      }
                    />
                    <button
                      onClick={handleSend}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all ${
                        input.trim()
                          ? "bg-gold/90 text-black hover:bg-gold"
                          : "text-white/20"
                      }`}
                      disabled={isSynthesizing || authLoading || !input.trim()}
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
            </div>

            {/* ── Drawer backdrop (mobile only) ── */}
            {(showConversations || showBlueprint) && (
              <button
                onClick={() => {
                  setShowConversations(false);
                  setShowBlueprint(false);
                }}
                className="lg:hidden absolute inset-0 z-40 bg-black/55 backdrop-blur-sm animate-in fade-in duration-200 cursor-default"
                aria-label="Close panel"
              />
            )}

            {/* ── Left rail: Conversations (in-flow on desktop, drawer on mobile) ── */}
            {user && (
              <aside
                className={`z-50 flex flex-col transition-all duration-300 max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:w-80 max-lg:max-w-[85vw] max-lg:bg-[#06060c]/95 max-lg:backdrop-blur-2xl max-lg:border-r max-lg:border-white/10 ${
                  showConversations
                    ? "max-lg:translate-x-0"
                    : "max-lg:-translate-x-full"
                } lg:order-1 lg:relative lg:overflow-hidden lg:bg-white/2 ${
                  showConversations
                    ? "lg:w-64 lg:border-r lg:border-white/5"
                    : "lg:w-0 lg:opacity-0 lg:pointer-events-none"
                }`}
                aria-hidden={!showConversations}
              >
                <div className="p-4 border-b border-white/5">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <p className="text-[0.6rem] font-bold uppercase tracking-[0.35em] text-white/25">
                      Conversations
                    </p>
                    <button
                      onClick={() => setShowConversations(false)}
                      className="p-1.5 rounded-lg text-white/30 hover:text-gold transition-colors"
                      aria-label="Close conversations"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setCurrentChatId(null);
                      setShowConversations(false);
                      navigate("/synthesis");
                    }}
                    className="w-full py-2.5 rounded-xl border border-gold/30 text-gold text-[0.65rem] font-bold uppercase tracking-[0.2em] hover:bg-gold hover:text-black transition-colors flex items-center justify-center gap-2 group whitespace-nowrap"
                  >
                    <Plus
                      size={13}
                      className="group-hover:rotate-90 transition-transform"
                    />
                    New conversation
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <ConversationsList
                    userId={user.uid}
                    currentId={currentChatId}
                    onSelect={(id) => {
                      setCurrentChatId(id);
                      setShowConversations(false);
                      navigate(`/synthesis/${id}`);
                    }}
                    onDelete={async (id) => {
                      try {
                        // Delete chat document from Firestore
                        const { deleteDoc } =
                          await import("firebase/firestore");
                        await deleteDoc(
                          doc(db, "users", user.uid, "chats", id),
                        );

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

                <div className="p-4 border-t border-white/5">
                  <button
                    onClick={() => navigate("/dashboard")}
                    className="flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.25em] text-white/35 hover:text-gold transition-colors whitespace-nowrap"
                  >
                    <ChevronLeft size={13} />
                    The Ephemeris
                  </button>
                </div>
              </aside>
            )}

            {/* ── Right rail: Celestial Blueprint (in-flow on desktop, drawer on mobile) ── */}
            <aside
              className={`z-50 flex flex-col overflow-y-auto custom-scrollbar transition-all duration-300 max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:w-96 max-lg:max-w-[90vw] max-lg:bg-[#06060c]/95 max-lg:backdrop-blur-2xl max-lg:border-l max-lg:border-white/10 max-lg:p-4 ${
                showBlueprint
                  ? "max-lg:translate-x-0"
                  : "max-lg:translate-x-full"
              } lg:order-3 lg:relative lg:overflow-x-hidden lg:bg-white/2 ${
                showBlueprint
                  ? "lg:w-[360px] lg:p-5 lg:border-l lg:border-white/5"
                  : "lg:w-0 lg:p-0 lg:opacity-0 lg:pointer-events-none"
              }`}
              aria-hidden={!showBlueprint}
            >
              <header className="mb-5">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-gold/80 text-[0.58rem] font-bold uppercase tracking-[0.32em] leading-4">
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
                    <button
                      onClick={() => setShowBlueprint(false)}
                      className="p-1.5 rounded-lg text-white/30 hover:text-gold transition-colors"
                      aria-label="Close blueprint"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
                <select
                  value={currentChartType}
                  onChange={(e) =>
                    setCurrentChartType(e.target.value as ChartType)
                  }
                  className="w-full cursor-pointer appearance-none border-none bg-transparent p-0 font-display text-lg italic text-white/85 transition-colors hover:text-gold focus:ring-0"
                >
                  <option value="D1" className="bg-black not-italic">
                    Natal Chart (D1)
                  </option>
                  <option value="D9" className="bg-black not-italic">
                    Navamsa (D9)
                  </option>
                </select>
                <div className="mt-3 h-px bg-linear-to-r from-gold/25 to-transparent" />
              </header>

              {isLoadingKundali ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-40">
                  <Loader2 className="animate-spin" size={32} />
                  <span className="text-xs uppercase tracking-widest text-center">
                    Calculating Planetary Alignments...
                  </span>
                </div>
              ) : kundaliData ? (
                <div className="animate-in fade-in zoom-in-95 duration-1000">
                  <div
                    id="kundali-chart-container"
                    className="mx-auto max-w-[300px]"
                  >
                    <button
                      onClick={() => setShowExpandedChart(true)}
                      className="relative block w-full cursor-zoom-in rounded-xl transition-transform duration-500 group hover:scale-[1.01]"
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
                          `kundali-${birthData?.name || "chart"}.png`,
                        )
                      }
                      className="flex items-center justify-center rounded-xl bg-white/5 p-2 transition-all hover:bg-white/10 group"
                      title="Download Chart"
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
                    >
                      <Share2 size={16} />
                    </button>
                    {/* Update Birth Data Button */}
                    <button
                      onClick={() => setShowOnboardingModal(true)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gold/10 p-2 transition-all hover:bg-gold/20 group"
                      title="Update Birth Data"
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
                <div className="flex-1 flex flex-col items-center justify-center opacity-20 text-center p-12">
                  <p className="text-xs uppercase tracking-[0.3em] font-light">
                    Birth data required
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
        existingProfile={profile}
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

      <ChartShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        birthData={birthData}
      />
    </>
  );
}
