# ADR-0024 — AI provider and model strategy

- **Status**: accepted (decided in the client's Phase 7A brief, 3 October 2026)
- **Date**: 2026-10-03
- **Phase**: Roadmap Phase 7 (AI foundation), slice 7A
- **Implements**: `docs/architecture/AI_ARCHITECTURE.md` §9, decision 1

## Context

The AI layer needs a language model, and the choice of vendor must not leak into the product: models
change quickly, prices and terms change, and the roadmap foresees other cloud providers and
self-hosted open models later. The planning report proposed the Claude API (F-23, F-24); the client
chose Gemini as the first cloud provider, for development, because its API has a free tier. A free
tier's data terms may allow the provider to use what it is sent. Tests and local development must
not depend on a network, a key or a quota.

## Decision

1. **Every model call goes through `AiProvider`** (`apps/api/src/modules/ai/providers`), selected by
   `AI_PROVIDER` the way storage, email and execution drivers are (ADR-0005, ADR-0007). Feature code
   never imports a vendor SDK, URL or model name.
2. **Providers.**
   - `none` is the default: AI is unavailable, and every call is refused.
   - `fake` is deterministic and never touches the network. It is for local development and tests,
     and the API refuses to start with it outside local.
   - Gemini is the first cloud adapter (Phase 7B), behind the same interface.
   - Other clouds and OpenAI-compatible self-hosted servers are further adapters, not changes to
     features.
3. **Keys stay on the server.** They are environment variables only. They are never stored in the
   database, returned by the API, sent to the browser, put in a job payload or logged. Provider base
   URLs come from configuration.
4. **Data.** No real learner data goes to a free-tier provider until its data-use terms are verified
   and recorded in this ADR's successor. Development uses the sample data and synthetic text. Each
   provider is approved per data class (`public`, `course`, `personal`, `restricted`); `restricted`
   data never leaves the platform.
5. **Models are configuration.** Per-task routing arrives in Phase 7B; until then `AI_MODEL` is the
   one default.
6. **Verdicts and marks are never the model's** (ADR-0016).

## Alternatives

- A vendor SDK called from feature code: quickest, but every provider change becomes a rewrite.
- The Claude API, as the planning report proposed: it remains possible as an adapter.
- Self-hosted models first: no GPU capacity on the development machine; a later phase.

## Consequences

- Phase 7A ships the interface, `none` and `fake`. The Gemini adapter (7B) must pass the same
  contract tests as `fake`.
- Changing provider is configuration and an adapter; it never touches feature code.
