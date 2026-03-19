# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the marketing-style feature grid dashboard with a two-zone layout that prioritizes Synthesis chat and surfaces user state.

**Architecture:** Single-page rewrite of Dashboard.tsx into a `lg:grid-cols-[3fr_2fr]` grid. Primary zone holds the hero CTA, quick actions, and active practices. Side zone holds forecast, soul insight, and quick links. All existing hooks and child components are reused; only the layout JSX and one child margin change.

**Tech Stack:** React 19, TypeScript, Tailwind v4, Firebase Firestore (`getDocs`), Framer Motion (SoulInsightCard only), Lucide React icons.

**Spec:** `docs/superpowers/specs/2026-03-20-dashboard-redesign-design.md`

---

### Task 1: Fix SoulInsightCard margins

**Files:**
- Modify: `src/components/dashboard/SoulInsightCard.tsx`

- [ ] **Step 1: Remove baked-in bottom margins from all SoulInsightCard variants**

In `src/components/dashboard/SoulInsightCard.tsx`, there are 4 `motion.div` blocks (one per priority variant). Each has `mb-6` or similar. Change all to `mb-0`:

Find and replace all occurrences of `p-4 mb-6` with `p-4` in the component's outer `motion.div` className strings. There are 4 instances (Growth, Vibe Shift, Soul Nudge, Gentle Affirmation).

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/SoulInsightCard.tsx
git commit -m "refactor(dashboard): remove baked-in margins from SoulInsightCard"
```

---

### Task 2: Rewrite Dashboard.tsx — imports, state, and data fetching

**Files:**
- Modify: `src/pages/Dashboard.tsx`

- [ ] **Step 1: Replace the imports block**

Replace the entire import section (lines 1-28) with:

```tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { useUserProfile } from "../hooks";
import { useConsciousness } from "../hooks/useConsciousness";
import { useProactiveTriggers } from "../hooks/useProactiveTriggers";
import { STORAGE_KEYS } from "../lib/constants";
import { useErrorToast } from "../components/ui/Toast";
import {
  MessageSquare,
  Sun,
  Heart,
  Compass,
  Settings,
  ArrowUpRight,
  Sparkles,
  Flame,
  Brain,
} from "lucide-react";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import OnboardingModal from "../components/OnboardingModal";
import Header from "../components/layout/Header";
import { DailyAltar } from "../components/sadhana/DailyAltar";
import { SoulInsightCard } from "../components/dashboard/SoulInsightCard";
import { DharmaList } from "../components/dharma/DharmaList";
```

Removed: `Crown`, `ChevronRight`, `FileText`, `History`, `FeatureCardProps` import.
Added: Firestore imports (`collection`, `query`, `orderBy`, `limit`, `getDocs`), `db`, `DharmaList`.

- [ ] **Step 2: Remove the FeatureCard component definition**

Delete the entire `const FeatureCard = (...)` block (old lines 30-91).

- [ ] **Step 3: Add last-chat state and query**

Inside the `Dashboard()` function, after the existing state declarations, add:

```tsx
// Last chat for "Continue" CTA
const [lastChat, setLastChat] = useState<{ chatId: string; title: string } | null>(null);
```

After the existing `useEffect` for guest data (the one with `setGuestData`), add a new effect:

```tsx
// Fetch most recent chat for Synthesis hero card
useEffect(() => {
  if (!user) return;
  const fetchLastChat = async () => {
    try {
      const chatsRef = collection(db, "users", user.uid, "chats");
      const q = query(chatsRef, orderBy("updatedAt", "desc"), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const doc = snap.docs[0];
        setLastChat({ chatId: doc.id, title: doc.data().title || "Untitled" });
      }
    } catch {
      // Silently fail — hero card falls back to "Start a conversation"
    }
  };
  fetchLastChat();
}, [user]);
```

- [ ] **Step 4: Remove the `features` array**

Delete the entire `const features: FeatureCardProps[] = [...]` block (old lines 227-289).

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit`
Expected: Errors about missing JSX references (the return block still references old components). This is expected — we fix it in Task 3.

---

### Task 3: Rewrite Dashboard.tsx — loading skeleton and return JSX

**Files:**
- Modify: `src/pages/Dashboard.tsx`

- [ ] **Step 1: Replace the loading state**

Replace the `if (isLoading)` block with a skeleton layout:

```tsx
if (isLoading) {
  return (
    <div className="min-h-screen bg-[#030308] text-white">
      <Header onShowOnboarding={() => {}} />
      <main className="container mx-auto pt-24 px-6 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
          {/* Primary zone skeleton */}
          <div className="space-y-4">
            <div className="h-6 bg-white/5 rounded-lg animate-pulse w-48" />
            <div className="glass rounded-2xl p-6 space-y-3">
              <div className="h-5 bg-white/5 rounded animate-pulse w-40" />
              <div className="h-4 bg-white/5 rounded animate-pulse w-64" />
              <div className="h-10 bg-white/5 rounded-xl animate-pulse w-48 mt-4" />
            </div>
            <div className="flex gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="glass rounded-xl p-4 w-32 h-20 animate-pulse" />
              ))}
            </div>
          </div>
          {/* Side zone skeleton */}
          <div className="space-y-4">
            <div className="glass rounded-2xl p-5 space-y-2">
              <div className="h-4 bg-white/5 rounded animate-pulse w-32" />
              <div className="h-3 bg-white/5 rounded animate-pulse w-full" />
              <div className="h-3 bg-white/5 rounded animate-pulse w-5/6" />
            </div>
            <div className="glass rounded-2xl p-5 h-20 animate-pulse" />
          </div>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Replace the entire return JSX**

Replace everything from `return (` to the closing `);` of the return statement with the new two-zone layout. Keep the `getZodiacSign` function and `fetchPrediction` useEffect untouched — they stay above the return.

```tsx
return (
  <div className="min-h-screen bg-[#030308] text-white selection:bg-gold/30">
    {/* Subtle background — single small blur */}
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      <div className="absolute top-0 right-1/4 w-[30vw] h-[30vw] bg-violet-600/3 blur-[100px] rounded-full" />
    </div>

    <Header onShowOnboarding={() => setShowOnboardingModal(true)} />

    <main className="container mx-auto pt-24 px-6 pb-8 relative z-10">
      {/* Welcome Strip */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <h2 className="text-3xl md:text-4xl font-display leading-tight">
          Welcome,{" "}
          <span className="text-gold italic">
            {userData?.profile?.name || userData?.name || "Seeker"}
          </span>
        </h2>
        {atmanState && (
          <div className="flex items-center gap-4">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border capitalize ${
              atmanState.emotionalState === 'stable' ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' :
              atmanState.emotionalState === 'anxious' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' :
              atmanState.emotionalState === 'chaotic' ? 'text-red-400 border-red-500/30 bg-red-500/10' :
              'text-white/60 border-white/10 bg-white/5'
            }`}>
              {atmanState.emotionalState || 'Neutral'}
            </span>
            {(atmanState.meditationStreak || 0) > 0 && (
              <div className="flex items-center gap-1.5 text-amber-400">
                <Flame size={14} />
                <span className="text-xs font-medium">{atmanState.meditationStreak} day streak</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Two-Zone Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 items-start">

        {/* ── PRIMARY ZONE ── */}
        <div className="space-y-5">

          {/* Synthesis Hero Card */}
          <div className="glass rounded-2xl p-6 border-l-2 border-gold animate-reveal-progressive">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-xl bg-gold/10 text-gold">
                <MessageSquare size={20} />
              </div>
              <h3 className="text-xl font-display tracking-wider text-white">Talk to Jyotish</h3>
            </div>
            <p className="text-sm text-white/50 mb-5">
              {lastChat
                ? "Pick up where you left off or start a new conversation."
                : "Your personal Vedic guide is ready."}
            </p>
            <div className="flex flex-wrap gap-3">
              {lastChat && (
                <button
                  onClick={() => navigate(`/synthesis/${lastChat.chatId}`)}
                  className="px-4 py-2.5 rounded-xl bg-gold text-black font-medium text-sm hover:bg-gold/90 transition-colors"
                >
                  Continue: "{lastChat.title.length > 30 ? lastChat.title.slice(0, 30) + '...' : lastChat.title}"
                </button>
              )}
              <button
                onClick={() => navigate("/synthesis")}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  lastChat
                    ? "border border-white/10 text-white/70 hover:bg-white/5 hover:text-white"
                    : "bg-gold text-black hover:bg-gold/90"
                }`}
              >
                {lastChat ? "New conversation" : "Start a conversation"}
                {!lastChat && <ArrowUpRight size={14} className="inline ml-1.5" />}
              </button>
            </div>
          </div>

          {/* Quick Actions Row */}
          <nav aria-label="Quick actions" className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1">
            {[
              { icon: <Sun size={20} />, label: "Daily Forecast", route: "/forecast", color: "rgba(245, 158, 11, 0.8)" },
              { icon: <Compass size={20} />, label: "Transit Oracle", route: "/transit", color: "rgba(59, 130, 246, 0.8)" },
              { icon: <Heart size={20} />, label: "Compatibility", route: "/compatibility", color: "rgba(239, 68, 68, 0.8)" },
            ].map((action) => (
              <button
                key={action.route}
                onClick={() => navigate(action.route)}
                className="group relative glass rounded-xl p-4 min-w-[120px] flex-1 snap-start text-left hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
              >
                <div
                  className="absolute -inset-10 opacity-0 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none"
                  style={{ background: `radial-gradient(circle, ${action.color} 0%, transparent 70%)` }}
                />
                <div className="relative z-10">
                  <div className="mb-2" style={{ color: action.color }}>{action.icon}</div>
                  <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">{action.label}</span>
                </div>
              </button>
            ))}
          </nav>

          {/* Active Practices */}
          {user && atmanState?.routines && atmanState.routines.length > 0 && (
            <div className="glass rounded-2xl p-5">
              <DharmaList
                routines={atmanState.routines}
                userId={user.uid}
                onComplete={refreshAtman}
              />
            </div>
          )}
        </div>

        {/* ── SIDE ZONE ── */}
        <aside className="space-y-4">

          {/* Today's Forecast */}
          <div className="glass rounded-2xl p-5 animate-reveal-progressive">
            <h4 className="text-xs uppercase tracking-widest text-white/40 font-bold mb-3">Today's Reading</h4>
            {isPredictionLoading ? (
              <div className="space-y-2">
                <div className="h-3 bg-white/5 rounded animate-pulse w-full" />
                <div className="h-3 bg-white/5 rounded animate-pulse w-5/6" />
                <div className="h-3 bg-white/5 rounded animate-pulse w-4/6" />
              </div>
            ) : (
              <>
                <p className="text-sm text-white/70 leading-relaxed italic font-display">
                  {prediction || "The cosmic tides are shifting. The stars are aligning to bring you unique insights today."}
                </p>
                {prediction && (
                  <button
                    onClick={() => navigate("/forecast")}
                    className="mt-3 text-xs text-gold hover:text-white transition-colors inline-flex items-center gap-1 group"
                  >
                    View full forecast
                    <ArrowUpRight size={12} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </button>
                )}
              </>
            )}
          </div>

          {/* Soul Insight */}
          {user && atmanState && (
            <SoulInsightCard
              atmanState={atmanState}
              onOpenSadhanaPath={() => setShowDailyAltar(true)}
            />
          )}

          {/* Quick Links */}
          <div className="flex flex-col gap-2 px-1">
            <button
              onClick={() => setShowOnboardingModal(true)}
              className="flex items-center gap-2 text-sm text-white/40 hover:text-gold transition-colors"
            >
              <Settings size={14} />
              Update Birth Data
            </button>
            {user && (
              <button
                onClick={() => setShowDailyAltar(true)}
                className="flex items-center gap-2 text-sm text-white/40 hover:text-gold transition-colors"
              >
                <Sparkles size={14} />
                Daily Altar
              </button>
            )}
          </div>
        </aside>
      </div>
    </main>

    <footer className="container mx-auto px-6 py-6 border-t border-white/5 opacity-30 text-xs uppercase tracking-[0.3em]">
      <span>Coords: 28.6139° N, 77.2090° E</span>
    </footer>

    <OnboardingModal
      isOpen={showOnboardingModal}
      onClose={() => setShowOnboardingModal(false)}
      onComplete={() => {
        if (!user) {
          const stored = sessionStorage.getItem(STORAGE_KEYS.GUEST_PROFILE);
          if (stored) setGuestData(JSON.parse(stored));
        }
      }}
    />

    {user && (
      <DailyAltar
        isOpen={showDailyAltar}
        onClose={() => setShowDailyAltar(false)}
        userId={user.uid}
        atmanState={atmanState}
        onRefresh={refreshAtman}
      />
    )}
  </div>
);
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors.

Run: `npm run build`
Expected: Clean build, no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat(dashboard): redesign with two-zone layout, synthesis hero, quick actions"
```

---

### Task 4: Cleanup — remove unused type

**Files:**
- Modify: `src/types/components.ts` (check if `FeatureCardProps` is used elsewhere)
- Modify: `src/types/index.ts` (remove re-export if orphaned)

- [ ] **Step 1: Check if FeatureCardProps is used anywhere besides Dashboard**

Run: `grep -r "FeatureCardProps" src/ --include="*.ts" --include="*.tsx" -l`

If only `src/types/components.ts` and `src/types/index.ts` remain (Dashboard no longer imports it), remove the type from both files.

- [ ] **Step 2: Remove if orphaned**

In `src/types/components.ts`: delete the `FeatureCardProps` interface.
In `src/types/index.ts`: remove `FeatureCardProps` from the re-export.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add src/types/
git commit -m "chore: remove unused FeatureCardProps type"
```

---

### Task 5: Final verification

- [ ] **Step 1: Full build check**

Run: `npm run build`
Expected: Clean build, no warnings except the existing chunk size warnings.

- [ ] **Step 2: Visual check**

Run: `npm run dev`
Open `http://localhost:5173/dashboard` in a browser.

Verify:
- Welcome strip shows name + emotional state pill + streak
- Synthesis hero card shows with "Continue" button if user has chats
- 3 quick action cards render in a row
- Side zone shows forecast card, soul insight, and quick links
- Mobile viewport: everything stacks vertically
- Guest mode: no crash, shows simplified layout

- [ ] **Step 3: Final commit if any fixes needed**
