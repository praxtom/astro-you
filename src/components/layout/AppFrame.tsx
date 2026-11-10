import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useLocation, useNavigate, useOutlet } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AlertTriangle, RefreshCw } from "lucide-react";
import Header from "./Header";
import Footer from "./Footer";
import MobileBottomNav from "./MobileBottomNav";
import { NightSky } from "./NightSky";
import PageTransition from "./PageTransition";
import AuthModal from "../AuthModal";
import { useAuth } from "../../lib/useAuth";
import { reportError } from "../../lib/reportError";
import {
  AUTH_PROMPT_EVENT,
  clearReturnTo,
  isSafeReturnPath,
  storeReturnTo,
  takeReturnTo,
  type SignInRequest,
} from "../../lib/auth-prompt";

/**
 * Transition key for a path: the first segment, so /synthesis and
 * /synthesis/abc don't animate between each other. A consult chat is keyed
 * per guide: hopping from one guide's sitting to another must remount, or the
 * new guide inherits the previous transcript and the old session never gets
 * its unmount cleanup.
 */
function pageKey(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] === "consult" && segments[2] === "chat") {
    return `/consult/${segments[1]}/chat`;
  }
  return "/" + (segments[0] || "");
}

/**
 * Contains a page crash to the page: header, nav and footer stay usable, and
 * the boundary is keyed by path in AppFrame so navigating away resets it.
 */
class RouteErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    reportError(error, { boundary: "route" });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="container mx-auto max-w-2xl px-4 pt-28 pb-16 sm:px-6">
        <div
          role="alert"
          className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-center md:p-8"
        >
          <AlertTriangle className="mx-auto mb-4 text-amber-400/80" size={28} />
          <h1 className="font-display text-2xl text-white">
            This page couldn't load
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/60">
            Something went wrong on our side. Try again, or pick another page
            from the menu.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gold px-5 text-sm font-bold text-black"
            >
              <RefreshCw size={15} /> Try again
            </button>
            <Link
              to="/dashboard"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-5 text-sm font-semibold text-white/75 hover:text-white"
            >
              Go to home
            </Link>
          </div>
        </div>
      </div>
    );
  }
}

/**
 * The shared sign-in dialog. Pages ask for it with `requestSignIn()` (see
 * lib/auth-prompt); the header's "Sign in" button uses it directly. After a
 * successful sign-in the user stays on the page, or lands on `returnTo`.
 */
function useAuthPrompt() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [request, setRequest] = useState<SignInRequest | null>(null);
  const returnToRef = useRef<string | null>(null);
  const onSuccessRef = useRef<(() => void) | null>(null);
  const succeededRef = useRef(false);
  const currentPath = location.pathname + location.search;
  const currentPathRef = useRef(currentPath);
  useEffect(() => {
    currentPathRef.current = currentPath;
  }, [currentPath]);

  const finishSignIn = useCallback(() => {
    const target = returnToRef.current ?? takeReturnTo();
    returnToRef.current = null;
    clearReturnTo();
    if (target && target !== currentPathRef.current) {
      navigate(target, { replace: true });
    }
  }, [navigate]);

  const open = useCallback((next: SignInRequest = {}) => {
    const target = isSafeReturnPath(next.returnTo) ? next.returnTo : null;
    returnToRef.current = target;
    onSuccessRef.current = next.onSuccess ?? null;
    succeededRef.current = false;
    // Stored too, so the full-page Google redirect fallback lands back here.
    if (target) storeReturnTo(target);
    else clearReturnTo();
    setRequest(next);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      open((event as CustomEvent<SignInRequest>).detail ?? {});
    };
    window.addEventListener(AUTH_PROMPT_EVENT, handler);
    return () => window.removeEventListener(AUTH_PROMPT_EVENT, handler);
  }, [open]);

  // Returning from the Google redirect fallback: the page reloaded, so only
  // the stored target remains.
  useEffect(() => {
    if (user) finishSignIn();
  }, [user, finishSignIn]);

  const onClose = useCallback(() => {
    setRequest(null);
    // AuthModal calls onClose right before onSuccess; wait a tick to tell a
    // dismissal from a successful sign-in.
    window.setTimeout(() => {
      if (succeededRef.current) return;
      returnToRef.current = null;
      onSuccessRef.current = null;
      clearReturnTo();
    }, 0);
  }, []);

  const onSuccess = useCallback(() => {
    succeededRef.current = true;
    setRequest(null);
    const callback = onSuccessRef.current;
    onSuccessRef.current = null;
    finishSignIn();
    callback?.();
  }, [finishSignIn]);

  return { request, open, onClose, onSuccess };
}

/**
 * The one app frame: night sky, header and footer are rendered once here and
 * stay mounted while pages change underneath. Every page except the
 * full-screen ones (landing, onboarding, chat) is a child route of this.
 * Pages render only their content; use PageShell for the standard container.
 */
export function AppFrame() {
  const location = useLocation();
  const outlet = useOutlet();
  const authPrompt = useAuthPrompt();
  return (
    <div className="relative flex min-h-screen flex-col bg-bg-app text-white selection:bg-gold/30">
      <NightSky />
      <Header onShowAuth={() => authPrompt.open()} />
      <main id="main-content" className="relative z-10 flex-1">
        <AnimatePresence mode="wait">
          <PageTransition key={pageKey(location.pathname)}>
            <RouteErrorBoundary key={location.pathname}>
              <Suspense fallback={<RouteLoading />}>{outlet}</Suspense>
            </RouteErrorBoundary>
          </PageTransition>
        </AnimatePresence>
      </main>
      {/* Bottom padding on phones keeps the footer clear of the fixed nav. */}
      <div className="relative z-10 pb-16 md:pb-0">
        <Footer />
      </div>
      <MobileBottomNav />
      <AuthModal
        isOpen={authPrompt.request !== null}
        onClose={authPrompt.onClose}
        onSuccess={authPrompt.onSuccess}
        title={authPrompt.request?.title}
        message={authPrompt.request?.message}
      />
    </div>
  );
}

/** Shown while a route's code loads, so slow connections never see a blank page. */
function RouteLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-gold motion-reduce:animate-none" />
      <p className="text-sm text-white/55">Loading…</p>
    </div>
  );
}

/** Full-screen pages that bring their own chrome (landing, onboarding, chat). */
export function Standalone({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <main id="main-content">
      <PageTransition key={pageKey(location.pathname)}>
        <Suspense fallback={<RouteLoading />}>{children}</Suspense>
      </PageTransition>
    </main>
  );
}
