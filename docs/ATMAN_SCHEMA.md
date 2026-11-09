# Atman Schema

Atman is AstroYou's private user memory layer. It should help the platform remember patterns, relationships, routines, and daily state without letting AI responses overwrite the whole object.

## Version

`users/{uid}.atman.schemaVersion = 1`

All client writes must include the current schema version. Old records are normalized by `normalizeAtmanData()` before use and migrated by `AtmanService.initializeAtman()`.

## Buckets

### Transient State

Short-lived state used for daily empathy and pacing.

```ts
atman.transient = {
  emotionalState,
  lastEmotionalUpdate,
  emotionalHistory
}
```

Legacy top-level fields remain for current UI compatibility:

- `emotionalState`
- `lastEmotionalUpdate`
- `emotionalHistory`

### Durable Memory

Long-lived memory used by Synthesis, Consult, nudges, and reports.

```ts
atman.memory = {
  knownPatterns,
  lifeEvents,
  keyRelationships,
  routines,
  savedAdvice,
  nudgeHistory
}
```

Server-side learning also maintains:

- `memoryLedger`: last 50 brain updates with source, timestamp, message excerpt, counts, and confidence.
- `knownPatterns[].evidence`: last few message sources that strengthened a pattern.
- `knownPatterns[].archived`: old weak unverified patterns are excluded from prompt context but remain visible for user review.
- `users/{uid}/brainNudges`: server-created proactive nudges with trigger, reason, delivery status, and local-day de-duplication.
- `users/{uid}/pushTokens`: server-owned Firebase Cloud Messaging tokens for browser brain nudges.

### Memory Reset Markers (top-level on `users/{uid}`)

These live next to `atman`, not inside it, so they survive the memory being cleared:

- `memoryResetAt` (Timestamp): stamped by "Forget everything" (client `src/lib/atman.ts`, in the same transaction as the clear, and `memory-forget-all.ts`).
- `memoryChatResets` (map `chatId -> Timestamp`): stamped by "Forget this chat". Markers older than `CHAT_RESET_RETENTION_MS` (2 days) are pruned on the next stamp.

Any background write that carries data from a request made at or before one of these stamps is dropped (`isWriteSupersededByReset()` in `shared/atman-brain.ts`), so a slow post-processing job can never bring forgotten memory back.

Legacy aliases remain while the app is migrated:

- `activeEvents` mirrors `lifeEvents`
- `adviceHistory` mirrors `savedAdvice`

### Daily State

Daily reflection fields stay top-level because they are date-scoped and user-editable.

- `dailyIntention`
- `dailyIntentionDate`
- `dailyGratitude`
- `dailyGratitudeDate`

## Write Rules

- Do not write `atman` wholesale except during initialization or schema migration.
- Use field-level updates such as `atman.memory.knownPatterns` and `atman.transient.emotionalState`.
- Validate all user or AI-derived values before writing.
- AI analysis may propose updates, but server functions persist learning through `netlify/functions/shared/atman-brain.ts`.
- Synthesis and Consult both write memory server-side after successful responses.
- Daily maintenance runs in `brain-maintenance-scheduled.ts` to decay and archive stale unverified patterns.
- Hourly proactive checks run in `brain-nudges-scheduled.ts`; nudges can deliver in-app, by email, by browser push, and by WhatsApp only when that channel is explicitly enabled and configured. Nudge email is opt-in: it goes out only when `profile.notificationPrefs.emailDigest === true`.
- Nudges are claim-first. Before anything is delivered, one transaction on fresh data checks for an existing `users/{uid}/brainNudges/{localDate_trigger}` doc (if one exists, skip as `already_claimed`), writes the claim with `deliveryStatus: "claimed"`, and appends the nudge to `atman` through a field-level patch built from the re-read memory. Email, push and WhatsApp are sent only after that, and the final write records delivery outcome on the nudge doc only. A crash or retry after delivery therefore never resends, and the slow sends never hold a stale copy of memory that could overwrite newer learning.
- Browser push token writes go through `/api/push-token`; the client never writes token records directly.
- Store life events with `status: pending | completed | cancelled`; old `active` values migrate to `pending`.

## Core Helpers

- `src/lib/atman-schema.ts`
  - `createInitialAtmanData()`
  - `normalizeAtmanData()`
  - `validateAtmanData()`
  - field validators for emotion, text, patterns, events, relationships, routines, advice, and nudges
- `netlify/functions/shared/atman-brain.ts`
  - `applyBrainInsights()`
  - `persistAtmanInsights()`
  - `selectBrainContext()`
  - `maintainAtmanMemory()`
- `netlify/functions/shared/brain-nudges.ts`
  - `buildBrainNudgeCandidates()`
  - `runProactiveBrainForUser()`
  - `appendNudgeToAtman()`
- `netlify/functions/shared/push-tokens.ts`
  - `buildPushTokenRecord()`
  - `createPushTokenDocId()`
  - `validatePushTokenInput()`

These helpers are covered by `netlify/functions/__tests__/atman-schema.test.ts`.
Brain merge, ranking, persistence, and maintenance are covered by `netlify/functions/__tests__/atman-brain.test.ts`.
Proactive nudge selection, persistence, browser push, and WhatsApp routing are covered by `netlify/functions/__tests__/brain-nudges.test.ts`.
Push token validation is covered by `netlify/functions/__tests__/push-tokens.test.ts`.
