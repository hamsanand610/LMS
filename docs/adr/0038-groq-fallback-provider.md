# ADR-0038 — Groq as a controlled secondary provider

- **Status**: proposed (built on 5 October 2026, after Phase 8F's external verification); accepted
  when the client approves it
- **Date**: 2026-10-05
- **Phase**: Roadmap Phase 8 (RAG knowledge system), the external-provider work after the closure
- **Builds on**: ADR-0024 (providers, models and data classes), ADR-0025 (the model router),
  ADR-0028 (observability), ADR-0029 (usage, quotas and budgets), ADR-0035 (embeddings), ADR-0037
  (grounded answers)
- **Amends**: ADR-0024 — "only the chosen provider is built" and "the fallback is a model of the
  same provider": a second provider may now be built, to stand in; ADR-0025's fallback rule — a
  timeout may now fall back, as each model tried has a deadline of its own

## Context

The first live calls, on 5 October 2026, showed what a single provider costs a learner:
`gemini-3.8-flash` answered 503 (overloaded) twice in a row; a developer's free-tier key ran out of
`gemini-3.5-flash`'s 20 requests a day half-way through the evaluation; generation took 10 to 40
seconds. A grounded answer that fails because Gemini is busy is lost, although nothing about the
request was wrong. A second provider that stands in only when Gemini fails for a reason that may
pass keeps answers available without loosening any rule the platform holds.

## Decision

1. **Gemini stays the provider.** `AI_PROVIDER` is still one provider, and it embeds the knowledge
   base. Groq is never `AI_PROVIDER` — the configuration refuses it: it does not embed, and the
   knowledge base's vectors stay one model's (ADR-0035).
2. **Groq stands in.** `AI_FALLBACK_PROVIDER=groq` — with `GROQ_API_KEY` and `AI_FALLBACK_MODEL`,
   and only with `AI_PROVIDER=gemini` — builds Groq's adapter beside Gemini's. The stand-in model,
   `AI_FALLBACK_MODEL`, is then Groq's; without a fallback provider it is still another of Gemini's
   own (ADR-0025). The deployment alone chooses it: an institute's stand-in choice (Phase 7D) is
   refused while a fallback provider is configured, and the settings page offers none; one saved
   before is set aside and reported, and the institute's other choices — its narrowing of the data
   classes above all — still apply.
3. **When Groq stands in** (`AiProviderError.fallbackAllowed`): Gemini unavailable (a 5xx, or the
   network), overloaded or at its limit or quota (429, `RESOURCE_EXHAUSTED`), too slow (its
   deadline), or resting after repeated failures (its circuit open) — and only before any of the
   answer was written: a streamed answer is never stitched from two models.
4. **When it never does.** Gemini refusing the key or the account (`auth`), the configuration (the
   model, billing), a request it refused as invalid, an unreadable answer, a caller who has gone.
   And everything the platform decides itself, before any call or after it: the flags and
   permissions, a timed test, a credential or restricted data, a data class not approved, no or
   weak evidence (below the floor), the allowance and the budget, the answer check (citations,
   support, length, secrets) and the provider's own filters. The fallback is decided inside the
   router, after every application decision, and only ever repeats the call the router was asked
   to make.
5. **The same request.** Groq gets exactly the messages Gemini was given — the same grounded prompt
   and the same passages, already authorised for the person, nothing more — within its own output
   limit. Its answer goes back through the same checks as Gemini's (ADR-0037).
6. **Data classes.** Groq's models are listed for `public` and `course` data at most, and the
   deployment's approval (`AI_DATA_CLASSES`) narrows both providers alike. A learner's own work
   (`personal`: a lab hint's attempt) is never sent to Groq — such a request has no stand-in. Groq's
   terms as recorded on 5 October 2026: inference data is not retained by default; logs of up to
   30 days are kept only for reliability and abuse monitoring, which an organisation can switch off
   (Zero Data Retention); data is processed in the United States. Zero Data Retention should be on.
7. **Models.** The registry lists Groq's production text models as Groq's API lists them for the
   key on 5 October 2026: `openai/gpt-oss-120b` (the recommended stand-in) and `openai/gpt-oss-20b`
   — 131,072 input and 65,536 output tokens each, reasoning models whose reasoning Groq counts in
   the completion; at Groq's listed prices, $0.15 and $0.60 per million input and output tokens for
   the first, $0.075 and $0.30 for the second (for `AI_MODEL_COSTS`). Groq's Llama models
   (`llama-3.3-70b-versatile`, `llama-3.1-8b-instant`), which its models page still showed, were
   shut down for free and developer tiers on 16 August 2026 with these two as their replacements,
   and are not listed; nor are preview, speech and guard models. A model code may now carry its
   publisher (`openai/…`); Gemini's, which go into a request path, are still held to the stricter
   pattern.
8. **Circuits.** Each model's circuit is its own provider's — `gemini/<model>`, `groq/<model>`.
   Gemini's failures never rest Groq's model, nor Groq's failures Gemini's, and each recovers by its
   own probe (the half-open fix, `acf0f1c`). With Gemini resting, Groq serves (the service is
   `degraded`); with both resting, a request is refused at once as busy.
9. **Deadlines and attempts.** Each model tried has its own `AI_TIMEOUT_MS`, so a Gemini that timed
   out leaves Groq the whole of one: one router call takes at most twice `AI_TIMEOUT_MS`
   (`ModelRouter.longestCallMs`). A grounded answer is bounded by its own deadline as well (twice
   the timeout and five seconds); an assistant answer still `streaming` counts as abandoned only
   past the longest call and 30 seconds, so a stand-in still writing is never closed under it. One
   router call makes at most two calls — no retry loop; a grounded answer's second attempt, after
   an answer that broke the rules, goes through the same router, Gemini first.
10. **Records.** Every call's ledger row names its provider and model and whether it stood in
    (`ai_requests.fallback`); a grounded answer's audit entry records the provider, model and
    `fallback` of the answer it kept; an assistant message names the provider and model that wrote
    it; every call's log line names its provider. Costs come from `AI_MODEL_COSTS` per model, from
    each provider's price list; with a monthly budget the stand-in needs a price too, or the API
    refuses to start. No prompt, answer, passage or key is in any of them.
11. **Keys.** `GROQ_API_KEY` is server-only, as Gemini's: a bearer token to `GROQ_BASE_URL` (https
    outside local) and nowhere else, redirects refused; never in a URL, an error, a log line, a
    record or a response. A failure carries Groq's status, type and code, never its message.
12. **Unchanged.** Embeddings (Gemini alone, no stand-in: a failed embedding is a failed one), the
    vector schema and dimension, the evidence floor, the answer cache (an answer the stand-in wrote
    is not cached: the cache keys on the main provider's model), and the browser, which never
    learns which provider answered.

## Consequences

- An answer survives a Gemini outage, overload or spent quota, at Groq's price and under the same
  checks; Gemini's 503 and 429 stop being the learner's error while Groq is up.
- Two vendors process course material once Groq is configured: the institute's records of its data
  processors must name Groq.
- The institute cannot choose the stand-in while the deployment names a fallback provider, and its
  settings page does not show whether that stand-in has a price (a deployment setting).
- An answer's wording may differ between the providers; what it may say and cite does not.
- While Gemini's model rests, the service reads as answering (`degraded`) because Groq can stand
  in — though not for a learner's own work: a lab hint asked then is refused at the call, as busy,
  after its question is stored, rather than before. Nothing reaches Groq.
- Verified live on 5 October 2026 (`ai:fallback-smoke`): Groq on its own answered and cited
  (`openai/gpt-oss-120b`, under a second); a real Gemini failure (`gemini-3.5-flash` past its
  deadline) was answered by Groq through the router, cited and checked; a real non-eligible Gemini
  failure (a refused key) never reached Groq; no key appeared in any output.

## Alternatives considered

- **LangChain or LangGraph** for the routing: refused, as in ADR-0025 — no dependency for a loop
  of two models.
- **Groq embedding too**: refused — two models' vectors are not comparable, and the evidence floor
  is one model's.
- **Falling back on every failure**: refused — a refused key, an invalid request or an unreadable
  answer would only be repeated elsewhere, and a refusal of the platform's must never be.
- **Gemini's own lighter model as the stand-in** (`gemini-3.5-flash-lite`): still possible without
  `AI_FALLBACK_PROVIDER`, but it shares Gemini's outages and the key's quota project.
