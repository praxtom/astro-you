# AstroYou Hosted Payments Implementation Plan

## Goal and approved scope

Make all existing AstroYou money-collection entry points use Razorpay-hosted pages and fulfil purchases automatically. A real INR 49 Standard Payment Link succeeded, while embedded checkout is blocked by Razorpay website registration. Preserve pricing, currency gating, credits-based consultation/report charges, subscription recurring billing, cancellations, and existing paid entitlements. Remedy requests are review-before-payment and must keep that behaviour.

## Architecture

Retain existing services and endpoints for legacy embedded clients. New credit purchase requests opt into hosted checkout. Server-created Standard Payment Links have a durable, server-only checkout record, random reference, authenticated owner, server-selected pack, exact amount/currency, and safe return path. Notify/reminder options are off. Link payments are settled from authoritative provider data only and identified by the matching local record. Webhook and return/status reconciliation use the same transaction-safe idempotent credit ledger. Never credit from query parameters, arbitrary payment IDs, client prices, or an authorised-but-uncaptured payment. Do not revive deleted users.

Subscriptions already use Razorpay short_url. Preserve this and harden missing/invalid URLs, pending checkout behaviour, safe plan switching, and status confirmation as needed. Do not replace recurring subscriptions with one-off monthly payments. No changes to card data handling. Backend secrets stay server-side.

## Implementation task

- [x] Inspect published baseline, existing tests, and SDK types before implementation.
- [x] Write regression tests first covering hosted amount validation, ownership, captured status, duplicate/concurrent settlement, browser-close delivery, and refund-before/after-capture or delayed callback. Tests must run real settlement logic with a minimal datastore fake.
- [x] Add shared hosted-payment creation and reconciliation logic. Persist state before upstream creation. Reuse a valid pending checkout for retried requests where possible. Bound rate of link creation. Recover from provider-success/database-write failure through the durable reference and webhook. Handle stale/expired links and partial/failed payments explicitly.
- [x] Extend existing create-order endpoint with a hosted mode without breaking legacy input/response shape. Add authenticated payment status/reconcile endpoint and a safe hosted return route/page. External redirect URLs must be verified Razorpay HTTPS domains. Local return paths must not become open redirects.
- [x] Extend signed webhook handler for payment_link.paid. Reuse payment.captured where suitable, and preserve the existing webhook event idempotency. Handle refunds for these purchases using server-owned records and ledger, without granting twice or granting after refund. Existing embedded orders and subscription events must continue to work.
- [x] Update useCreditTopup so every caller (wallet, pricing, consults, reports, synthesis) opens hosted checkout. Show confirming/pending/failed/paid states on return. Account can reconnect to check state without paying again. Preserve existing hook contract where possible.
- [x] Audit all subscription purchase callers and keep hosted recurring checkout. Add precise failure when a hosted URL is unavailable. Confirm no remaining embedded checkout entry points are used by active purchase buttons.
- [x] Run targeted regression tests, type checks and production build. Report exact commands/results and changed files. Do not push or deploy.

## Constraints and review focus

Work only in the isolated worktree based on commit c4de973, which checkpoints all existing edits as explicitly requested by the user. Preserve those improvements. Final deployment must include this checkpoint and the hosted payment work. No new dependencies. Reuse existing credit ledger and Firebase Admin singleton. Modern Netlify functions. Fetch hooks use AbortController and cleanup. Only authenticated owners can inspect checkout records. Never log provider secrets, auth tokens, or private payer details. Emit generic public errors for upstream failures. Standard Payment Links can only support amounts/currencies enabled on this merchant. Current INR credit packs are 49/99/249/499. Preserve server-side amount validation.

## Operational completion

Controller will enable payment_link.paid and required capture/refund/subscription webhook events for the existing verified webhook endpoint, deploy only this isolated change, monitor build, and verify a real INR 49 purchase with user handoff for money movement. Confirm automatic credit delivery and reload persistence. Subscription payment requires a separate user-authorised recurring transaction; prepare and inspect checkout without initiating a charge.

## Implementation record

Implemented in the isolated worktree based on c4de973. Credit purchases opt into hosted checkout through the existing create-order endpoint. The existing embedded API shape remains available for older clients. New hosted reservations are saved before provider creation, limited to five new attempts per account in fifteen minutes, and reused for twenty-four hours while payable. A sixty-second creation lease and unique provider reference protect retries after interrupted creation.

The authenticated status endpoint supports an explicit checkout reference or the signed-in account's latest checkout. Wallet exposes unfinished checkout recovery. The return route is `/payment/return` and is included in the shared private-route list used to generate production app-shell rewrites. Return paths remove purchase-resume and Razorpay callback parameters.

Hosted and legacy top-ups now use the same transaction-safe settlement and credit ledger. Authoritative provider amount, currency, order and captured status are required. A refund marker is persisted before refund routing so an early or concurrent refund blocks a later grant. The real provider order ID is recorded for existing refund processing. Signed paid-link events remain retryable when provider fetch data has not caught up. Existing recurring subscription creation, plan switching, entitlements and remedies retain their product flow, with provider-URL validation added to subscription redirects.

Verification completed locally with `npm test` (692 tests, 691 passed, 1 skipped), `npm run test:seo` (13 passed), and `npm run build` (448 prerendered pages). Build retains the existing large-chunk warning. No deployment or live payment was performed by the implementer. Controller owns fresh review and live handoff.

## Independent review follow-up

Moved `first_payment` emission out of the pre-redirect Synthesis flow. The confirmed return page now emits both payment conversion events only when it receives an analytics claim from the server. The existing checkout and customer documents provide per-checkout completion and per-account first-payment deduplication. Claims require explicit analytics consent. Passive Wallet recovery does not consume them, and failed analytics persistence returns no claims while preserving the successful payment result.

Analytics delivery is best effort. If a response is lost after its claim is saved, or browser telemetry fails, that conversion can be omitted. It will not be emitted again on refresh. Credit settlement and payment confirmation are independent of these claims.

Follow-up verification passed with `npm test` (697 tests, 696 passed, 1 skipped), a production build (448 pages), and targeted ESLint over all modified TypeScript files (zero errors, four pre-existing webhook `console.log` warnings).
