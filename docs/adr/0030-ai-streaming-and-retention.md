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

## Implementation (Phase 7D, 4 October 2026)

This section records how decision 5 is carried out. Nothing above changes.

- **Retention** comes from the institute's AI settings, as decided, with the requirements'
  retention schedule (planning report §14.4) as the defaults:
  - each message is kept `conversationRetentionDays` (90: "AI conversations, 90 days,
    configurable"), and a conversation goes once it has no message left and was last used before
    that;
  - a conversation its owner deleted goes at the next nightly sweep (`ai.retention.sweep`), with
    its messages, its notes and any answer kept for its owner from it;
  - each ledger row is kept `usageDetailRetentionDays` (730: raw events two years); the daily
    totals are the aggregates and are kept;
  - nothing being written is touched, and an answer a stopped process left is closed first;
  - notes written from messages that went are dropped with them.

  The sweep runs whether or not AI is on, deletes by conditions it checks again as it deletes (safe
  to repeat or to run twice at once), and is audited when it removes anything
  (`ai.retention.swept`).

- **Titles.** After a conversation's first answer, a background job (`ai.title`) has the model
  write a short title from the first question alone. Written once; never over the owner's title;
  claimed in the database while written; a failure leaves the title taken from the question.
- **Notes (summaries).** Once at least six completed messages have left the context window
  uncovered, a background job (`ai.summarize`) brings the conversation's notes up to date from the
  notes so far and those messages. The next questions carry them after the instructions, as a
  learner-side message framed as context, before the recent messages, which stay authoritative.
  They are never instructions or authority, are read by no check, and belong to their conversation:
  no long-term memory.
- **Privacy.** The export carries each conversation's notes and the answers the cache keeps for the
  person alone; erasure removes them with the conversations.
- **8E record (4 October 2026; ADR-0037).** The stream writer takes a route's own events: grounded
  answers stream `meta`, `delta`, `sources`, `notice`, `usage`, `error` and `done`, each parsed
  with its shape, and write `delta` only once the whole answer has been checked. Nothing of an
  answer is stored in a conversation.
