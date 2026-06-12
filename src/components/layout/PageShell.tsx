import React from "react";
import Header from "./Header";
import { NightSky } from "./NightSky";
import { SpaceTabs } from "./SpaceTabs";

/**
 * The Ephemeris page frame: night sky, header, space tabs, and a consistent
 * content container. Wrap a page's content in this to make it feel like the
 * rest of the app.
 */
export const PageShell: React.FC<{
  children: React.ReactNode;
  /** Hide the space tabs (e.g. on immersive or standalone pages). */
  noTabs?: boolean;
  wide?: boolean;
}> = ({ children, noTabs = false, wide = false }) => (
  <div className="min-h-screen bg-bg-app text-white selection:bg-gold/30">
    <NightSky />
    <Header />
    <main
      className={`container mx-auto pt-28 px-6 pb-16 relative z-10 ${
        wide ? "max-w-7xl" : "max-w-6xl"
      }`}
    >
      {!noTabs && <SpaceTabs />}
      {children}
    </main>
    <footer className="container mx-auto max-w-6xl px-6 py-8 border-t border-white/5 relative z-10">
      <p className="text-[0.6rem] uppercase tracking-[0.35em] text-white/20">
        As above, so below
      </p>
    </footer>
  </div>
);
