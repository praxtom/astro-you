import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Send,
  Clock,
  Loader2,
  User as UserIcon,
  CreditCard,
  Sparkles,
} from "lucide-react";
import AuthModal from "../components/AuthModal";
import { useAuth } from "../lib/AuthContext";
import { doc, getDoc, updateDoc, increment } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useRazorpay } from "../hooks/useRazorpay";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const FREE_LIMIT_SECONDS = 300; // 5 minutes

export default function Synthesis() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isRPCLoaded = useRazorpay();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Welcome to the Celestial Synthesis. I am the voice of the stars. Ask me anything about your destiny, current transits, or spiritual path.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [secondsUsed, setSecondsUsed] = useState(0);
  const [credits, setCredits] = useState(0); // Minutes
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [birthData, setBirthData] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load profile data and enforce onboarding
  useEffect(() => {
    const loadData = async () => {
      // 1. Check for logged in user data
      if (user) {
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && docSnap.data().name) {
            const data = docSnap.data();
            setBirthData(data);
            setCredits(data.credits || 0);
          } else {
            // Check session storage first (for users who just completed onboarding but haven't synced yet)
            const temp = sessionStorage.getItem("astroyou_temp_profile");
            if (temp) {
              setBirthData(JSON.parse(temp));
            } else {
              navigate("/onboarding");
            }
          }
        } catch (err) {
          console.error("Error fetching data:", err);
        }
      } else {
        // 2. Check for guest session data
        const temp = sessionStorage.getItem("astroyou_temp_profile");
        const isComplete = sessionStorage.getItem("astroyou_profile_complete");
        if (temp && isComplete) {
          setBirthData(JSON.parse(temp));
        } else {
          // No profile data at all -> Go through onboarding
          navigate("/onboarding");
        }
      }
    };
    loadData();
  }, [user, navigate]);

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
        description: `Purchase ${minutes} Celestial Minutes`,
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

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsSynthesizing(true);

    try {
      // Deduct credit if user is logged in
      if (user && credits > 0) {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { credits: increment(-1) });
        setCredits((prev) => prev - 1);
      }

      const response = await fetch("/api/synthesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          birthData,
        }),
      });

      const data = await response.json();
      if (data.content) {
        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.content,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
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
    <div className="min-h-screen bg-[#010103] flex flex-col text-content-primary">
      {/* Header */}
      <header className="py-6 px-10 border-b border-white/5 flex justify-between items-center z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/")}
            className="text-white/50 hover:text-white"
          >
            ←
          </button>
          <span className="font-display tracking-widest uppercase text-lg">
            Celestial Synthesis
          </span>
        </div>

        <div className="flex items-center gap-6">
          {!user ? (
            <div className="flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-full border border-gold/30 text-gold bg-gold/5">
              <Clock size={12} />
              <span>
                {Math.floor(remainingSeconds / 60)}:
                {(remainingSeconds % 60).toString().padStart(2, "0")} FREE TRIAL
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-full border border-gold/30 text-gold bg-gold/5">
                <Sparkles size={12} />
                <span>{credits} MINS REMAINING</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-white/40">
                <UserIcon size={12} />
                <span>{user.displayName || user.email}</span>
              </div>
            </div>
          )}

          <button
            onClick={() => handlePurchase(60, 499)}
            disabled={isPaying}
            className="btn btn-primary !py-2 !px-6 !text-[0.7rem] uppercase flex items-center gap-2"
          >
            {isPaying ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <CreditCard size={14} />
            )}
            {user ? "Buy 60 Mins" : "Upgrade"}
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
        <div className="absolute inset-0 z-0 pointer-events-none opacity-20">
          <div className="absolute top-[20%] left-[10%] w-[40vw] h-[40vw] bg-violet blur-[120px] rounded-full"></div>
          <div className="absolute bottom-[20%] right-[10%] w-[30vw] h-[30vw] bg-gold blur-[120px] rounded-full"></div>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-10 space-y-8 relative z-10"
        >
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[70%] p-6 rounded-2xl border ${
                  m.role === "user"
                    ? "bg-white/5 border-white/10"
                    : "bg-surface-accent/20 border-gold/10"
                }`}
              >
                <p className="text-body leading-relaxed whitespace-pre-wrap">
                  {m.content}
                </p>
              </div>
            </div>
          ))}
          {isSynthesizing && (
            <div className="text-gold/40 text-xs animate-pulse">
              Synthesizing...
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-10 z-10">
          <div className="relative max-w-4xl mx-auto">
            <textarea
              rows={1}
              placeholder="Ask the stars..."
              className="w-full bg-white/5 border border-white/10 rounded-3xl px-8 py-6 outline-none focus:border-gold/50 transition-all font-sans text-lg pr-20"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" &&
                !e.shiftKey &&
                (e.preventDefault(), handleSend())
              }
            />
            <button
              onClick={handleSend}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-4 text-gold/60"
            >
              <Send size={24} />
            </button>
          </div>
        </div>
      </main>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        title="Time for Deeper Insights"
        message="Your free session has concluded. Join the stars to unlock unlimited access and personalized cosmic tracking."
      />
    </div>
  );
}
