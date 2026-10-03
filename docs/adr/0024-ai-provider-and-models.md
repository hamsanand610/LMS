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

## Implementation (Phase 7B, 4 October 2026)

This section records how decisions 1–5 are carried out. Nothing above changes.

- **The contract.** The Gemini adapter uses `models.generateContent` and
  `models.streamGenerateContent` (`?alt=sse`) of the stable `v1` API, as Google's discovery
  document for the Generative Language API describes them (revision 20261002, read on 3 October
  2026).
  - Google now recommends its Interactions API for new projects. It calls `generateContent`
    legacy but keeps it fully supported, with no end date.
  - `generateContent` was chosen because it is stateless: SI Academy keeps the conversations
    (ADR-0030). Its contract is also published in machine-readable form. The Interactions API stores
    each exchange by default.
  - Moving to the Interactions API later changes the adapter alone.
- **No provider-side log.** Every request sets `store: false`. The provider's own terms still govern
  what it keeps, which is why decision 4 stands.
- **The key.** `GEMINI_API_KEY` is sent only in the `x-goog-api-key` header, to `GEMINI_BASE_URL`.
  - It is never put in a URL, and redirects are refused.
  - The API refuses to start with `AI_PROVIDER=gemini` and no key or no model.
  - Outside local, it also refuses a placeholder key or an address that is not https.
- **Models (decision 5).** A code-level registry lists the models the router may use: Gemini's
  stable text models as Google listed them on 3 October 2026 (1,048,576 input and 65,536 output
  tokens each), and the fake's one model.
  - `AI_MODEL`, `AI_TASK_MODELS` and `AI_FALLBACK_MODEL` choose among them.
  - A model the registry does not list for the configured provider stops the API at start-up.
  - Adding a model is a reviewed change, with its test.
  - A choice per institute can come with the AI settings (Phase 7C), over the same registry.
- **Data classes (decision 4).** `AI_DATA_CLASSES` records the classes the deployment approved for
  its provider; by default, only `public`.
  - `course` and `personal` are added deliberately, `personal` once the provider's data-use terms
    are verified and recorded.
  - `restricted` is refused by the configuration and is never routed.
- **Fallback.** A fallback answers only in these conditions:
  - it is another model of the same provider (`AI_FALLBACK_MODEL`);
  - the task's model is overloaded or resting;
  - none of the answer has been written yet.

  Only the configured provider is built, so there is no other provider to switch to. The fake is
  never a fallback.

- **Failures.** They become `AiProviderError` kinds and are answered as `ai_unavailable`,
  `ai_busy` or `ai_timeout`. The provider's messages never travel.
- **Circuits.** After five consecutive failures, a model rests for 30 seconds. One call then probes
  it. The state is kept in the process (ADR-0006).
- **No calls yet.** No provider is called from a route until conversations and usage accounting
  exist (Phase 7C, ADR-0029).
