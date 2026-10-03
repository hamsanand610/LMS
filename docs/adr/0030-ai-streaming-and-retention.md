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
