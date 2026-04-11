import { Routes, Route, useLocation } from "react-router-dom";
import { Suspense, lazy } from "react";
import { AnimatePresence } from "framer-motion";
import ErrorBoundary from "./components/ErrorBoundary";
import PageTransition from "./components/layout/PageTransition";
import { OfflineIndicator } from "./lib/useNetworkStatus";
import { InstallPrompt } from "./components/InstallPrompt";

// Lazy load pages for better performance
const Landing = lazy(() => import("./pages/Landing"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Synthesis = lazy(() => import("./pages/Synthesis"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const TransitOracle = lazy(() => import("./pages/TransitOracle"));
const DailyForecast = lazy(() => import("./pages/DailyForecast"));
const Compatibility = lazy(() => import("./pages/Compatibility"));
const FreeKundali = lazy(() => import("./pages/FreeKundali"));
const FreeMatching = lazy(() => import("./pages/FreeMatching"));
const Help = lazy(() => import("./pages/Help"));
const Consult = lazy(() => import("./pages/Consult"));
const ConsultChat = lazy(() => import("./pages/ConsultChat"));
const ConsultProfile = lazy(() => import("./pages/ConsultProfile"));
const Numerology = lazy(() => import("./pages/Numerology"));
const Tarot = lazy(() => import("./pages/Tarot"));
const Eclipses = lazy(() => import("./pages/Eclipses"));
const AstroMap = lazy(() => import("./pages/AstroMap"));
const Wellness = lazy(() => import("./pages/Wellness"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Settings = lazy(() => import("./pages/Settings"));
const Admin = lazy(() => import("./pages/Admin"));
const Friends = lazy(() => import("./pages/Friends"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Terms = lazy(() => import("./pages/Terms"));
const SignHoroscope = lazy(() => import("./pages/SignHoroscope"));
const HumanDesign = lazy(() => import("./pages/HumanDesign"));
const AdvancedVedic = lazy(() => import("./pages/AdvancedVedic"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Main Application Component
function App() {
  const location = useLocation();

  // Use base path for animation key so /synthesis and /synthesis/:id don't trigger transitions
  const getAnimationKey = (pathname: string) => {
    const segments = pathname.split("/").filter(Boolean);
    // For paths like /synthesis/abc123, use just /synthesis as the key
    return "/" + (segments[0] || "");
  };

  return (
    <ErrorBoundary>
      {/* Main content with id for skip link */}
      <main id="main-content">
        <AnimatePresence mode="wait">
          <Routes location={location} key={getAnimationKey(location.pathname)}>
            <Route
              path="/"
              element={
                <PageTransition>
                  <Suspense fallback={null}>
                    <Landing />
                  </Suspense>
                </PageTransition>
              }
            />
            <Route
              path="/onboarding"
              element={
                <PageTransition>
                  <Suspense fallback={null}>
                    <Onboarding />
                  </Suspense>
                </PageTransition>
              }
            />
            <Route
              path="/synthesis/:id?"
              element={
                <PageTransition>
                  <Suspense fallback={null}>
                    <Synthesis />
                  </Suspense>
                </PageTransition>
              }
            />
            <Route
              path="/dashboard"
              element={
                <PageTransition>
                  <Suspense fallback={null}>
                    <Dashboard />
                  </Suspense>
                </PageTransition>
              }
            />
            <Route
              path="/transit"
              element={
                <PageTransition>
                  <Suspense fallback={null}>
                    <TransitOracle />
                  </Suspense>
                </PageTransition>
              }
            />
            <Route
              path="/forecast"
              element={
                <PageTransition>
                  <Suspense fallback={null}>
                    <DailyForecast />
                  </Suspense>
                </PageTransition>
              }
            />
            <Route
              path="/compatibility"
              element={
                <PageTransition>
                  <Suspense fallback={null}>
                    <Compatibility />
                  </Suspense>
                </PageTransition>
              }
            />
            <Route
              path="/consult"
              element={
                <PageTransition>
                  <Suspense fallback={null}>
                    <Consult />
                  </Suspense>
                </PageTransition>
              }
            />
            <Route
              path="/consult/:personaId"
              element={
                <PageTransition>
                  <Suspense fallback={null}>
                    <ConsultChat />
                  </Suspense>
                </PageTransition>
              }
            />
            <Route
              path="/free-kundali"
              element={
                <PageTransition>
                  <Suspense fallback={null}>
                    <FreeKundali />
                  </Suspense>
                </PageTransition>
              }
            />
            <Route
              path="/free-kundali-matching"
              element={
                <PageTransition>
                  <Suspense fallback={null}>
                    <FreeMatching />
                  </Suspense>
                </PageTransition>
              }
            />
            <Route
              path="/help"
              element={
                <PageTransition>
                  <Suspense fallback={null}>
                    <Help />
                  </Suspense>
                </PageTransition>
              }
            />
            <Route
              path="/numerology"
              element={
                <PageTransition>
                  <Suspense fallback={null}>
                    <Numerology />
                  </Suspense>
                </PageTransition>
              }
            />
            <Route
              path="/tarot"
              element={
                <PageTransition>
                  <Suspense fallback={null}>
                    <Tarot />
                  </Suspense>
                </PageTransition>
              }
            />
            <Route
              path="/eclipses"
              element={
                <PageTransition>
                  <Suspense fallback={null}>
                    <Eclipses />
                  </Suspense>
                </PageTransition>
              }
            />
            <Route
              path="/astromap"
              element={
                <PageTransition>
                  <Suspense fallback={null}>
                    <AstroMap />
                  </Suspense>
                </PageTransition>
              }
            />
            <Route
              path="/wellness"
              element={
                <PageTransition>
                  <Suspense fallback={null}>
                    <Wellness />
                  </Suspense>
                </PageTransition>
              }
            />
            <Route
              path="/human-design"
              element={
                <PageTransition>
                  <Suspense fallback={null}>
                    <HumanDesign />
                  </Suspense>
                </PageTransition>
              }
            />
            <Route
              path="/advanced-vedic"
              element={
                <PageTransition>
                  <Suspense fallback={null}>
                    <AdvancedVedic />
                  </Suspense>
                </PageTransition>
              }
            />
            <Route
              path="/friends"
              element={
                <PageTransition>
                  <Suspense fallback={null}>
                    <Friends />
                  </Suspense>
                </PageTransition>
              }
            />
            <Route
              path="/u/:username"
              element={
                <PageTransition>
                  <Suspense fallback={null}>
                    <PublicProfile />
                  </Suspense>
                </PageTransition>
              }
            />
            <Route
              path="/pricing"
              element={
                <PageTransition>
                  <Suspense fallback={null}>
                    <Pricing />
                  </Suspense>
                </PageTransition>
              }
            />
            <Route
              path="/settings"
              element={
                <PageTransition>
                  <Suspense fallback={null}>
                    <Settings />
                  </Suspense>
                </PageTransition>
              }
            />
            <Route
              path="/settings/subscription"
              element={
                <PageTransition>
                  <Suspense fallback={null}>
                    <Settings />
                  </Suspense>
                </PageTransition>
              }
            />
            <Route
              path="/admin"
              element={
                <PageTransition>
                  <Suspense fallback={null}>
                    <Admin />
                  </Suspense>
                </PageTransition>
              }
            />
            <Route
              path="/privacy"
              element={
                <PageTransition>
                  <Suspense fallback={null}>
                    <PrivacyPolicy />
                  </Suspense>
                </PageTransition>
              }
            />
            <Route
              path="/terms"
              element={
                <PageTransition>
                  <Suspense fallback={null}>
                    <Terms />
                  </Suspense>
                </PageTransition>
              }
            />
            <Route
              path="/horoscope/:sign/:period"
              element={
                <PageTransition>
                  <Suspense fallback={null}>
                    <SignHoroscope />
                  </Suspense>
                </PageTransition>
              }
            />
            <Route
              path="/horoscope/:sign"
              element={
                <PageTransition>
                  <Suspense fallback={null}>
                    <SignHoroscope />
                  </Suspense>
                </PageTransition>
              }
            />
            <Route
              path="*"
              element={
                <PageTransition>
                  <Suspense fallback={null}>
                    <NotFound />
                  </Suspense>
                </PageTransition>
              }
            />
          </Routes>
        </AnimatePresence>
      </main>

      {/* Global offline indicator */}
      <OfflineIndicator />

      {/* PWA install prompt */}
      <InstallPrompt />
    </ErrorBoundary>
  );
}

export default App;
