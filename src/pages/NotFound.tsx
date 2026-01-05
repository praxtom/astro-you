import { Link } from "react-router-dom";
import { Home, ArrowLeft, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#030308] flex items-center justify-center p-6">
      {/* Background Ambiance */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[20%] w-[50vw] h-[50vw] bg-violet/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[10%] w-[40vw] h-[40vw] bg-gold/5 blur-[120px] rounded-full"></div>
      </div>

      <div className="w-full max-w-lg relative z-10 text-center">
        {/* 404 Display */}
        <div className="relative mb-8">
          <h1 className="text-[12rem] font-display font-bold text-white/5 leading-none select-none">
            404
          </h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center animate-pulse">
              <Compass className="text-gold" size={40} />
            </div>
          </div>
        </div>

        {/* Message */}
        <h2 className="text-title text-3xl mb-4 font-display">
          Page Not Found
        </h2>
        <p className="text-body text-sm opacity-70 mb-10 leading-relaxed max-w-md mx-auto">
          The page you are looking for does not exist. Please check the URL or
          return to the dashboard.
        </p>

        {/* Navigation */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/"
            className="btn btn-primary py-3 px-8 flex items-center justify-center gap-2"
          >
            <Home size={16} />
            Return Home
          </Link>
          <button
            onClick={() => window.history.back()}
            className="btn btn-outline py-3 px-8 flex items-center justify-center gap-2"
          >
            <ArrowLeft size={16} />
            Go Back
          </button>
        </div>

        {/* Subtle Animation */}
        <div className="mt-16 flex justify-center gap-2">
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
