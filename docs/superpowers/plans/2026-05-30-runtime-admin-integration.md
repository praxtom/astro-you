# Runtime Admin Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the operational runtime layer usable from the product UI, especially admin refund/credit support and audit review.

**Architecture:** Keep existing Netlify Functions as the authority for admin actions. The frontend admin page should call those endpoints directly, show explicit errors, and avoid client-side writes for credits, refunds, trust proof, or audit records.

**Tech Stack:** React 19, TypeScript, Netlify Functions, Firebase Admin SDK.

---

### Task 1: Expose Admin Credit Adjustments

**Files:**
- Modify: `src/pages/Admin.tsx`
- Verify: `pnpm test && pnpm run lint`

- [ ] Add form state for target UID, amount, reason, type, busy state, and status.
- [ ] Submit to `POST /api/admin/credit-adjustment` with `{ idToken, targetUid, amount, reason, type }`.
- [ ] Show success with the updated balance returned by the function.
- [ ] Do not write credits directly from the client.

### Task 2: Expose Audit Logs

**Files:**
- Modify: `src/pages/Admin.tsx`
- Verify: `pnpm test && pnpm run lint`

- [ ] Add audit log item types and state.
- [ ] Load `POST /api/admin/audit-logs` with `{ idToken, limit: 100 }`.
- [ ] Show action, UID, entity, date, and short metadata.
- [ ] Add refresh and empty/error states.

### Task 3: Tighten Admin Runtime UX

**Files:**
- Modify: `src/pages/Admin.tsx`
- Verify: `pnpm test && pnpm run lint`

- [ ] Move admin shell to compact `platform-main` and `platform-panel` primitives.
- [ ] Keep moderation, operations, expert applications, launch readiness, funnel, users, credit tools, and audit logs on one page.
- [ ] Preserve existing endpoint contracts.

### Task 4: Verification

**Files:**
- Existing test suite and lint config

- [ ] Run `pnpm test`.
- [ ] Run `pnpm run lint`.
- [ ] If a local server is opened, separate browser-render proof from live Netlify function proof.
