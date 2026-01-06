import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MapPin, Loader2, X } from "lucide-react";

interface LocationInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  icon?: React.ReactNode;
}

interface Suggestion {
  display_name: string;
  lat: string;
  lon: string;
}

export default function LocationInput({
  value,
  onChange,
  placeholder = "Search for a city...",
  label,
  className = "",
  icon,
}: LocationInputProps) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout>(null);

  // Update position for portal
  const updatePosition = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom,
        left: rect.left,
        width: rect.width,
      });
    }
  };

  // Sync internal query with external value
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideContainer = containerRef.current?.contains(target);
      const isInsidePortal = portalRef.current?.contains(target);

      if (!isInsideContainer && !isInsidePortal) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle scroll and resize to keep portal positioned correctly
  useEffect(() => {
    if (isOpen) {
      updatePosition();
      // Listen for scroll on any element in the capture phase
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
    }
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  const fetchSuggestions = async (searchQuery: string) => {
    if (searchQuery.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&addressdetails=1&limit=5&featuretype=city`
      );
      const data = await response.json();

      const filtered = data.map((item: any) => ({
        display_name: item.display_name,
        lat: item.lat,
        lon: item.lon,
      }));

      setSuggestions(filtered);
      setIsOpen(filtered.length > 0);
      if (filtered.length > 0) updatePosition();
    } catch (error) {
      console.error("Location search error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(val);
    }, 500);
  };

  const handleSelect = (suggestion: Suggestion) => {
    const displayName = suggestion.display_name;
    setQuery(displayName);
    onChange(displayName);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-caption mb-3 opacity-40 uppercase tracking-widest text-xs font-bold">
          {label}
        </label>
      )}
      <div className="relative group">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (query.length >= 3 && suggestions.length > 0) {
              setIsOpen(true);
              updatePosition();
            }
          }}
          placeholder={placeholder}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 outline-none focus:border-gold/50 transition-all text-xl font-sans font-light pr-14"
        />
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {isLoading ? (
            <Loader2 className="w-5 h-5 text-gold animate-spin" />
          ) : query ? (
            <button
              onClick={() => {
                setQuery("");
                onChange("");
                setSuggestions([]);
              }}
              className="text-white/20 hover:text-white/60 transition-colors"
            >
              <X size={18} />
            </button>
          ) : (
            <div className="text-white/20">{icon || <MapPin size={20} />}</div>
          )}
        </div>
      </div>

      {/* Suggestions Dropdown via Portal */}
      {isOpen &&
        suggestions.length > 0 &&
        createPortal(
          <div
            ref={portalRef}
            className="fixed z-[3000] mt-2 bg-[#0a0a0f] border border-white/10 rounded-xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200"
            style={{
              top: coords.top,
              left: coords.left,
              width: coords.width,
            }}
          >
            <div className="max-h-60 overflow-y-auto">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSelect(s)}
                  className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-none flex items-start gap-3 group"
                >
                  <MapPin className="w-4 h-4 text-gold/40 group-hover:text-gold transition-colors mt-0.5" />
                  <div>
                    <p className="text-sm text-white/80 line-clamp-2">
                      {s.display_name}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
