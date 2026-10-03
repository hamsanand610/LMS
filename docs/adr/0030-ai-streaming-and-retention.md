# ADR-0030 — AI streaming and conversation retention

- **Status**: accepted (decided in the client's Phase 7A brief, 3 October 2026)
- **Date**: 2026-10-03
- **Phase**: Roadmap Phase 7 (AI foundation), slice 7A
- **Implements**: `docs/architecture/AI_ARCHITECTURE.md` §9, decision 7

## Context

Answers should appear as they are written. A browser's `EventSource` can only make GET requests and
cannot send the CSRF header, while sending a message is a cookie-authenticated POST. Conversations
hold what a learner typed, and fall under the platform's privacy rules.

## Decision

1. **Transport**: server-sent events, read from a POST through `fetch`, so the request carries the
   session cookie and the CSRF header like every other mutation. A GET stream may be added for
   re-attaching to an answer already in progress.
2. **Events**: `meta`, `delta`, `sources`, `notice`, `usage`, `error` and `done`, plus a heartbeat.
   Errors after the stream has started are sent as events, because a problem response can no longer
   be.
3. Built in **Phase 7C**. Phase 7A has no streaming. Proxy settings (no compression on event streams,
   immediate flushing) are part of staging (Phase 14).
4. **Conversations are owner-scoped**: only their owner reads them. Staff access needs a later
   decision. Messages are append-only.
5. **Retention** comes from AI settings. AI data joins the privacy export and erasure and the
   retention sweep (Phase 7D).

## Alternatives

- WebSockets: a second protocol to secure and proxy, for a one-way stream.
- `EventSource` only: no POST body and no CSRF header.

## Consequences

- The web app gains a streaming client beside `api()`, which reads whole responses only.

## Implementation (Phase 7C, 4 October 2026)

This section records how decisions 1–5 are carried out. Nothing above changes.

- **The stream.** `POST /ai/conversations/:id/messages` answers with server-sent events, read
  through `fetch` (`apps/web/src/lib/api/stream.ts`).
  - The events are `meta`, `delta`, `notice`, `error`, `usage`, `done` (always last) and
    `ping` (every 15 seconds). `sources` is reserved for Phase 8.
  - Each event is checked against a strict shape before it is written.
  - A refusal before the answer starts is an ordinary problem response.
  - After the stream starts, an error is an `error` event. If an exception still reaches the
    problem filter, the filter closes the response rather than writing over it.
- **Endings.**
  - When the reader leaves, the call is aborted and the answer is closed as `cancelled`.
  - An answer that did not complete keeps no text.
  - Messages are append-only: a question is written once, and an answer once, when it ends.
- **Ownership.** Conversations are their owner's alone. Anybody else, staff included, gets
  `404`, and there is no staff view.
- **Retention.** Deleting a conversation hides it at once. The retention sweep that purges deleted
  conversations is 7D's; the data carries `deleted_at` and an index for it.
