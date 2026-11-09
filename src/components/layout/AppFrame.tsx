import { Suspense, type ReactNode } from "react";
import { useLocation, useOutlet } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Header from "./Header";
import Footer from "./Footer";
import { NightSky } from "./NightSky";
import PageTransition from "./PageTransition";

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
 * The one app frame: night sky, header and footer are rendered once here and
 * stay mounted while pages change underneath. Every page except the
 * full-screen ones (landing, onboarding, chat) is a child route of this.
 * Pages render only their content; use PageShell for the standard container.
 */
export function AppFrame() {
  const location = useLocation();
  const outlet = useOutlet();
  return (
    <div className="relative flex min-h-screen flex-col bg-bg-app text-white selection:bg-gold/30">
      <NightSky />
      <Header />
      <main id="main-content" className="relative z-10 flex-1">
        <AnimatePresence mode="wait">
          <PageTransition key={pageKey(location.pathname)}>
            <Suspense fallback={null}>{outlet}</Suspense>
          </PageTransition>
        </AnimatePresence>
      </main>
      <div className="relative z-10">
        <Footer />
      </div>
    </div>
  );
}

/** Full-screen pages that bring their own chrome (landing, onboarding, chat). */
export function Standalone({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <main id="main-content">
      <PageTransition key={pageKey(location.pathname)}>
        <Suspense fallback={null}>{children}</Suspense>
      </PageTransition>
    </main>
  );
}
