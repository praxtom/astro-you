import SEO from "../components/SEO";
import { Link } from "react-router-dom";
import { Home, ArrowLeft, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 pt-28 pb-16">
      <SEO title="Page Not Found" description="This page does not exist. Browse AstroYou’s astrology tools or return home." noindex />

      <div className="w-full max-w-lg relative z-10 text-center">
        {/* 404 Display: decorative; the real page title is the h1 below. */}
        <div className="relative mb-8" aria-hidden="true">
          <p className="text-[9rem] sm:text-[12rem] font-display font-bold text-white/5 leading-none select-none">
            404
          </p>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center motion-safe:animate-pulse">
              <Compass className="text-gold" size={40} />
            </div>
          </div>
        </div>

        {/* Message */}
        <h1 className="text-title text-3xl mb-4 font-display">
          Page not found
        </h1>
        <p className="text-body text-sm text-white/70 mb-10 leading-relaxed max-w-md mx-auto">
          This page does not exist. Check the address, or head back home.
        </p>

        {/* Navigation */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/"
            className="btn btn-primary py-3 px-8 flex items-center justify-center gap-2"
          >
            <Home size={16} aria-hidden="true" />
            Return Home
          </Link>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="btn btn-outline py-3 px-8 flex items-center justify-center gap-2"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Go Back
          </button>
        </div>

        {/* Subtle Animation */}
        <div className="mt-16 flex justify-center gap-2" aria-hidden="true">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 bg-gold/30 rounded-full animate-pulse"
              style={{ animationDelay: `${i * 200}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
