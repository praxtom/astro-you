import { useState, useEffect, useRef } from "react";
import { X, Loader2, ArrowLeft, Mail } from "lucide-react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithCustomToken,
} from "firebase/auth";
import { auth } from "../lib/firebase";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
}

const googleProvider = new GoogleAuthProvider();

// Check if we're in development (localhost)
const isDev =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

type AuthStep = "email" | "otp";

export default function AuthModal({
  isOpen,
  onClose,
  title = "Create Your Profile",
  message = "Save your birth charts and access AI insights by creating an account.",
}: AuthModalProps) {
  const [step, setStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const otpRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Handle redirect result on component mount (for production)
  useEffect(() => {
    if (!isDev) {
      getRedirectResult(auth)
        .then((result) => {
          if (result?.user) {
            onClose();
          }
        })
        .catch((err) => {
          console.error("Redirect result error:", err);
          setError(err.message || "Google sign-in failed.");
        });
    }
  }, [onClose]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep("email");
      setEmail("");
      setOtp(["", "", "", ""]);
      setError("");
      setCountdown(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSendOTP = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send code");
      }

      setStep("otp");
      setCountdown(60); // 60 second cooldown for resend
      setTimeout(() => otpRefs[0].current?.focus(), 100);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to send code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 3) {
      otpRefs[index + 1].current?.focus();
    }

    // Auto-submit when all digits are entered
    if (value && index === 3 && newOtp.every((d) => d !== "")) {
      handleVerifyOTP(newOtp.join(""));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  };

  const handleVerifyOTP = async (code: string) => {
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Verification failed");
      }

      // Sign in with custom token
      await signInWithCustomToken(auth, data.token);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Invalid code. Please try again.");
      setOtp(["", "", "", ""]);
      otpRefs[0].current?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setIsGoogleLoading(true);

    try {
      if (isDev) {
        await signInWithPopup(auth, googleProvider);
        onClose();
      } else {
        await signInWithRedirect(auth, googleProvider);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Google sign-in failed.");
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-500"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="w-full max-w-md glass p-10 md:p-12 relative z-10 border border-white/10 rounded-3xl animate-in zoom-in-95 fade-in duration-300">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-white/30 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        {step === "email" ? (
          <>
            <div className="text-center mb-10">
              <span className="section-label mb-4 opacity-60">
                Secure Login
              </span>
              <h2 className="text-title text-3xl mb-4">{title}</h2>
              <p className="text-body text-sm opacity-70 px-4">{message}</p>
            </div>

            {/* Google Sign-In Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading}
              className="w-full flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl px-5 py-3.5 mb-6 transition-all group"
            >
              {isGoogleLoading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span className="font-sans text-sm text-white/80 group-hover:text-white transition-colors">
                    Continue with Google
                  </span>
                </>
              )}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 h-px bg-white/10"></div>
              <span className="text-xs text-white/30 uppercase tracking-widest font-sans">
                or
              </span>
              <div className="flex-1 h-px bg-white/10"></div>
            </div>

            <form onSubmit={handleSendOTP} className="space-y-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-4 rounded-xl">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-caption mb-2 opacity-50 uppercase tracking-widest text-xs font-bold">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 outline-none focus:border-gold/50 transition-all font-sans"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary w-full py-4 mt-4 font-bold tracking-widest uppercase flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    <Mail size={18} />
                    Send Login Code
                  </>
                )}
              </button>
            </form>
          </>
        ) : (
          <>
            {/* OTP Step */}
            <button
              onClick={() => setStep("email")}
              className="flex items-center gap-2 text-white/40 hover:text-white/80 transition-colors mb-8"
            >
              <ArrowLeft size={16} />
              <span className="text-xs uppercase tracking-widest font-sans">
                Back
              </span>
            </button>

            <div className="text-center mb-10">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center">
                <Mail className="text-gold" size={28} />
              </div>
              <h2 className="text-title text-2xl mb-3">Check Your Email</h2>
              <p className="text-body text-sm opacity-70 px-4">
                We sent a 4-digit code to
                <br />
                <span className="text-gold">{email}</span>
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-4 rounded-xl mb-6 text-center">
                {error}
              </div>
            )}

            {/* OTP Input */}
            <div className="flex justify-center gap-3 mb-8">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={otpRefs[index]}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  className="w-14 h-16 text-center text-2xl font-bold bg-white/5 border border-white/20 rounded-xl outline-none focus:border-gold/50 focus:bg-gold/5 transition-all font-sans"
                  disabled={isLoading}
                />
              ))}
            </div>

            {isLoading && (
              <div className="flex justify-center mb-6">
                <Loader2 className="animate-spin text-gold" size={24} />
              </div>
            )}

            {/* Resend */}
            <div className="text-center">
              {countdown > 0 ? (
                <p className="text-xs text-white/40 font-sans">
                  Resend code in <span className="text-gold">{countdown}s</span>
                </p>
              ) : (
                <button
                  onClick={() => handleSendOTP()}
                  className="text-xs text-gold/60 hover:text-gold transition-colors underline underline-offset-4 font-sans"
                >
                  Didn't receive the code? Resend
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
