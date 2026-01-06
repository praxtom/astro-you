import { useState, useEffect, useRef, useMemo } from "react";
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
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useRazorpay } from "../hooks/useRazorpay";
import { SynthesisSEO } from "../components/SEO";
import Kundali from "../components/astrology/Kundali";
import CelestialChart from "../components/astrology/CelestialChart";
import type { KundaliData } from "../types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { downloadChart } from "../lib/chartStorage";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const FREE_LIMIT_SECONDS = 300; // 5 minutes

export default function Synthesis() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const isRPCLoaded = useRazorpay();

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
  const [interactionId, setInteractionId] = useState<string | null>(null); // Google Interactions API context
  const scrollRef = useRef<HTMLDivElement>(null);

  const WELCOME_MESSAGE: Message = {
    id: "welcome",
    role: "assistant",
    content:
      "Welcome to your personal synthesis. I am Jyotir, your guide to Vedic insights. How can I assist you today?",
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
      const guestData = sessionStorage.getItem("astroyou_guest_profile");
      const guestComplete = sessionStorage.getItem("astroyou_guest_complete");

      if (guestData && guestComplete) {
        setBirthData(JSON.parse(guestData));
      } else {
        // No guest data? Try localStorage before forcing onboarding
        const localData = localStorage.getItem("astroyou_profile");
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
      const guestData = sessionStorage.getItem("astroyou_guest_profile");
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
    // Reset interaction ID when chat changes (new conversation context)
    setInteractionId(null);

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

      setMessages(msgs.length > 0 ? msgs : [WELCOME_MESSAGE]);
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
    const saved = localStorage.getItem("astroyou_free_seconds");
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
        localStorage.setItem("astroyou_free_seconds", next.toString());
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
          // Verify payment
          const verifyResp = await fetch("/api/pay/verify", {
            method: "POST",
            body: JSON.stringify(response),
          });
          const verifyData = await verifyResp.json();

          if (verifyData.status === "success") {
            // Update Firestore
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
              credits: increment(minutes),
            });
            setCredits((prev) => prev + minutes);
            alert(`Succesfully added ${minutes} minutes!`);
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
      alert("Payment failed to initialize.");
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

      // Deduct credit if user is logged in
      if (user && credits > 0) {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { credits: increment(-1) });
        setCredits((prev) => prev - 1);
      }

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

      const response = await fetch("/api/synthesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Only send the last message - Google manages conversation history via interactionId
          messages: [{ role: userMsg.role, content: userMsg.content }],
          birthData,
          kundaliData,
          previousInteractionId: interactionId, // Pass previous interaction for context
        }),
      });

      const data = await response.json();

      // Store the new interaction ID for next turn
      if (data.interactionId) {
        setInteractionId(data.interactionId);
      }

      if (data.content) {
        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.content,
          timestamp: new Date(),
        };

        if (user && chatId) {
          // Save AI message to Firestore
          await addDoc(
            collection(db, "users", user.uid, "chats", chatId, "messages"),
            {
              role: "assistant",
              content: data.content,
              timestamp: serverTimestamp(),
              suggestAction: data.suggestAction,
            }
          );
        } else {
          // If guest, just update state
          const msgWithAction = { ...aiMsg, suggestAction: data.suggestAction };
          setMessages((prev) => [...prev, msgWithAction]);
        }

        // Auto-action if suggested
        if (data.suggestAction === "show_chart") {
          setTimeout(() => setShowExpandedChart(true), 1500);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSynthesizing(false);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSynthesizing]);

  const remainingSeconds = Math.max(0, FREE_LIMIT_SECONDS - secondsUsed);

  return (
    <div className="h-screen bg-[#010103] flex flex-col text-content-primary overflow-hidden">
      <SynthesisSEO />

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Leftmost: Conversation Sidebar (Hidden on mobile) */}
        {user && (
          <aside
            className={`hidden md:flex ${
              isSidebarCollapsed ? "w-0 opacity-0" : "w-72 opacity-100"
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
        {user && (
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className={`hidden md:flex absolute ${
              isSidebarCollapsed ? "left-4" : "left-[17rem]"
            } top-14 z-50 p-2 rounded-full border border-white/10 bg-black/40 backdrop-blur-md text-white/40 hover:text-gold hover:border-gold/30 transition-all duration-300`}
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen size={16} />
            ) : (
              <PanelLeftClose size={16} />
            )}
          </button>
        )}

        {/* Middle/Left: Celestial Blueprint */}
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

        {/* Right: Synthesis Chat Area */}
        <div className="flex-1 flex flex-col relative bg-[#030308]">
          <div className="absolute inset-0 z-0 pointer-events-none opacity-5">
            <div className="absolute top-[20%] left-[10%] w-[40vw] h-[40vw] bg-violet blur-[150px] rounded-full"></div>
            <div className="absolute bottom-[20%] right-[10%] w-[30vw] h-[30vw] bg-gold blur-[150px] rounded-full"></div>
          </div>

          {/* Mobile Header (Hidden on Desktop) */}
          <div className="md:hidden p-4 border-b border-white/5 bg-black/40 backdrop-blur-md flex justify-between items-center z-20">
            <button
              onClick={() => navigate("/dashboard")}
              className="text-white/40"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="font-display tracking-[0.2em] uppercase text-xs">
              Synthesis
            </span>
            <button
              onClick={() => setCurrentChatId(null)}
              className="text-gold"
            >
              <Plus size={20} />
            </button>
          </div>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-2 md:p-6 space-y-4 relative z-10 custom-scrollbar"
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

            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${
                  m.role === "user" ? "justify-end" : "justify-start"
                } ${
                  m.role === "user"
                    ? "animate-message-send"
                    : "animate-reveal-progressive"
                }`}
              >
                <div className="max-w-[90%] md:max-w-[85%] group">
                  <div
                    className={`text-xs uppercase tracking-widest mb-1 opacity-30 flex items-center gap-2 ${
                      m.role === "user" ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    {m.role === "user" ? "You" : "Jyotir"}
                    <span>•</span>
                    <span>
                      {m.timestamp.toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "UTC",
                      })}{" "}
                      GMT
                    </span>
                  </div>
                  <div
                    className={`px-4 py-3 rounded-2xl md:rounded-3xl border transition-all duration-300 ${
                      m.role === "user"
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

            {isSynthesizing && (
              <div className="flex justify-start animate-in fade-in duration-300">
                <div className="max-w-[85%]">
                  <div className="text-xs uppercase tracking-widest mb-2 opacity-30">
                    Jyotir
                  </div>
                  <div className="p-4 rounded-3xl border border-gold/10 bg-surface-accent/10 flex items-center gap-4">
                    <Loader2 size={16} className="animate-spin text-gold" />
                    <span className="text-xs uppercase tracking-[0.3em] text-gold/60 animate-pulse">
                      Typing...
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
                className={`absolute right-4 top-1/2 -translate-y-1/2 p-4 transition-all ${
                  input.trim()
                    ? "text-gold scale-110"
                    : "text-white/20 scale-100"
                }`}
                disabled={isSynthesizing || !input.trim()}
              >
                <Send size={24} />
              </button>
            </div>
            <p className="text-center mt-2 text-xs uppercase tracking-[0.2em] text-white/20">
              Personalized for {birthData?.name || "Seeker"}
            </p>
          </div>
        </div>
      </div>

      <OnboardingModal
        isOpen={showOnboardingModal}
        onClose={() => setShowOnboardingModal(false)}
        onComplete={handleOnboardingComplete}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        title="Create Your Profile"
        message="Save your birth charts and access AI insights by creating an account."
      />

      {showExpandedChart && kundaliData && (
        <CelestialChart
          data={kundaliData}
          onClose={() => setShowExpandedChart(false)}
        />
      )}
    </div>
  );
}

// Sidebar Component for Conversations
function ConversationsList({
  userId,
  currentId,
  onSelect,
  onDelete,
}: {
  userId: string;
  currentId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [chats, setChats] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, "users", userId, "chats"),
      orderBy("lastUpdatedAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setChats(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const handleDeleteClick = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    setConfirmingDelete(chatId);
  };

  const handleConfirmDelete = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    onDelete(chatId);
    setConfirmingDelete(null);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmingDelete(null);
  };

  if (isLoading)
    return (
      <div className="p-4 text-xs uppercase tracking-widest opacity-20">
        Aligning...
      </div>
    );
  if (chats.length === 0)
    return (
      <div className="p-4 text-xs tracking-widest opacity-20 italic">
        No past conversation.
      </div>
    );

  return (
    <div className="flex flex-col py-2">
      {chats.map((chat) => (
        <div
          key={chat.id}
          className={`group flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-all border-l-2 cursor-pointer ${
            currentId === chat.id
              ? "border-gold bg-gold/5"
              : "border-transparent"
          }`}
          onClick={() => onSelect(chat.id)}
        >
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-white/80 truncate mb-1">
              {chat.title || "Untitled Synthesis"}
            </div>
            <div className="text-xs text-white/30 truncate">
              {chat.lastUpdatedAt?.toDate?.().toLocaleDateString() || "Recent"}
            </div>
          </div>

          {confirmingDelete === chat.id ? (
            // Inline confirmation UI
            <div className="flex items-center gap-1 animate-in fade-in duration-200">
              <span className="text-xs text-red-400 mr-1">Delete?</span>
              <button
                onClick={(e) => handleConfirmDelete(e, chat.id)}
                className="p-1 rounded hover:bg-red-500/30 text-red-400 transition-all"
                title="Confirm delete"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
              <button
                onClick={handleCancelDelete}
                className="p-1 rounded hover:bg-white/10 text-white/50 transition-all"
                title="Cancel"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ) : (
            // Delete button (shows on hover)
            <button
              onClick={(e) => handleDeleteClick(e, chat.id)}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-all"
              title="Delete chat"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
