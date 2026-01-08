import { Routes, Route, useLocation } from "react-router-dom";
import { Suspense, lazy } from "react";
import { AnimatePresence } from "framer-motion";
import ErrorBoundary from "./components/ErrorBoundary";
import PageTransition from "./components/layout/PageTransition";
import { OfflineIndicator } from "./lib/useNetworkStatus";

// Lazy load pages for better performance
const Landing = lazy(() => import("./pages/Landing"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Synthesis = lazy(() => import("./pages/Synthesis"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const TransitOracle = lazy(() => import("./pages/TransitOracle"));
const DailyForecast = lazy(() => import("./pages/DailyForecast"));
const Compatibility = lazy(() => import("./pages/Compatibility"));
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
    </ErrorBoundary>
  );
}

export default App;
