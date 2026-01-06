import { Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { FullPageSkeleton } from "./components/ui/Skeleton";
import { OfflineIndicator } from "./lib/useNetworkStatus";

// Lazy load pages for better performance
const Landing = lazy(() => import("./pages/Landing"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Synthesis = lazy(() => import("./pages/Synthesis"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const TransitOracle = lazy(() => import("./pages/TransitOracle"));
const DailyForecast = lazy(() => import("./pages/DailyForecast"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Main Application Component
function App() {
  return (
    <ErrorBoundary>
      {/* Main content with id for skip link */}
      <main id="main-content">
        <Suspense fallback={<FullPageSkeleton />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/synthesis" element={<Synthesis />} />
            <Route path="/synthesis/:id" element={<Synthesis />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/transit" element={<TransitOracle />} />
            <Route path="/forecast" element={<DailyForecast />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>

      {/* Global offline indicator */}
      <OfflineIndicator />
    </ErrorBoundary>
  );
}

export default App;
