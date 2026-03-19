# Dashboard Redesign — Modern Luxury App

**Date:** 2026-03-20
**Status:** Approved
**Scope:** `src/pages/Dashboard.tsx`, `src/components/dashboard/`

## Problem

The current dashboard is a marketing-style feature grid. Users scroll past a large welcome banner, a prediction block, a soul insight card, and 7 feature cards (2 of which are "Coming Soon" placeholders) before doing anything. The primary action — opening Synthesis chat — is one card among seven. The layout wastes space and doesn't surface the user's active state.

## Design Direction

Modern luxury app: clean, tight, content-forward, dark. The Vedic identity comes through the content (what Jyotish says, Sanskrit terms, chart data), not through heavy chrome. Inspired by Linear/Arc/Raycast — sharp typography, no visual fluff, information density.

## Layout

Two-zone layout on desktop (60/40 split), single-column stack on mobile.

```
Desktop:
┌─────────────────────────────────────────────────┐
│  Header (unchanged)                             │
├────────────────────────┬────────────────────────┤
│   PRIMARY ZONE (60%)   │   SIDE ZONE (40%)      │
│                        │                        │
│   Welcome strip        │   Today's Forecast     │
│   Synthesis hero card  │   Soul Insight         │
│   Quick actions row    │   Quick links          │
│   Active practices     │                        │
│                        │                        │
└────────────────────────┴────────────────────────┘

Mobile (stacked):
  Welcome strip
  Synthesis hero card
  Quick actions (horizontal scroll)
  Active practices
  Today's forecast
  Soul insight
  Quick links
```

**Mobile stacking rationale:** Interactive elements (Synthesis, Quick Actions, Active Practices) come first so users can act immediately. Read-only content (Forecast, Soul Insight) follows below.

## Components

### 1. Welcome Strip

A single line, no card wrapper. Just inline typography.

```
Welcome, Prakhar     ● Stable     🔥 3 day streak
```

- Name in gold Cormorant Garamond display font
- Emotional state as a small colored pill (emerald for stable, amber for anxious, red for chaotic)
- Streak counter inline, only if > 0
- No banner card, no Crown ornament, no background glow
- **Guest users:** Show only "Welcome, {name}" — no consciousness pill, no streak

**Implementation:** Replace the entire `<section className="mb-10">` welcome banner block with a simple flex row.

### 2. Synthesis Hero Card

The largest element on the page. Single glass card with gold left-border accent.

```
┌──────────────────────────────────┐
│  💬  Talk to Jyotish             │
│                                  │
│  Your personal Vedic guide is    │
│  ready. Pick up where you left   │
│  off or start fresh.             │
│                                  │
│  [Continue: "Career guidance..."]│
│  [New conversation ↗]            │
└──────────────────────────────────┘
```

- If user has a recent chat: show its title, "Continue" button navigates to `/synthesis/{chatId}`
- "New" button navigates to `/synthesis`
- If no recent chat or guest user: just show "Start a conversation" with single CTA
- Glass card with `border-l-2 border-gold` accent

**Last Chat Query:**
```typescript
// One-time fetch, not a real-time listener (dashboard doesn't need live updates)
const chatsRef = collection(db, "users", user.uid, "chats");
const q = query(chatsRef, orderBy("updatedAt", "desc"), limit(1));
const snap = await getDocs(q);
// Read: snap.docs[0].id (chatId), snap.docs[0].data().title (chat title)
```
The existing `chats` collection stores `updatedAt` (Timestamp) and `title` (string). This query runs once on mount inside a `useEffect`, guarded by `user` being non-null. Store result in local state: `{ chatId: string; title: string } | null`.

**Guest users:** Show only "Start a conversation" CTA pointing to `/synthesis`. No Firestore query.

### 3. Quick Actions Row

Three compact cards in a horizontal row. Only active (shipped) features.

| Icon | Label | Route | Accent Color |
|------|-------|-------|-------------|
| Sun | Daily Forecast | `/forecast` | `rgba(245, 158, 11, 0.8)` (amber) |
| Compass | Transit Oracle | `/transit` | `rgba(59, 130, 246, 0.8)` (blue) |
| Heart | Compatibility | `/compatibility` | `rgba(239, 68, 68, 0.8)` (red) |

- Icon + title only, no description text
- Each card uses its accent color as a hover glow (same radial gradient technique as current FeatureCard)
- "Coming Soon" features (Dasha Timeline, Life Reports) are completely omitted
- Daily Altar is moved to side zone quick links (it's a modal, not a route)

**Mobile:** `flex overflow-x-auto snap-x snap-mandatory` with `min-w-[120px]` per card.

### 4. Active Practices (conditional, authenticated only)

Only renders if `user && atmanState?.routines?.length > 0`. Reuses the existing `DharmaList` component directly.

```tsx
<DharmaList
  routines={atmanState.routines}
  userId={user.uid}
  onComplete={refreshAtman}
/>
```

- Glass card wrapper with "Daily Practices" header
- Checkable from the dashboard
- Expandable steps on tap (already built)
- **Guest users:** This section does not render (DharmaList requires `userId` for Firestore writes)

### 5. Side Zone — Today's Forecast

Glass card containing the daily prediction text.

```
┌──────────────────────────┐
│  Today's Reading         │
│                          │
│  "The cosmic tides..."   │
│                          │
│  View full forecast →    │
└──────────────────────────┘
```

- Shows loading skeleton (3 pulsing lines) while fetching
- "View full forecast" link to `/forecast`
- The prediction data comes from the existing `fetchPrediction` logic — no backend changes
- Works for both authenticated and guest users (prediction only needs birth data)

### 6. Side Zone — Soul Insight

The existing `SoulInsightCard` component, repositioned into the side column.

- **Spacing note:** SoulInsightCard has `mb-6` baked into each variant. The side zone should use `space-y-4` on its container and the `mb-6` on SoulInsightCard should be changed to `mb-0` (or the margin removed and controlled by the parent). This is a minor change to the component.
- **Guest users:** Does not render (requires `atmanState`)

### 7. Side Zone — Quick Links

Simple list of text links, no card wrappers:

```
⚙ Update Birth Data    → opens OnboardingModal
✦ Daily Altar           → opens DailyAltar modal (authenticated only)
```

Small text, icon + label, hover gold color transition.

## Loading State

Replace the current full-page centered spinner with a skeleton that matches the two-zone layout:

- Welcome strip: single pulsing line
- Hero card: glass card shape with pulsing content lines
- Quick actions: 3 pulsing rectangles in a row
- Side zone: 2 pulsing card shapes

This renders while `useUserProfile()` is loading. The prediction has its own inline skeleton (3 pulsing lines inside the forecast card).

## Guest User Behavior Summary

| Component | Guest Behavior |
|-----------|---------------|
| Welcome Strip | Name only, no consciousness pill or streak |
| Synthesis Hero | "Start a conversation" CTA only, no "Continue" |
| Quick Actions | Full access (all routes work for guests) |
| Active Practices | Hidden |
| Today's Forecast | Full access (uses birth data from sessionStorage) |
| Soul Insight | Hidden |
| Quick Links | "Update Birth Data" only, no "Daily Altar" |

## Animation Guidance

- Minimal entrance animations: opacity fade + 10px y-translate on hero card and side zone cards (CSS `animate-reveal-progressive` already exists)
- No stagger animations on the dashboard
- No scroll-triggered animations
- Quick Actions: keep the radial gradient hover glow, 300ms transition
- Framer Motion only used for SoulInsightCard (already built)

## Accessibility

- Use `<main>` for the two-zone grid, `<aside>` for the side zone
- Quick Actions horizontal scroll: add `role="navigation"` and `aria-label="Quick actions"`
- Synthesis Hero "Continue" / "New" buttons: standard `<button>` or `<a>` elements, keyboard-focusable by default
- Ensure color contrast on the emotional state pill text against the dark background

## What's Removed

- Crown SVG ornament in welcome banner
- Giant animated radial blur backgrounds (keep one subtle fixed blur, much smaller)
- All 7 FeatureCard instances and the `FeatureCard` component definition
- "Coming Soon" placeholders (Dasha Timeline, Life Reports)
- Feature card descriptions
- "Services" section heading
- `FeatureCardProps` type import (no longer needed in Dashboard)

## What's Modified

- Footer: `py-12` → `py-6`, keep coordinates text
- SoulInsightCard: remove `mb-6`/`mb-8` bottom margin from each variant (parent controls spacing)

## What's Preserved

- `glass` card class and design system tokens (gold, bg-app, fonts)
- Gold accent color identity
- Cormorant Garamond display font
- All existing functionality (OnboardingModal, DailyAltar, SoulInsightCard, DharmaList)
- Header component (unchanged)
- Dark background (#030308)
- `getZodiacSign` utility (still used by prediction fetch; extract to shared utils during rewrite if desired)

## File Changes

| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | Full rewrite of the return JSX. Remove FeatureCard component. Add last-chat `getDocs` query. Restructure into two-zone grid. Update loading skeleton. |
| `src/components/dashboard/SoulInsightCard.tsx` | Remove `mb-6`/`mb-8` from each variant's outer div (parent controls spacing now) |
| `src/components/dharma/DharmaList.tsx` | No changes |
| `src/types/index.ts` | Remove `FeatureCardProps` if only used by Dashboard |

## Error Handling

- If last chat query fails: hide "Continue" button, show only "New conversation"
- If prediction fetch fails: show existing fallback text
- If no routines: Active Practices section doesn't render
- If no atmanState: consciousness pill, soul insight, and active practices don't render
- If guest user with no sessionStorage data: redirect to `/` (existing behavior preserved)

## Mobile Considerations

- Two-zone grid collapses to single column via `lg:grid-cols-[3fr_2fr] grid-cols-1`
- Quick actions row uses `flex overflow-x-auto snap-x` with `min-w-[120px]` per card
- Synthesis hero card is full-width on all breakpoints
- Side zone components stack below primary zone content
- Mobile stacking prioritizes interactive elements over read-only content
