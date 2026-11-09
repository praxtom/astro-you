import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { lazy, useEffect } from "react";
import { SPACES, getSpacePrimaryPath } from "./lib/spaces";
import ErrorBoundary from "./components/ErrorBoundary";
import { AppFrame, Standalone } from "./components/layout/AppFrame";
import { OfflineIndicator } from "./lib/OfflineIndicator";
import { InstallPrompt } from "./components/InstallPrompt";
import { trackAcquisitionEvent } from "./lib/acquisition";
import SEO from "./components/SEO";
import { PUBLIC_PAGE_META } from "./lib/seo-public";
import { isPrivateRoute } from "./lib/seo-routing";
import { SEO_CONTENT_PAGES, SEO_GUIDE_REDIRECTS } from "./lib/seo-content";

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
const Pricing = lazy(() => import("./pages/Pricing"));
const Wallet = lazy(() => import("./pages/Wallet"));
const Reports = lazy(() => import("./pages/Reports"));
const Remedies = lazy(() => import("./pages/Remedies"));
const Support = lazy(() => import("./pages/Support"));
const Trust = lazy(() => import("./pages/Trust"));
const ExpertApply = lazy(() => import("./pages/ExpertApply"));
const Settings = lazy(() => import("./pages/Settings"));
const Admin = lazy(() => import("./pages/Admin"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Terms = lazy(() => import("./pages/Terms"));
const RefundPolicy = lazy(() => import("./pages/RefundPolicy"));
const Disclaimer = lazy(() => import("./pages/Disclaimer"));
const SignHoroscope = lazy(() => import("./pages/SignHoroscope"));
const PanchangSeo = lazy(() => import("./pages/PanchangSeo"));
const MuhuratSeo = lazy(() => import("./pages/MuhuratSeo"));
const SeoContentPage = lazy(() => import("./pages/SeoContentPage"));
const HumanDesign = lazy(() => import("./pages/HumanDesign"));
const AdvancedVedic = lazy(() => import("./pages/AdvancedVedic"));
const Explore = lazy(() => import("./pages/Explore"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Main Application Component
function App() {
  const location = useLocation();
  const publicMeta = PUBLIC_PAGE_META.find(page => page.path === location.pathname);

  useEffect(() => {
    trackAcquisitionEvent("page_view", {
      route: location.pathname,
    });
  }, [location.pathname]);

  return (
    <ErrorBoundary>
      {publicMeta ? <SEO title={publicMeta.title} description={publicMeta.description} /> :
        isPrivateRoute(location.pathname) ? <SEO title="Your AstroYou Account" noindex /> : null}
      <Routes>
        {/* Full-screen pages with their own chrome. */}
        <Route path="/" element={<Standalone><Landing /></Standalone>} />
        <Route path="/onboarding" element={<Standalone><Onboarding /></Standalone>} />
        <Route path="/synthesis/:id?" element={<Standalone><Synthesis /></Standalone>} />
        <Route path="/consult/:personaId/chat" element={<Standalone><ConsultChat /></Standalone>} />
        {/* Everything else shares one frame: header, sky and footer render once. */}
        <Route element={<AppFrame />}>
          {/* Space aliases: /today /guidance /chart /bonds /path land on
              each space's primary page. */}
          {SPACES.map((space) => (
            <Route
              key={space.id}
              path={`/${space.id}`}
              element={<Navigate to={getSpacePrimaryPath(space)} replace />}
            />
          ))}
          {/* Guides merged into their tool page (the server 301s these). */}
          {SEO_GUIDE_REDIRECTS.map(({ from, to }) => (
            <Route key={from} path={from} element={<Navigate to={to} replace />} />
          ))}
          <Route path="/explore" element={<Explore />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/transit" element={<TransitOracle />} />
          <Route path="/forecast" element={<DailyForecast />} />
          <Route path="/compatibility" element={<Compatibility />} />
          <Route path="/consult" element={<Consult />} />
          <Route path="/consult/:personaId" element={<ConsultProfile />} />
          <Route path="/consult/:personaId/profile" element={<ConsultProfile />} />
          <Route path="/free-kundali" element={<FreeKundali />} />
          <Route path="/free-kundali-matching" element={<FreeMatching />} />
          <Route path="/panchang" element={<PanchangSeo />} />
          <Route path="/panchang/:date" element={<PanchangSeo />} />
          <Route path="/muhurat" element={<MuhuratSeo />} />
          <Route path="/muhurat/:category" element={<MuhuratSeo />} />
          <Route path="/help" element={<Help />} />
          <Route path="/numerology" element={<Numerology />} />
          <Route path="/tarot" element={<Tarot />} />
          <Route path="/eclipses" element={<Eclipses />} />
          <Route path="/astromap" element={<AstroMap />} />
          <Route path="/wellness" element={<Wellness />} />
          <Route path="/human-design" element={<HumanDesign />} />
          <Route path="/advanced-vedic" element={<AdvancedVedic />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/remedies" element={<Remedies />} />
          <Route path="/support" element={<Support />} />
          <Route path="/trust" element={<Trust />} />
          <Route path="/experts/apply" element={<ExpertApply />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/subscription" element={<Settings />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/refund-policy" element={<RefundPolicy />} />
          <Route path="/disclaimer" element={<Disclaimer />} />
          <Route path="/horoscope/:sign/:period" element={<SignHoroscope />} />
          <Route path="/horoscope/:sign" element={<SignHoroscope />} />
          {SEO_CONTENT_PAGES.map(({ slug }) => (
            <Route key={slug} path={`/${slug}`} element={<SeoContentPage slug={slug} />} />
          ))}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>

      {/* Global offline indicator */}
      <OfflineIndicator />

      {/* PWA install prompt */}
      <InstallPrompt />
    </ErrorBoundary>
  );
}

export default App;
