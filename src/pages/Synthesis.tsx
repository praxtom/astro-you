import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Send,
  Clock,
  Loader2,
  CreditCard,
  Sparkles,
  ChevronLeft,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  Download,
  Save,
} from "lucide-react";
import AuthModal from "../components/AuthModal";
import OnboardingModal from "../components/OnboardingModal";
import { useAuth } from "../lib/AuthContext";
import { useUserProfile, useKundali } from "../hooks";
import type { ChartType } from "../hooks/useKundali";
import {
  doc,
  updateDoc,
  increment,
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
import { useRazorpay } from "../hooks/useRazorpay";
import { SynthesisSEO } from "../components/SEO";
import Kundali from "../components/astrology/Kundali";
import CelestialChart from "../components/astrology/CelestialChart";
import type { KundaliData, ChatMessage } from "../types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { downloadChart } from "../lib/chartStorage";
import { useConsciousness } from "../hooks/useConsciousness";
import { PranaOverlay } from "../components/prana/PranaOverlay";
import { AtmanService } from "../lib/atman";
import { DharmaList } from "../components/dharma/DharmaList";
import { RoutineProposal } from "../components/dharma/RoutineProposal";
import { DailyAltar } from "../components/sadhana/DailyAltar";
import ConversationsList from "../components/synthesis/ConversationsList";
import type { UserRoutine } from "../types/user";
import { STORAGE_KEYS, FREE_LIMIT_SECONDS } from "../lib/constants";
import { useErrorToast } from "../components/ui/Toast";

type Message = ChatMessage;

export default function Synthesis() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const isRPCLoaded = useRazorpay();
  const showError = useErrorToast();

  // Atman Integration
  const { isAnxious, isChaotic, isReactive, atmanState, refreshAtman } = useConsciousness();
  const [showPrana, setShowPrana] = useState(false);
  const [showAltar, setShowAltar] = useState(false);
  const [suggestedRoutine, setSuggestedRoutine] = useState<UserRoutine | null>(null);

  // Trigger Prana if Anxious/Chaotic/Reactive is detected (with 30-min cooldown)
  useEffect(() => {
    if (isAnxious || isChaotic || isReactive) {
      const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
      const lastShown = sessionStorage.getItem('astroyou_prana_last');
      const now = Date.now();
      if (!lastShown || now - parseInt(lastShown) > COOLDOWN_MS) {
        setShowPrana(true);
        sessionStorage.setItem('astroyou_prana_last', now.toString());
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
    []
  );

  // Local state - needed for guest mode and chat functionality
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(id || null);
  const [input, setInput] = useState("");
  const [secondsUsed, setSecondsUsed] = useState(0);
  const [credits, setCredits] = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [birthData, setBirthData] = useState<any>(null);
  const [kundaliData, setKundaliData] = useState<KundaliData | null>(null);
  const [isLoadingKundali, setIsLoadingKundali] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showExpandedChart, setShowExpandedChart] = useState(false);
  const [interactionId, setInteractionId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevChatIdRef = useRef<string | null>(null); // Track previous chat ID to detect sidebar navigation

  // P0: Load recent chat summaries for guru's diary (last 3 chats with summaries)
  const loadRecentSummaries = useCallback(async () => {
    if (!user) return [];
    try {
      const chatsQuery = query(
        collection(db, "users", user.uid, "chats"),
        orderBy("lastUpdatedAt", "desc"),
        limit(4) // Fetch 4 to skip current chat
      );
      const snapshot = await getDocs(chatsQuery);
      return snapshot.docs
        .filter(d => d.data().summary && d.id !== currentChatId)
        .slice(0, 3)
        .map(d => ({
          title: d.data().title || "Untitled",
          summary: d.data().summary,
          date: d.data().lastUpdatedAt?.toDate()?.toLocaleDateString() || '',
        }));
    } catch (err) {
      console.error("[Synthesis] Failed to load summaries:", err);
      return [];
    }
  }, [user, currentChatId]);

  const WELCOME_MESSAGE: Message = {
    id: "welcome",
    role: "assistant",
    content: `Welcome ${user?.displayName}. I am your personal Jyotish, your guide to Vedic insights. What would you like to know today?`,
    timestamp: new Date(),
  };

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
          const response = await fetch("/api/kundali", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ birthData, chartType: currentChartType }),
          });

          if (!response.ok) throw new Error("API error");

          const data = await response.json();
          setKundaliData(data);
        } catch (err) {
          console.error("Error fetching guest Kundali:", err);
          showError("Chart Error", "Could not calculate your birth chart. Please check your birth data.");
        } finally {
          setIsLoadingKundali(false);
        }
      };
      fetchGuestKundali();
    }
  }, [birthData, user, currentChartType]);

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
    }
    prevChatIdRef.current = currentChatId;

    if (!user) {
      setMessages([WELCOME_MESSAGE]);
      return;
    }

    if (!currentChatId) {
      setMessages([WELCOME_MESSAGE]);
      return;
    }

    // Load messages for specific chat
    const q = query(
      collection(db, "users", user.uid, "chats", currentChatId, "messages"),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date(),
      })) as Message[];

      // Always prepend welcome message so it appears at the start of conversation
      setMessages([WELCOME_MESSAGE, ...msgs]);

      // If a new assistant message arrived from Firestore, clear streaming overlay
      // This ensures seamless handoff: streaming bubble → persisted message
      const lastMsg = msgs[msgs.length - 1];
      if (lastMsg?.role === "assistant") {
        setStreamingContent(null);
      }
    });

    return () => unsubscribe();
  }, [user, currentChatId]);

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

  // Handle Payment
  const handlePurchase = async (minutes: number, price: number) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (!isRPCLoaded) return;

    setIsPaying(true);
    try {
      const resp = await fetch("/api/pay/create-order", {
        method: "POST",
        body: JSON.stringify({ amount: price }),
      });
      const order = await resp.json();

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "AstroYou",
        description: `Purchase ${minutes} Minutes`,
        order_id: order.id,
        handler: async (response: any) => {
          // Verify payment and add credits server-side
          const verifyResp = await fetch("/api/pay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...response, uid: user.uid, minutes }),
          });
          const verifyData = await verifyResp.json();

          if (verifyData.status === "success") {
            setCredits((prev) => prev + minutes);
            alert(`Successfully added ${minutes} minutes!`);
          }
        },
        prefill: {
          name: user.displayName || "",
          email: user.email || "",
        },
        theme: {
          color: "#FFD700",
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error(err);
      showError("Payment Error", "Payment failed to initialize. Please try again.");
    } finally {
      setIsPaying(false);
    }
  };

  // Handle message sending
  const handleSend = async () => {
    if (!input.trim() || isSynthesizing) return;

    const isOutOfTime = !user
      ? secondsUsed >= FREE_LIMIT_SECONDS
      : credits <= 0;

    if (isOutOfTime) {
      if (!user) setShowAuthModal(true);
      else
        alert(
          "Your celestial minutes have concluded. Purchase more to continue."
        );
      return;
    }

    const userMsgContent = input;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userMsgContent,
      timestamp: new Date(),
    };

    // If not logged in, just update state
    if (!user) {
      setMessages((prev) => [...prev, userMsg]);
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
          }
        );
        chatId = newChatRef.id;
        setCurrentChatId(chatId);
        navigate(`/synthesis/${chatId}`, { replace: true });
      }

      // Save user message to Firestore if logged in
      if (user && chatId) {
        await addDoc(
          collection(db, "users", user.uid, "chats", chatId, "messages"),
          {
            role: "user",
            content: userMsgContent,
            timestamp: serverTimestamp(),
          }
        );
        // Update lastUpdatedAt
        await updateDoc(doc(db, "users", user.uid, "chats", chatId), {
          lastUpdatedAt: serverTimestamp(),
        });
      }

      // P0: Load guru's diary (recent chat summaries) for new conversations
      const recentSummaries = !interactionId ? await loadRecentSummaries() : [];

      // Build enriched chat history for summary generation
      const chatMessagesForSummary = messages
        .filter(m => m.id !== 'welcome')
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }));

      const response = await fetch("/api/synthesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Only send the last message - Google manages conversation history via interactionId
          messages: [{ role: userMsg.role, content: userMsg.content }],
          birthData,
          kundaliData,
          previousInteractionId: interactionId, // Pass previous interaction for context
          atmanData: atmanState, // Pass current consciousness state to AI
          recentSummaries: recentSummaries.length > 0 ? recentSummaries : undefined,
          chatMessages: chatMessagesForSummary.length > 0 ? chatMessagesForSummary : undefined,
          messageCount: messages.filter(m => m.id !== 'welcome').length,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        let errorMsg = "The cosmos is momentarily unreachable.";
        try { errorMsg = JSON.parse(errorText)?.error || errorMsg; } catch {}
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
            if (parseErr.message === "Synthesis failed" || parseErr.message?.includes("Synthesis")) {
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

      // Deduct credit AFTER successful response
      if (user && credits > 0) {
        const userRef = doc(db, "users", user.uid);
        updateDoc(userRef, { credits: increment(-1) }).catch(() => {});
        setCredits((prev) => prev - 1);
      }

      // Process Atman Updates from AI
      if (user && metadata?.atmanUpdate) {
        AtmanService.processAnalysisResult(user.uid, metadata.atmanUpdate).catch(() => {});
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

      // P3: Save extracted advice to Atman
      if (metadata?.extractedAdvice && user) {
        AtmanService.saveAdvice(user.uid, metadata.extractedAdvice).catch(() => {});
      }

      // Store the new interaction ID for next turn
      if (metadata?.interactionId) {
        setInteractionId(metadata.interactionId);
      }

      // Update chat title if AI generated one
      if (metadata?.generatedTitle && user && chatId) {
        updateDoc(doc(db, "users", user.uid, "chats", chatId), {
          title: metadata.generatedTitle,
        }).catch(() => {});
      }

      if (user && chatId) {
        // Write to Firestore — onSnapshot will add it to messages AND clear streamingContent
        await addDoc(
          collection(db, "users", user.uid, "chats", chatId, "messages"),
          {
            role: "assistant",
            content: finalContent,
            timestamp: serverTimestamp(),
          }
        );
      } else {
        // Guest: clear streaming, then add message directly
        setStreamingContent(null);
        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
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
      showError("Connection Lost", "Could not reach the cosmos. Please try sending your message again.");
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

  return (
    <>
      <SynthesisSEO />

      {/* Prana Overlay - Triggers on Anxiety/Chaos */}
      <PranaOverlay
        isOpen={showPrana}
        onClose={() => setShowPrana(false)}
        initialMode={isChaotic ? 'balance' : isReactive ? 'calm' : 'calm'}
      />

      {/* Routine Proposal Modal */}
      <RoutineProposal
        isOpen={!!suggestedRoutine}
        routine={suggestedRoutine}
        userId={user?.uid || ''}
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
        userId={user?.uid || ''}
        atmanState={atmanState}
        onRefresh={refreshAtman}
      />

      <div className="h-screen flex flex-col bg-[#010103] text-content-primary overflow-hidden relative selection:bg-gold/30 selection:text-white">
        {/* Background Effects */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[url('/assets/cosmic-bg.png')] opacity-20 bg-cover bg-center" />
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-900/10 rounded-full blur-[100px]" />
        </div>

        {/* Main Container */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Leftmost: Conversation Sidebar (Hidden on mobile or during Prana) */}
          {user && !showPrana && (
            <aside
              className={`hidden md:flex ${isSidebarCollapsed ? "w-0 opacity-0" : "w-72 opacity-100"
                } border-r border-white/5 bg-black/40 backdrop-blur-md flex-col transition-all duration-300 relative overflow-hidden shrink-0`}
            >
              <div className="p-4 border-b border-white/5">
                <button
                  onClick={() => {
                    setCurrentChatId(null);
                    navigate("/synthesis");
                  }}
                  className="w-full btn btn-outline !py-3 text-xs rounded-lg flex items-center justify-center gap-2 group whitespace-nowrap"
                >
                  <Plus
                    size={14}
                    className="group-hover:rotate-90 transition-transform"
                  />
                  New Chat
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <ConversationsList
                  userId={user.uid}
                  currentId={currentChatId}
                  onSelect={(id) => {
                    setCurrentChatId(id);
                    navigate(`/synthesis/${id}`);
                  }}
                  onDelete={async (id) => {
                    try {
                      // Delete chat document from Firestore
                      const { deleteDoc } = await import("firebase/firestore");
                      await deleteDoc(doc(db, "users", user.uid, "chats", id));

                      // If we deleted the current chat, navigate to new chat
                      if (currentChatId === id) {
                        setCurrentChatId(null);
                        navigate("/synthesis");
                      }
                    } catch (err) {
                      console.error("Failed to delete chat:", err);
                      showError("Delete Failed", "Could not delete the conversation. Please try again.");
                    }
                  }}
                />
              </div>

              <div className="p-4 border-t border-white/5">
                <button
                  onClick={() => navigate("/dashboard")}
                  className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-white/40 hover:text-gold transition-colors whitespace-nowrap"
                >
                  <ChevronLeft size={14} />
                  Back to Portal
                </button>
              </div>
            </aside>
          )}

          {/* Toggle Button (Floating) */}
          {user && !showPrana && (
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              aria-label={isSidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
              className={`hidden md:flex absolute ${isSidebarCollapsed ? "left-4" : "left-[17rem]"
                } top-32 z-50 p-2 rounded-full border border-white/10 bg-black/40 backdrop-blur-md text-white/40 hover:text-gold hover:border-gold/30 transition-all duration-300`}
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen size={16} />
              ) : (
                <PanelLeftClose size={16} />
              )}
            </button>

          )}

          {/* Middle/Left: Celestial Blueprint (Hidden during Prana) */}
          {!showPrana && (
            <div className="hidden lg:flex w-[310px] border-r border-white/5 flex-col p-4 overflow-y-auto bg-black/20 backdrop-blur-sm z-10 shrink-0">
            <header className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <select
                  value={currentChartType}
                  onChange={(e) =>
                    setCurrentChartType(e.target.value as ChartType)
                  }
                  className="bg-transparent text-md font-display tracking-[0.2em] uppercase text-white/60 border-none focus:ring-0 cursor-pointer hover:text-white transition-colors p-0"
                >
                  <option value="D1" className="bg-black">
                    Natal Chart (D1)
                  </option>
                  <option value="D9" className="bg-black">
                    Navamsa (D9)
                  </option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                {!user ? (
                  <div className="flex items-center gap-2 text-xs font-mono px-2 py-1 rounded-full border border-gold/30 text-gold bg-gold/5">
                    <Clock size={10} />
                    <span>
                      {Math.floor(remainingSeconds / 60)}:
                      {(remainingSeconds % 60).toString().padStart(2, "0")}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs font-mono px-2 py-1 rounded-full border border-gold/30 text-gold bg-gold/5">
                    <Sparkles size={10} />
                    <span>{credits}m</span>
                  </div>
                )}
              </div>
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
                <div id="kundali-chart-container">
                  <button
                    onClick={() => setShowExpandedChart(true)}
                    className="w-full scale-90 origin-top hover:scale-[0.92] transition-transform duration-500 cursor-zoom-in relative group"
                  >
                    <div className="absolute inset-0 bg-gold/5 opacity-0 group-hover:opacity-100 rounded-full blur-2xl transition-opacity" />
                    <Kundali data={kundaliData} />
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-2 py-3 rounded-full border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                      <span className="text-xs uppercase tracking-[0.2em] text-white">
                        Expand Chart
                      </span>
                    </div>
                  </button>
                  <div className="text-center text-[10px] uppercase tracking-[0.3em] text-gold/60 font-medium">
                    Your Kundali
                  </div>
                </div>

                {/* Chart Action Buttons */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() =>
                      downloadChart(
                        "kundali-chart-container",
                        `kundali-${birthData?.name || "chart"}.png`
                      )
                    }
                    className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center group"
                    title="Download Chart"
                  >
                    <Download
                      size={16}
                      className="text-white/60 group-hover:text-gold transition-colors"
                    />
                  </button>
                  {/* Update Birth Data Button */}
                  <button
                    onClick={() => setShowOnboardingModal(true)}
                    className="flex-1 p-2 rounded-lg bg-gold/10 border border-gold/20 hover:bg-gold/20 transition-all flex items-center justify-center gap-2 group"
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
                    className="w-full mt-3 p-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-purple-500/10 border border-white/10 hover:border-gold/30 hover:shadow-lg hover:shadow-gold/5 transition-all group relative overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gold/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                    <div className="flex items-center justify-center gap-2 relative z-10">
                        <Sparkles size={16} className="text-gold" />
                        <span className="text-sm font-display tracking-widest text-white/90">Open Daily Altar</span>
                    </div>
                </button>

                <div className="mt-3 space-y-2">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <h4 className="text-sm uppercase tracking-widest text-gold/60 mb-2">
                      Chart Essence
                    </h4>
                    <p className="text-xs font-sans font-light opacity-60 leading-relaxed">
                      Your chart reflects a{" "}
                      {
                        kundaliData.planetary_positions.find(
                          (p) => p.name === "Sun"
                        )?.sign
                      }{" "}
                      influence, guided by the wisdom of{" "}
                      {
                        kundaliData.planetary_positions.find(
                          (p) => p.name === "Ascendant"
                        )?.sign
                      }{" "}
                      Lagna.
                    </p>
                  </div>

                  <button
                    onClick={() => handlePurchase(60, 499)}
                    disabled={isPaying}
                    className="w-full p-3 rounded-xl bg-gold/5 border border-gold/10 hover:bg-gold/10 transition-all flex items-center justify-between group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-3">
                      {isPaying ? (
                        <Loader2 size={16} className="text-gold animate-spin" />
                      ) : (
                        <CreditCard size={16} className="text-gold" />
                      )}
                      <span className="text-sm text-white/80">
                        {isPaying ? "Processing..." : "Add More Minutes"}
                      </span>
                    </div>
                    <Plus
                      size={14}
                      className="text-gold group-hover:scale-125 transition-transform"
                    />
                  </button>

                  {/* Dharma Routines List */}
                  {user && atmanState?.routines && (
                    <div className="mt-6 pt-4 border-t border-white/5">
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
          </div>
        )}

          {/* Right: Synthesis Chat Area (Hidden during Prana) */}
          {!showPrana && (
            <div className="flex-1 flex flex-col relative bg-[#030308]">
              <div className="absolute inset-0 z-0 pointer-events-none opacity-5">
                <div className="absolute top-[20%] left-[10%] w-[40vw] h-[40vw] bg-violet blur-[150px] rounded-full"></div>
                <div className="absolute bottom-[20%] right-[10%] w-[30vw] h-[30vw] bg-gold blur-[150px] rounded-full"></div>
              </div>

              {/* Mobile Header (Hidden during Prana) */}
              <div className="md:hidden p-4 border-b border-white/5 bg-black/40 backdrop-blur-md flex justify-between items-center z-20">
              <button
                onClick={() => navigate("/dashboard")}
                className="text-white/40"
                aria-label="Back to dashboard"
              >
                <ChevronLeft size={20} />
              </button>
              <span className="font-display tracking-[0.2em] uppercase text-xs">
                Synthesis
              </span>
              <button
                onClick={() => setCurrentChatId(null)}
                className="text-gold"
                aria-label="New conversation"
              >
                <Plus size={20} />
              </button>
            </div>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto overflow-x-hidden p-2 md:p-6 space-y-4 relative z-10 custom-scrollbar"
            >
              {/* Atmospheric Aura */}
              <div className="aura-bg opacity-50 absolute inset-0 -z-10 pointer-events-none" />
              {messages.length === 0 && !isSynthesizing && (
                <div className="h-full flex flex-col items-center justify-center opacity-30 text-center gap-6">
                  <div className="w-16 h-16 rounded-full border border-gold/20 flex items-center justify-center text-gold">
                    <Sparkles size={32} />
                  </div>
                  <div>
                    <h4 className="font-display tracking-widest uppercase mb-2 text-xs">
                      The Void Awaited
                    </h4>
                    <p className="text-xs italic">
                      A single query illuminates the entire cosmos.
                    </p>
                  </div>
                </div>
              )}

              {messages
              .filter((m, i, arr) => {
                // Hide the last assistant message while streaming to prevent duplicate bubbles
                // onSnapshot may deliver the Firestore message before streamingContent clears
                if (streamingContent !== null && m.role === 'assistant' && i === arr.length - 1) return false;
                return true;
              })
              .map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"
                    } ${m.role === "user"
                      ? "animate-message-send"
                      : "animate-reveal-progressive"
                    }`}
                >
                  <div className="max-w-[90%] md:max-w-[85%] group">
                    <div
                      className={`text-xs uppercase tracking-widest mb-1 opacity-30 flex items-center gap-2 ${m.role === "user" ? "flex-row-reverse" : "flex-row"
                        }`}
                    >
                      {m.role === "user" ? "You" : "Jyotish"}
                      <span>•</span>
                      <span>
                        {m.timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div
                      className={`px-4 py-3 rounded-2xl md:rounded-3xl border transition-all duration-300 ${m.role === "user"
                        ? "bg-white/5 border-white/10 group-hover:bg-white/10"
                        : "bg-surface-accent/10 border-gold/10 group-hover:border-gold/20"
                        }`}
                    >
                      <div
                        className={
                          m.role === "assistant"
                            ? "prose-cosmic animate-reveal-progressive"
                            : ""
                        }
                      >
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={markdownComponents as any}
                        >
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Streaming reveal for guest messages */}
              {streamingContent !== null && (
                <div className="flex justify-start animate-in fade-in duration-300">
                  <div className="max-w-[90%] md:max-w-[85%]">
                    <div className="text-xs uppercase tracking-widest mb-1 opacity-30 flex items-center gap-2">
                      Jyotish
                      <span>•</span>
                      <span>Now</span>
                    </div>
                    <div className="px-4 py-3 rounded-2xl md:rounded-3xl border border-gold/10 bg-surface-accent/10">
                      <div className="prose-cosmic">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={markdownComponents as any}
                        >
                          {streamingContent}
                        </ReactMarkdown>
                        <span className="inline-block w-0.5 h-4 bg-gold/60 animate-pulse ml-0.5 align-middle" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {isSynthesizing && (
                <div className="flex justify-start animate-in fade-in duration-300">
                  <div className="max-w-[85%]">
                    <div className="text-xs uppercase tracking-widest mb-2 opacity-30">
                      Jyotish
                    </div>
                    <div className="p-4 rounded-3xl border border-gold/10 bg-surface-accent/10 flex items-center gap-4">
                      <Loader2 size={16} className="animate-spin text-gold" />
                      <span className="text-xs uppercase tracking-[0.3em] text-gold/60 animate-pulse">
                        Contemplating...
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Routine suggestion teaser — shows in chat before modal opens */}
              {suggestedRoutine && (
                <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="max-w-[85%]">
                    <div className="px-4 py-3 rounded-2xl md:rounded-3xl border border-gold/20 bg-gold/5 flex items-center gap-3">
                      <Sparkles size={14} className="text-gold shrink-0" />
                      <span className="text-sm text-gold/80">
                        Jyotish has a practice suggestion for you...
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-2 md:p-5 z-10">
              <div className="relative max-w-4xl mx-auto group">
                <div className="absolute -inset-1 bg-gradient-to-r from-gold/20 to-violet/20 rounded-[2.5rem] blur opacity-0 group-focus-within:opacity-100 transition duration-1000"></div>
                <textarea
                  rows={1}
                  placeholder="Ask the stars about your destiny..."
                  className="relative w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 outline-none focus:border-gold/50 transition-all font-sans text-base md:text-lg pr-14 overflow-hidden resize-none"
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
                  className={`absolute right-4 top-1/2 -translate-y-1/2 p-4 transition-all ${input.trim()
                    ? "text-gold scale-110"
                    : "text-white/20 scale-100"
                    }`}
                  disabled={isSynthesizing || !input.trim()}
                  aria-label="Send message"
                >
                  <Send size={24} />
                </button>
              </div>
              <p className="text-center mt-2 text-xs uppercase tracking-[0.2em] text-white/20">
                Personalized for {birthData?.name || "Seeker"}
              </p>
            </div>
            </div>
          )}
        </div>

        <OnboardingModal
          isOpen={showOnboardingModal}
          onClose={() => setShowOnboardingModal(false)}
          onComplete={handleOnboardingComplete}
        />

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          title="Continue Your Journey"
          message="Sign in to save this synthesis and access it from any device."
        />

        {showExpandedChart && kundaliData && (
          <CelestialChart
            data={kundaliData}
            onClose={() => setShowExpandedChart(false)}
          />
        )}
      </div>
    </>
  );
}

