import { NavLink } from "react-router-dom";
import { Heart, Home, LayoutGrid, MessageCircle, Sun } from "lucide-react";

/**
 * Phone-only bottom navigation. The five things people come for are one tap
 * away, in words they already use; everything else stays in the header menu.
 */
const ITEMS = [
  // Same words and order as the header's spaces (src/lib/spaces.ts).
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/forecast", label: "Today", icon: Sun },
  { to: "/synthesis", label: "Ask", icon: MessageCircle },
  { to: "/reports", label: "My Chart", icon: LayoutGrid },
  { to: "/compatibility", label: "Matching", icon: Heart },
] as const;

export default function MobileBottomNav() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#030308]/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {ITEMS.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[0.6875rem] font-semibold transition-colors ${
                  isActive ? "text-gold" : "text-white/60 hover:text-white"
                }`
              }
            >
              <Icon size={20} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
