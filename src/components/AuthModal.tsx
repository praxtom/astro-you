import { useState, useEffect, useRef } from "react";
import { X, Loader2, ArrowLeft, Mail } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signInWithCustomToken,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { STORAGE_KEYS } from "../lib/constants";
import { useDialog } from "../hooks/useDialog";
import { SIGNUP_BONUS_CREDITS } from "../lib/signup-offer";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  title?: string;
  message?: string;
}

const googleProvider = new GoogleAuthProvider();

type AuthStep = "email" | "otp";

const OTP_LENGTH = 6;
const EMPTY_OTP = Array<string>(OTP_LENGTH).fill("");

/**
 * Firebase surfaces internal plumbing failures verbatim ("Database is
 * closing/hidden" from the IndexedDB store, raw HTTP text from the token
 * endpoint). None of that tells a signed-out user what to do next, so every
 * popup failure is mapped to plain language plus a recovery.
 */
function describeGoogleError(err: { code?: string; message?: string }): string {
  switch (err.code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Sign-in was cancelled. Try again when you're ready.";
    case "auth/network-request-failed":
      return "Couldn't reach Google. Check your connection and try again.";
    case "auth/account-exists-with-different-credential":
      return "That email is already registered with a different sign-in method. Use the email code below instead.";
    case "auth/unauthorized-domain":
      return "Google sign-in isn't allowed on this domain yet. Use the email code below, or add this hostname to Firebase Auth's authorized domains.";
    default:
      return "Google sign-in didn't complete. Try again, or use the email code below.";
  }
}

export default function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  title = "Welcome to AstroYou",
  message = `Sign in to save your chart and get ${SIGNUP_BONUS_CREDITS} free credits.`,
}: AuthModalProps) {
  const [step, setStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState<string[]>(EMPTY_OTP);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [resent, setResent] = useState(false);

  const otpRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];
  const modalRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  // Escape, Tab trapping and focus restore come from the shared dialog hook.
  // Focus lands on the email field rather than the close button — opening a
  // dialog focused on its dismiss control reads as "leave" to a screen reader.
  // (useDialog only focuses the first control if focus isn't already inside.)
  useDialog(modalRef, onClose, isOpen);
  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => {
      const target =
        emailRef.current ??
        modalRef.current?.querySelector<HTMLElement>("input, button");
      target?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  // Lock the page behind the dialog so the backdrop can't be scrolled away.
  useEffect(() => {
    if (!isOpen) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [isOpen]);

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
      setOtp(EMPTY_OTP);
      setError("");
      setCountdown(0);
      setResent(false);
      setIsGoogleLoading(false);
    }
  }, [isOpen]);

  const handleSendOTP = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email || !email.includes("@")) {
      setError("Enter a valid email address, like name@example.com.");
      emailRef.current?.focus();
      return;
    }

    const isResend = step === "otp";
    setError("");
    setResent(false);
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
      setOtp(EMPTY_OTP);
      setResent(isResend);
      setCountdown(60); // 60 second cooldown for resend
      setTimeout(() => otpRefs[0].current?.focus(), 100);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Couldn't send the code. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const submitIfComplete = (digits: string[]) => {
    if (digits.every((d) => d !== "")) handleVerifyOTP(digits.join(""));
  };

  const handleOtpChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < OTP_LENGTH - 1) {
      otpRefs[index + 1].current?.focus();
    }

    // Submit as soon as all six digits are present — including when the user
    // goes back and corrects a middle digit, not only when the last one lands.
    if (value) submitIfComplete(newOtp);
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const digits = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, OTP_LENGTH);
    if (!digits) return;
    e.preventDefault();
    const newOtp = [...EMPTY_OTP];
    for (let i = 0; i < digits.length; i++) newOtp[i] = digits[i];
    setOtp(newOtp);
    const nextIndex = Math.min(digits.length, OTP_LENGTH - 1);
    otpRefs[nextIndex].current?.focus();
    submitIfComplete(newOtp);
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      otpRefs[index - 1].current?.focus();
    }
    if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      e.preventDefault();
      otpRefs[index + 1].current?.focus();
    }
  };

  const handleVerifyOTP = async (code: string) => {
    setError("");
    setResent(false);
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
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "That code didn't work. Enter it again.");
      setOtp(EMPTY_OTP);
      otpRefs[0].current?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setIsGoogleLoading(true);

    try {
      await signInWithPopup(auth, googleProvider);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("Google sign-in error:", err);

      // A blocked popup is never the user's decision, and neither is a browser
      // that tore down auth storage mid-flow. Both retry as a full-page
      // redirect, which needs no popup and no cross-window handshake.
      const shouldRetryAsRedirect =
        err.code === "auth/popup-blocked" ||
        err.code === "auth/operation-not-supported-in-this-environment" ||
        err.code === "auth/internal-error" ||
        /database is closing/i.test(err.message ?? "");

      if (shouldRetryAsRedirect) {
        try {
          sessionStorage.setItem(STORAGE_KEYS.LOGIN_REDIRECT, "true");
          await signInWithRedirect(auth, googleProvider);
          return; // page navigates away; keep the spinner up
        } catch (redirectErr: any) {
          console.error("Google redirect sign-in error:", redirectErr);
          setError(describeGoogleError(redirectErr));
        }
      } else {
        setError(describeGoogleError(err));
      }
      setIsGoogleLoading(false);
    }
  };

  const busy = isLoading || isGoogleLoading;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          key="auth-modal"
          className="fixed inset-0 z-[2000] flex items-center justify-center p-4 sm:p-6"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 bg-black/85 backdrop-blur-md"
            onClick={onClose}
          ></motion.div>

          {/* Modal */}
          <motion.div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
            initial={{ opacity: 0, scale: 0.97, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 16 }}
            transition={{
              type: "spring",
              duration: 0.5,
              bounce: 0.2,
            }}
            className="relative z-10 flex max-h-[min(92dvh,46rem)] w-full max-w-md flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a0a0f] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.95)]"
          >
            {/* A single shaft of gold at the head of the panel — the product's
                accent doing the lighting, so the dialog reads as part of
                AstroYou rather than a default browser sheet. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 -top-40 h-96 bg-[radial-gradient(ellipse_50%_45%_at_50%_50%,var(--color-gold-glow),transparent_70%)] opacity-80"
            ></div>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent"
            ></div>

            <button
              onClick={onClose}
              className="absolute top-3 right-3 z-20 flex h-11 w-11 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/5 hover:text-white"
              aria-label="Close dialog"
            >
              <X size={20} />
            </button>

            <div className="relative overflow-y-auto px-6 pt-11 pb-8 sm:px-10 sm:pb-10">
              <AnimatePresence mode="wait" initial={false}>
                {step === "email" ? (
                  <motion.div
                    key="email-step"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="mb-8 text-center">
                      {/* The house mark from the header, so the dialog is
                          recognisably ours at a glance. */}
                      <div
                        aria-hidden="true"
                        className="relative mx-auto mb-5 flex h-10 w-10 items-center justify-center"
                      >
                        <div className="absolute inset-0 rounded-full border border-gold/40"></div>
                        <div className="h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_12px_var(--color-gold)]"></div>
                      </div>
                      <h2
                        id="auth-modal-title"
                        className="font-display text-[1.75rem] leading-[1.15] text-balance text-white"
                      >
                        {title}
                      </h2>
                      <p className="mx-auto mt-3 max-w-[30ch] text-pretty text-sm leading-relaxed text-white/60">
                        {message}
                      </p>
                    </div>

                    {error && (
                      <div
                        role="alert"
                        className="mb-6 rounded-xl border border-red-500/25 bg-red-500/10 p-3.5 text-sm leading-relaxed text-red-300"
                      >
                        {error}
                      </div>
                    )}

                    {/* Google Sign-In Button */}
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={busy}
                      aria-busy={isGoogleLoading}
                      className="group flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-white/12 bg-white/[0.06] transition-colors hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/[0.06]"
                    >
                      {isGoogleLoading ? (
                        <>
                          <Loader2 className="animate-spin" size={18} />
                          <span className="text-sm text-white/80">
                            Opening Google…
                          </span>
                        </>
                      ) : (
                        <>
                          <svg className="h-5 w-5" viewBox="0 0 24 24">
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
                          <span className="font-sans text-sm text-white/80 transition-colors group-hover:text-white">
                            Continue with Google
                          </span>
                        </>
                      )}
                    </button>

                    {/* Divider */}
                    <div className="my-6 flex items-center gap-4">
                      <div className="h-px flex-1 bg-white/10"></div>
                      <span className="font-sans text-[0.65rem] font-bold uppercase tracking-[0.25em] text-white/55">
                        or
                      </span>
                      <div className="h-px flex-1 bg-white/10"></div>
                    </div>

                    <form onSubmit={handleSendOTP} className="space-y-5">
                      <div>
                        <label
                          htmlFor="auth-email"
                          className="mb-2 block font-sans text-[0.7rem] font-bold uppercase tracking-[0.15em] text-white/55"
                        >
                          Email address
                        </label>
                        <input
                          id="auth-email"
                          ref={emailRef}
                          type="email"
                          required
                          autoComplete="email"
                          inputMode="email"
                          placeholder="name@example.com"
                          className="h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 font-sans text-white outline-none transition-colors placeholder:text-white/50 hover:border-white/20 focus:border-gold/60"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          disabled={busy}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={busy}
                        aria-busy={isLoading}
                        className="btn btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-4 font-bold uppercase tracking-widest transition-[background-color,color,transform,box-shadow,opacity] duration-300 disabled:pointer-events-none disabled:opacity-40"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="animate-spin" size={18} />
                            Sending code…
                          </>
                        ) : (
                          <>
                            <Mail size={18} />
                            Send login code
                          </>
                        )}
                      </button>
                    </form>

                    <p className="mt-6 text-center text-xs leading-relaxed text-white/55">
                      By continuing you agree to our{" "}
                      <a
                        href="/terms"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white/75 underline underline-offset-2 transition-colors hover:text-gold"
                      >
                        Terms of Service
                      </a>{" "}
                      and{" "}
                      <a
                        href="/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white/75 underline underline-offset-2 transition-colors hover:text-gold"
                      >
                        Privacy Policy
                      </a>
                      , and consent to analytics cookies.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="otp-step"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {/* OTP Step */}
                    <button
                      onClick={() => setStep("email")}
                      className="-ml-2 mb-6 flex h-11 items-center gap-2 rounded-full px-2 text-white/55 transition-colors hover:text-white"
                    >
                      <ArrowLeft size={16} />
                      <span className="font-sans text-xs font-bold uppercase tracking-[0.15em]">
                        Back
                      </span>
                    </button>

                    <div className="mb-8 text-center">
                      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
                        <Mail className="text-gold" size={24} />
                      </div>
                      <h2
                        id="auth-modal-title"
                        className="font-display text-[1.6rem] leading-[1.15] text-white"
                      >
                        Check your email
                      </h2>
                      <p className="mt-3 text-sm leading-relaxed text-white/60">
                        We sent a 6-digit code to
                        <br />
                        <span className="break-all text-gold">{email}</span>
                      </p>
                    </div>

                    {error && (
                      <div
                        role="alert"
                        className="mb-6 rounded-xl border border-red-500/25 bg-red-500/10 p-3.5 text-center text-sm leading-relaxed text-red-300"
                      >
                        {error}
                      </div>
                    )}

                    {/* OTP Input */}
                    <div className="mb-7 flex justify-center gap-1.5 sm:gap-2">
                      {otp.map((digit, index) => (
                        <input
                          key={index}
                          ref={otpRefs[index]}
                          type="text"
                          inputMode="numeric"
                          autoFocus={index === 0}
                          autoComplete={index === 0 ? "one-time-code" : "off"}
                          aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(index, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(index, e)}
                          onPaste={handleOtpPaste}
                          className="h-14 min-w-0 flex-1 rounded-xl border border-white/20 bg-white/5 text-center font-sans text-xl font-bold text-white outline-none transition-colors focus:border-gold/60 focus:bg-gold/5 disabled:opacity-50 sm:max-w-[3.25rem]"
                          disabled={isLoading}
                        />
                      ))}
                    </div>

                    <div
                      className="flex h-6 items-center justify-center"
                      aria-live="polite"
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2 font-sans text-xs text-white/60">
                          <Loader2 className="animate-spin text-gold" size={16} />
                          Verifying your code…
                        </span>
                      ) : resent ? (
                        <span className="font-sans text-xs text-gold">
                          A new code is on its way.
                        </span>
                      ) : null}
                    </div>

                    {/* Resend */}
                    <div className="mt-4 text-center">
                      {countdown > 0 ? (
                        <p className="font-sans text-xs text-white/55">
                          Resend code in{" "}
                          <span className="text-gold">{countdown}s</span>
                        </p>
                      ) : (
                        <button
                          onClick={() => handleSendOTP()}
                          disabled={isLoading}
                          className="font-sans text-xs text-gold/80 underline underline-offset-4 transition-colors hover:text-gold disabled:opacity-40"
                        >
                          Didn't get the code? Send another
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
