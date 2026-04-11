import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { useUserProfile } from "../hooks";
import { getPersonaById } from "../lib/personas";
import {
  doc,
  updateDoc,
  increment,
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { Clock, Send, AlertCircle, ArrowLeft } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function ConsultChat() {
  const { personaId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, birthData } = useUserProfile();
  const persona = getPersonaById(personaId || "");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [sessionActive, setSessionActive] = useState(true);
  const [showRating, setShowRating] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef(Date.now());
  const lastDeductRef = useRef(0);

  // Start timer on mount
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Per-minute credit deduction
  useEffect(() => {
    if (!sessionActive || !user || !persona) return;

    const deductInterval = setInterval(async () => {
      const minutesSoFar = Math.ceil(
        (Date.now() - startTimeRef.current) / 60000,
      );
      if (minutesSoFar > lastDeductRef.current) {
        lastDeductRef.current = minutesSoFar;
        try {
          const userRef = doc(db, "users", user.uid);
          await updateDoc(userRef, {
            credits: increment(-persona.pricePerMin),
          });
        } catch (err) {
          console.error("Credit deduction failed:", err);
        }
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(deductInterval);
  }, [sessionActive, user, persona]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const elapsedMinutes = Math.ceil(elapsedSeconds / 60);
  const cost = elapsedMinutes * (persona?.pricePerMin || 5);
  const creditsRemaining = (profile?.credits || 0) - cost;

  // Auto-end when credits exhausted
  useEffect(() => {
    if (creditsRemaining <= 0 && sessionActive && elapsedSeconds > 0) {
      endSession();
    }
  }, [creditsRemaining, sessionActive, elapsedSeconds]);

  const endSession = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSessionActive(false);
    setShowRating(true);

    // Save consultation record
    if (user && persona) {
      try {
        const finalMinutes =
          Math.ceil((Date.now() - startTimeRef.current) / 60000) || 1;
        await addDoc(collection(db, "users", user.uid, "consultations"), {
          personaId: persona.id,
          personaName: persona.name,
          duration: Math.round((Date.now() - startTimeRef.current) / 1000),
          cost: finalMinutes * persona.pricePerMin,
          messageCount: messages.length,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.error("Failed to save consultation:", err);
      }
    }
  }, [user, persona, messages.length]);

  const sendMessage = async () => {
    if (!input.trim() || !sessionActive || isStreaming) return;
    const userMsg: ChatMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    try {
      const res = await fetch("/api/synthesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          birthData,
          kundaliData: null,
          personaPrompt: persona?.promptModifier,
          personaName: persona?.name,
        }),
      });

      if (!res.ok) throw new Error("Request failed");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "delta") {
              fullContent += data.text;
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
    } catch (err) {
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

  if (!persona) {
    navigate("/consult");
    return null;
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const isLowBalance = creditsRemaining <= 2 * persona.pricePerMin;

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
            <span className="text-2xl">{persona.avatar}</span>
            <div>
              <p className="text-sm font-medium">{persona.name}</p>
              <p className="text-[10px] text-white/40">{persona.specialty}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-amber-400">
              <Clock size={14} />
              <span className="text-sm font-mono">
                {formatTime(elapsedSeconds)}
              </span>
            </div>
            <span className="text-sm text-amber-300 font-bold">₹{cost}</span>
            {isLowBalance && sessionActive && (
              <span className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle size={12} /> Low balance
              </span>
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
                Namaste! I've studied your birth chart. What would you like to
                explore today?
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

          {!sessionActive && (
            <div className="max-w-sm mx-auto my-6 glass rounded-[2rem] p-6 text-center">
              <span className="text-3xl">{persona.avatar}</span>
              <p className="text-sm text-white/60 mt-2">
                Session with {persona.name}
              </p>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">Duration</span>
                  <span>{Math.ceil(elapsedSeconds / 60)} min</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">Rate</span>
                  <span>₹{persona.pricePerMin}/min</span>
                </div>
                <div className="flex justify-between text-sm border-t border-white/10 pt-2">
                  <span className="text-white/60 font-medium">Total</span>
                  <span className="text-gold font-bold">₹{cost}</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      {sessionActive && (
        <div className="sticky bottom-0 bg-[#030308]/90 backdrop-blur border-t border-white/10 px-4 py-3">
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
              disabled={isStreaming}
            />
            <button
              onClick={sendMessage}
              disabled={isStreaming || !input.trim()}
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
              {elapsedMinutes} min &middot; ₹{cost}
            </p>
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
            <button
              onClick={async () => {
                if (user && persona && selectedRating > 0) {
                  try {
                    await addDoc(
                      collection(
                        db,
                        "users",
                        user.uid,
                        "consultations_reviews",
                      ),
                      {
                        personaId: persona.id,
                        rating: selectedRating,
                        createdAt: serverTimestamp(),
                      },
                    );
                  } catch (err) {
                    console.error("Failed to save rating:", err);
                  }
                }
                navigate("/consult");
              }}
              className="w-full py-3 rounded-xl bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
