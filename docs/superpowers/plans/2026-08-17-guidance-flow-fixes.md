# Guidance Flow Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all 28 findings of the 2026-08-16 Guidance-flow audit (Jyotish `/synthesis` + The Circle `/consult…`) so the flow is functionally correct, honest, findable, and usable on mobile.

**Architecture:** Server stays the billing authority (unchanged model). Client-side fixes are surgical edits inside the existing pages; no new routes. Persona catalogue becomes a single source of truth (`src/lib/personas.ts`) that the server imports. Guest gating switches from `/onboarding` redirects to an in-place `AuthModal`. Consult billing starts on the first message (lazy start) instead of on page mount.

**Tech Stack:** Vite 6 + React 19 + TS + Tailwind v4 + Framer Motion; Netlify Functions (modern `export default (req, ctx) => Response` + `Config`); Firebase Firestore/Auth; node:test function tests compiled via `tsconfig.functions-test.json`.

**Spec:** Audit report published 2026-08-16 (artifact "Guidance Flow Audit"); findings are restated per task below with file references. Line numbers were taken before an unrelated in-progress edit to `Synthesis.tsx`/`ConversationsList.tsx`/`OnboardingModal.tsx` — re-locate by symbol, not by line.

## Global Constraints

- Work in place on branch `fix/guidance-flow-audit`. The working tree carries someone else's uncommitted WIP (Synthesis.tsx, ConversationsList.tsx, OnboardingModal.tsx, LocationInput.tsx, AskJyotish*, package.json). **Do not revert or reformat those files beyond the edits below.** Re-read a file immediately before editing it.
- Follow CLAUDE.md anti-patterns: all astrology data via `/api/kundali`; Firebase Admin from `shared/firebase-admin`; hooks with AbortController; no `Handler` legacy format; always `Content-Type: application/json`.
- Function tests: `netlify/functions/__tests__/*.test.ts`, run with `pnpm run test:functions`; imports from `src` use `../../../src/lib/<file>.js`; new `src` files must be added to `tsconfig.functions-test.json` `include`.
- Do not add dependencies. Do not touch `package.json`/lockfile.
- Copy rules: guides are "AI guides"; free tier = **15 credits**; consult copy says "sitting"; keep the existing dark cosmic design language (`text-gold`, `bg-white/5 border-white/10`, uppercase tracking labels).
- Touch targets ≥ 44 px (`min-h-11 min-w-11` or padding); micro-labels no smaller than `text-[0.65rem]` at `text-white/40`+ (contrast ≥ 3:1 for non-text-heavy UI, ≥ 4.5:1 for body).
- Verification for every task: `pnpm run test:types` and `pnpm run test:functions` must stay green.

---

### Task 1: Circle server — persona parity, live cap, zero-message waiver, early `done`, 409 details, synthesis input caps

**Files:**

- Modify: `netlify/functions/shared/consult-session.ts` (`CONSULT_PERSONAS`, `ConsultSessionError`, `calculateConsultBill`, `startConsultSession` 409 branch, `finalizeConsultSession` cap block)
- Modify: `netlify/functions/consult-start.ts` (error body)
- Modify: `netlify/functions/consult-message.ts` (cap guard ~L79-96; post-stream ~L150-205)
- Modify: `netlify/functions/synthesis.ts` (payload validation ~L99-108)
- Create: `netlify/functions/__tests__/consult-persona-parity.test.ts`
- Modify: `netlify/functions/__tests__/consult-session.test.ts`, `netlify/functions/__tests__/billing-consult-partial.test.ts` (adjust for waiver/cap helper)
- Modify: `tsconfig.functions-test.json` (add `src/lib/personas.ts` to include if not already)

**Interfaces:**

- Produces: `export function computeBillableCapMinutes(session: { maxBillableMinutes?: unknown; pricePerMin?: unknown }, currentCredits: number, fallbackPricePerMin: number): number | undefined` in `consult-session.ts` — `max(startCap, floor(currentCredits / pricePerMin)) || undefined`.
- Produces: `ConsultSessionError` gains `details?: Record<string, unknown>`; the 409 in `startConsultSession` throws with `{ activeSessionId, activePersonaId }`.
- Produces: `/api/consult/start` 409 JSON body `{ error, code: "active_session", activeSessionId, activePersonaId }`.
- Produces: `/api/consult/message` SSE now emits `done` **before** brain tasks (without `brainUpdated`), then a final `{ type: "brain", brainUpdated: boolean }` event, then closes.
- Produces: `calculateConsultBill(startedAt, now, pricePerMin, maxBillableMinutes?, messageCount?: number)` — when `messageCount === 0`, returns `{ durationSeconds, minutes: 0, cost: 0 }`.

- [ ] **Step 1: Parity test (failing)** — `consult-persona-parity.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { PERSONAS } from "../../../src/lib/personas.js";
import {
  getConsultPersona,
  CONSULT_PERSONAS,
} from "../shared/consult-session.js";

test("every client persona is startable on the server with the same price", () => {
  for (const p of PERSONAS) {
    const server = getConsultPersona(p.id);
    assert.ok(server, `server registry is missing ${p.id}`);
    assert.equal(server.pricePerMin, p.pricePerMin, `price drift for ${p.id}`);
    assert.equal(server.name, p.name);
    assert.ok(
      server.promptModifier.length > 20,
      `promptModifier missing for ${p.id}`,
    );
  }
  assert.equal(Object.keys(CONSULT_PERSONAS).length, PERSONAS.length);
});
```

- [ ] **Step 2: Run** `pnpm run test:functions` → expect FAIL on `ishaan-rao`.
- [ ] **Step 3: Implement** — in `consult-session.ts` replace the hand-written `CONSULT_PERSONAS` literal with:

```ts
import { PERSONAS } from "../../../src/lib/personas.js";
export const CONSULT_PERSONAS: Record<
  string,
  { id: string; name: string; pricePerMin: number; promptModifier: string }
> = Object.fromEntries(
  PERSONAS.map((p) => [
    p.id,
    {
      id: p.id,
      name: p.name,
      pricePerMin: p.pricePerMin,
      promptModifier: p.promptModifier,
    },
  ]),
);
```

Confirm `src/lib/personas.ts` has no browser-only imports (it is plain data). Add `src/lib/personas.ts` to `tsconfig.functions-test.json` include if absent.

- [ ] **Step 4: Live cap helper + tests** — add `computeBillableCapMinutes` (signature above) and use it in `finalizeConsultSession` (replace the inline `startingBalanceBillableMinutes/currentBalanceBillableMinutes` block) **and** in `consult-message.ts` cap guard: read `users/{uid}` credits (`db.collection("users").doc(uid).get()`), compute `cap = computeBillableCapMinutes(session, credits, persona.pricePerMin)`, then `if (cap !== undefined && elapsedMinutes >= cap) → 402 time_exhausted`. Test in `consult-session.test.ts`: cap grows after top-up (start cap 2, credits now 20 at 5/min → cap 4).
- [ ] **Step 5: Zero-message waiver** — `calculateConsultBill(..., messageCount?)`: if `messageCount === 0` return `{ durationSeconds, minutes: 0, cost: 0 }`. In `finalizeConsultSession` pass `consultation.messageCount ?? undefined`. Test: finalize with `messageCount: 0` bills 0 and still releases the lock/ends the session; existing tests with messages unchanged (`billing-consult-partial.test.ts` fixtures may need `messageCount: 1`).
- [ ] **Step 6: 409 details** — `ConsultSessionError` gets `details?: Record<string, unknown>` (3rd ctor arg). In the 409 branch pass `{ code: "active_session", activeSessionId: <candidate id>, activePersonaId: existing.personaId }`. In `consult-start.ts` catch: `JSON.stringify({ error: error.message, ...(error.details ?? {}) })`. Test: 409 error carries `details.activePersonaId`.
- [ ] **Step 7: Early `done`** — in `consult-message.ts` move `send({ type: "done", content: fullContent, interactionId, suggestedRoutine })` to immediately after the stream finishes and the transcript/messageCount write; then run the brain tasks; then `send({ type: "brain", brainUpdated: Boolean(brainResult?.persisted) })`; then `controller.close()`. Keep the `error` path.
- [ ] **Step 8: Synthesis input caps** — in `synthesis.ts` payload validation: reject with 400 `{ error: "Message too long" }` if any `messages[].content.length > 8000` or `messages.length > 60`; same for `chatMessages` if present.
- [ ] **Step 9: Run** `pnpm run test:functions` → all green. Commit: `fix(consult): single persona registry, live billing cap, zero-message waiver, early done, 409 details`.

---

### Task 2: ConsultChat.tsx — lazy start, honest meter, error surfacing, unmount end, 409 resume/end, guest AuthModal, a11y/mobile

**Files:**

- Modify: `src/pages/ConsultChat.tsx` (whole file; ~900 lines)
- Modify: `src/hooks/useCreditTopup.ts` (load Razorpay on intent — see Task 5 Step 3; coordinate: Task 5 owns this file)

**Interfaces:**

- Consumes: `/api/consult/start` 409 body `{ code:"active_session", activeSessionId, activePersonaId }`; SSE `done` then `brain` events (Task 1).
- Consumes: `useSubscription().credits` (live) instead of `profile.credits`.
- Consumes: `AuthModal` props `{ isOpen, onClose, onSuccess?, title?, message? }`.

- [ ] **Step 1: Guest gate → AuthModal.** Remove both `navigate("/onboarding")` calls. Add `const [showAuthModal, setShowAuthModal] = useState(false)`. In the auth effect: `if (!authLoading && !user) setShowAuthModal(true)`. Render `<AuthModal isOpen={showAuthModal && !user} onClose={() => navigate(\`/consult/${persona.id}\`)} title="Sign in to begin your sitting" message="New here? You start with 15 free credits — enough for a first conversation with any guide." />`(onSuccess:`() => setShowAuthModal(false)`). Never redirect a signed-out user to `/onboarding` from this page.
- [ ] **Step 2: Credits source.** `const { credits: liveCredits, loading: creditsLoading } = useSubscription();` replace every `profile?.credits` read with `liveCredits`; keep `useUserProfile` only for `birthData`/`profile.language`.
- [ ] **Step 3: Lazy start.** Split the mount effect: (a) if `sessionStorage` has a stored session id for this persona/language → call start immediately (server resumes; meter is already running); (b) otherwise do **not** start. Extract `ensureSession(): Promise<SessionInfo | null>` (uses `sessionStartingRef` to dedupe) and call it at the top of `sendMessage` before posting the first message. While no session: header shows `Meter starts with your first message` in place of the timer, and the composer is enabled (if `liveCredits >= pricePerMin`). Insufficient credits (< 1 min) → keep the existing `billingError` state but with an "Add time" CTA.
- [ ] **Step 4: Wall-clock timer.** Replace `setElapsedSeconds(prev => prev + 1)` with `setElapsedSeconds(Math.max(0, Math.floor((Date.now() - sessionInfo.startedAt) / 1000)))` on each 1 s tick and once immediately after start/resume. Delete `startTimeRef` if now unused.
- [ ] **Step 5: Correct auto-end.** `const fundedSeconds = Math.floor(liveCredits / pricePerMin) * 60;` auto-end when `sessionInfo && sessionActive && elapsedSeconds >= fundedSeconds`. Keep `creditsRemaining = liveCredits − ceil(elapsed/60)×price` for the display only; low-balance banner when `fundedSeconds − elapsedSeconds <= 120`.
- [ ] **Step 6: Surface server errors.** In `sendMessage` `catch (err)`: `const msg = err instanceof Error ? err.message : "Connection issue. Please try again."`. Parse status: on 402 (`time_exhausted`) → `setSessionActive(false)`, show the ended state with "Add time" and message "Your funded time is up."; on 409/404 (session no longer active) → `setSessionActive(false)` + "This sitting was closed. Start a new one."; on 429 → show the server message; else show `msg`. Also handle SSE `{type:"error"}` the same way (throw with the server text). Handle `data.type === "done"` → `setIsStreaming(false)` immediately (do not wait for stream close) and `data.type === "brain"` → set the existing brain flag if one is displayed.
- [ ] **Step 7: End on unmount / SPA nav.** Add an effect whose cleanup ends an active session: because of `StrictMode`, schedule with `const t = setTimeout(() => endSessionRef.current?.(), 0)` and clear it if the effect re-runs (`return () => { … }` pattern with a `cancelledRef`). Use `navigator.sendBeacon("/api/consult/end", …)` if available (same payload as the pagehide handler) else `fetch(..., { keepalive: true })`. Keep the pagehide handler. Add an `AbortController` for the message stream; abort on unmount.
- [ ] **Step 8: 409 handling.** When start returns 409 with `activePersonaId`: render a card "You have a sitting in progress with {name}" with two buttons: **Resume** → `navigate(\`/consult/${activePersonaId}/chat\`)`; **End it and start here** → `POST /api/consult/end { idToken, sessionId: activeSessionId }`then retry`ensureSession()`.
- [ ] **Step 9: Modal + render hygiene.** Rating modal: `role="dialog" aria-modal="true" aria-labelledby={id}`, initial focus on the first star, Escape closes, Tab cycles inside (simple trap: on keydown Tab, if focus at last focusable wrap to first and vice-versa). Move the `navigate()` that currently runs during render (~L518-521) into a `useEffect`. Star buttons: `aria-label="Rate N stars"`, `aria-pressed`.
- [ ] **Step 10: Perf.** Extract `MessageRow` as `React.memo` (props: role, content, isStreaming) with the markdown components memoized at module level, so the 1 s tick only re-renders the header/meter.
- [ ] **Step 11: Mobile + a11y + label.** Root `min-h-[100dvh]`; composer wrapper `pb-[max(1rem,env(safe-area-inset-bottom))]`; back button `min-h-11 min-w-11 p-2.5`; End button `min-h-11 px-4`; low-balance banner `role="status" aria-live="polite"`; visually-hidden `role="status"` that announces "Reply received" when a stream completes; header shows persona name + `AI guide` chip (small `text-[0.6rem] uppercase tracking-widest border border-white/15 rounded-full px-2 py-0.5 text-white/60`) instead of only "With you now"; "is writing…" → "is writing… (AI)" is unnecessary — the chip suffices.
- [ ] **Step 12: Verify** — `pnpm run test:types` green; manual: as guest `/consult/meera-devi/chat` shows AuthModal (no redirect); signed-in: no `/api/consult/start` call until first message. Commit: `fix(consult-chat): lazy start, wall-clock meter, correct auto-end, surfaced errors, end-on-unmount, 409 resume, guest auth modal, a11y`.

---

### Task 3: Consult.tsx + ConsultProfile.tsx — guest AuthModal, sign-in CTA, AI label, SpaceTabs, drawer a11y, credits source, mobile order

**Files:**

- Modify: `src/pages/Consult.tsx`, `src/pages/ConsultProfile.tsx`
- Modify: `src/components/consult/*` only if the AI chip / sigil gradient id fix lives there (check `PersonaSigil` or similar for duplicate `<linearGradient id>`; make ids unique per persona with `useId()` or `${persona.id}-…`).

**Interfaces:**

- Consumes: `SpaceTabs` from `src/components/layout/SpaceTabs.tsx` (renders eyebrow "Guidance · Who do I talk to?" + tabs Jyotish | The Circle when the path is inside the space).
- Consumes: `AuthModal`, `useSubscription().credits`.

- [ ] **Step 1: Guest → AuthModal** in both pages: replace `navigate("/onboarding")` with `setShowAuthModal(true)`; on success continue the original action (begin session / open chat with draft). Profile guest CTA: replace the guest branch of the "Buy 120 credits" button with **"Sign in to begin — 15 free credits"** → opens AuthModal; the "Before you sit" balance rows for guests read `—` (not `0 cr`) with a caption "Sign in to see your balance."
- [ ] **Step 2: Credits** in `ConsultProfile.tsx`: use `useSubscription().credits` (Consult.tsx already does).
- [ ] **Step 3: SpaceTabs**: import and render `<SpaceTabs />` at the top of the content column on `/consult` (above the h1) and `/consult/:id` (above the "← The Circle" back link). Remove the page's own "THE CIRCLE" eyebrow only if it duplicates the SpaceTabs eyebrow visually; keep the h1.
- [ ] **Step 4: AI label**: persona cards get an `AI guide` chip next to the specialty; the profile header shows `AI guide · always available` next to "Available now". Keep the pulsing dot.
- [ ] **Step 5: Transcript drawer a11y** (`Consult.tsx` ~L576-653): `role="dialog" aria-modal aria-labelledby`, Escape closes, focus moves into the drawer on open and back to the trigger on close; replace `animate-in slide-in-from-right` (no plugin) with a Framer Motion `motion.div` (`initial={{x:24,opacity:0}} animate={{x:0,opacity:1}}`) or existing utility classes.
- [ ] **Step 6: `navigate()` during render** in `ConsultProfile.tsx` (~L52-55) → `useEffect`.
- [ ] **Step 7: Mobile order**: on `< lg` render the Trust-signals card **after** the guides grid (wrap in a flex column and give the card `order-2 lg:order-none`, or render it twice with `lg:hidden` / `hidden lg:block`). Filter chips `min-h-11 px-4`; language `<select aria-label="Language">`; history `fetchHistory` gets `try/catch` and filters `status === "ended"` rows for the list.
- [ ] **Step 8: Verify** — `pnpm run test:types`; guest on `/consult` "Begin session" opens AuthModal (no `/onboarding`). Commit: `fix(consult): guest sign-in modal, AI guide labels, space tabs, drawer a11y, mobile order`.

---

### Task 4: Synthesis.tsx (+ ConversationsList.tsx, useKundali) — send guard, abort/chat-id, credit drift, guest-turn migration, kundali single fetch, draft restore, perf, delete, a11y

**Files:**

- Modify: `src/pages/Synthesis.tsx` (contains an unrelated in-progress WIP diff — re-read before every edit; keep its `h-[100dvh]` / safe-area / `parseCompletedBirthProfile` changes intact)
- Modify: `src/components/synthesis/ConversationsList.tsx` (WIP already made rows buttons; only add `[@media(hover:none)]:opacity-100` to the delete button)
- Read: `src/hooks/useKundali.ts` (error shape), `src/lib/AuthContext.tsx` (guest migration hook point)

- [ ] **Step 1: Send guard + abort + chat-id.** In `handleSend`: early return if `isSynthesizing || streamingContent` (or a `sendingRef.current`). Create `const controller = new AbortController(); sendAbortRef.current = controller;` pass `signal` to the `/api/synthesis` fetch; abort on unmount and when the chat changes (`currentChatId` change effect). Capture `const chatIdAtSend = currentChatId` and, on completion, apply `setMessages`/`pendingMessagesRef`/`setInteractionId` **only if** `currentChatIdRef.current === chatIdAtSend`.
- [ ] **Step 2: Credit drift + alert.** Delete the client-side `credits - 1` decrement on `done` (server + profile snapshot are authoritative). Replace the native `alert()` out-of-credits gate with an in-thread notice component (reuse `UpgradePrompt` if its API fits, else a small inline card) that has a "Buy credits" button wired to the existing `handlePurchase`.
- [ ] **Step 3: Guest turns survive sign-in.** In the effect that resets state when `user` becomes non-null: if there are guest messages beyond the welcome message, create the chat doc (`addDoc(chats, { title, createdAt, lastUpdatedAt })`), write each guest turn to `messages`, then `setCurrentChatId(newId)` instead of resetting to the welcome message.
- [ ] **Step 4: Back-nav reset.** `useEffect(() => setCurrentChatId(id ?? null), [id])`.
- [ ] **Step 5: Single kundali fetch + 429 copy.** Remove the ad-hoc guest `postJson('/api/kundali')` effect and consume `useKundali`'s result for guests too. In the Blueprint/right rail: if `useKundali` error indicates 429 (`/429|too many/i`), show "Chart is rate-limited — try again in a few minutes" instead of "Birth data required"; "Birth data required" only when there is genuinely no birth data. Toast title likewise.
- [ ] **Step 6: Failure copy + draft restore.** On send failure: `setInput(originalDraft)`; toast title by status: 401 "Sign in to continue", 402 "Out of credits", 429 "Slow down — try again shortly", else "Connection lost". Parse status from the fetch `res.status` before reading the stream.
- [ ] **Step 7: Perf.** Extract `MessageBubble` (`React.memo`) with module-level memoized markdown `components`; batch `setStreamingContent` with `requestAnimationFrame` (accumulate deltas in a ref, flush once per frame); message subscription `orderBy("timestamp","asc"), limitToLast(200)`; auto-scroll only when the user is within 120 px of the bottom, otherwise show a small "Jump to latest" button.
- [ ] **Step 8: Delete cleanup + Razorpay guard.** On delete: query the chat's `messages` subcollection and delete in `writeBatch` chunks of 400 before deleting the chat doc. Wrap the Razorpay verify call in `try/catch` and check `verifyResp.ok` before `.json()`.
- [ ] **Step 9: A11y + polish.** Visually-hidden `role="status"` announces "Jyotish replied" on `done`; Enter-to-send ignores `e.nativeEvent.isComposing`; reset textarea height after send; append "…" to the title only when truncated; give the `<select className="appearance-none">` a chevron icon; Download/Share buttons get `aria-label`; labels currently `text-[0.6rem] text-white/25` → `text-[0.65rem] text-white/45`; timestamps `text-white/40`.
- [ ] **Step 10: Lateral nav.** In the Synthesis `<header>` add a "The Circle" button (Users icon + label on `md+`, `aria-label="The Circle"`) → `navigate("/consult")`, next to the Blueprint toggle.
- [ ] **Step 11: ConversationsList** delete button: add `[@media(hover:none)]:opacity-100`.
- [ ] **Step 12: Verify** `pnpm run test:types`. Commit: `fix(synthesis): send guard + abort, credit drift, guest turn migration, single kundali fetch, perf, a11y`.

---

### Task 5: Shell/global — header nav gap, viewport-fit, CSP, Razorpay on intent, useLastChat, roadmap

**Files:**

- Modify: `src/components/layout/Header.tsx:345` (`md:hidden` → `lg:hidden` on the hamburger; ensure the mobile drawer also opens at `md`–`lg`)
- Modify: `index.html:5` → `content="width=device-width, initial-scale=1.0, viewport-fit=cover"`
- Modify: `netlify.toml` CSP: `script-src` add `https://cdn.razorpay.com` — keep everything else identical. (No `media-src` directive: the Prana sounds are synthesised in the browser with the Web Audio API, so there is no audio file — remote or self-hosted — for the CSP to allow.)
- Modify: `src/hooks/useCreditTopup.ts` — drop `useRazorpay()`; inside `buyCredits` `await loadRazorpayCheckout()` (from `src/lib/razorpay-loader.ts`) before reading `window.Razorpay`; keep the "Payment system is still loading" error only for a rejected load. Remove `useRazorpay` from `src/hooks/index.ts` and delete `src/hooks/useRazorpay.ts` if nothing else imports it.
- Modify: `src/hooks/useLastChat.ts:29` → `orderBy("lastUpdatedAt", "desc")`
- Modify: `docs/ROADMAP.md` §5.6: mark `/consult/:personaId` profile page ✅ (complete), consultation chat ✅, per-minute billing → "server-authoritative session billing ✅ (charged at finalize; client meter cosmetic)", note "AI guide labels ✅ 2026-08-17", and note the two new personas (`ishaan-rao`, `tara-kapoor`).

- [ ] **Step 1** Header: change the hamburger to `lg:hidden`; check the `hidden md:flex` user-area (~L224) still fits beside it at 768–1023 and that the mobile drawer lists the space links.
- [ ] **Step 2** index.html viewport-fit.
- [ ] **Step 3** CSP edits (one line; keep order).
- [ ] **Step 4** useCreditTopup on-intent load; delete useRazorpay.
- [ ] **Step 5** useLastChat field.
- [ ] **Step 6** ROADMAP §5.6.
- [ ] **Step 7** Verify `pnpm run test:types`; commit `fix(shell): tablet nav gap, viewport-fit, CSP for audio/razorpay, razorpay on intent, last-chat query, roadmap`.

---

### Task 6: Verification (run by the orchestrator after Tasks 1–5)

- [ ] `pnpm test` (types + 216+ function tests) green; `pnpm run lint` clean or only pre-existing warnings; `pnpm run build` succeeds.
- [ ] `netlify dev --port 8888`; `GET /api/health` 200; `POST /api/kundali` 200 (checks firebase-admin 14 runtime doesn't crash the functions — the last commits reverted 14 for an ESM jose crash; report if it recurs).
- [ ] Playwright pass at 375/768/1440 as guest with seeded profile: `/consult` shows header nav at 768; `/consult/meera-devi/chat` stays on the page and shows AuthModal (no `/onboarding`); `/consult/meera-devi` guest CTA reads "Sign in to begin — 15 free credits"; SpaceTabs visible on `/consult`; no horizontal overflow; console has no CSP errors.
- [ ] Persona parity test passes; `GET` `/consult/tara-kapoor` renders.
- [ ] Squash-review the diff for accidental changes to the WIP files.
