# ADR-0041 — Personal data and the AI providers: approved explicitly, Gemini only, never a stand-in

- **Status**: accepted — built on 7 October 2026 in Phase 9 under the client's Phase 9 completion
  brief. Decision 1's precondition (verified provider terms) is **open**: until it is met, no
  deployment approves `personal` for real learners.
- **Date**: 2026-10-07
- **Phase**: Roadmap Phase 9 (AI Learning Agent), slices 9C and 9E
- **Builds on**: ADR-0024 (providers and data classes; decision 4 stays in force), ADR-0031,
  ADR-0038 (Groq as a stand-in for `public` and `course` only)
- **Successor of**: ADR-0024 decision 4 — as to how `personal` is approved; the verification of
  the provider's terms it asks for is still to be recorded (below)

## Context

Phase 9C gives the learning agent the learner's own records — their progress, what is due, their own
lab code — which ADR-0024 classes as `personal`. Groq stands in for Gemini (ADR-0038) and is approved
for `public` and `course` only. ADR-0024 forbids real learner data to a free-tier provider until its
data-use terms are verified and recorded; Gemini is used on a free tier in development. The client's
brief: personal context is unavailable unless explicitly approved; personal to Gemini only, never
to Groq; restricted to no model; synthetic data for tests; fail closed.

## Decision

1. **Explicit approval, twice.** `personal` reaches a provider only when the deployment approves it
   (`AI_DATA_CLASSES` includes `personal`; the default is `public`) and the institute has not
   narrowed it out (AI settings' data classes). Approving it for real learners requires, first, the
   provider's paid-tier data-use terms (retention, training use, region) verified and recorded in
   this ADR. Until then only synthetic data is used with it (tests, the fake provider, a scratch
   database).
2. **Gemini only; never a stand-in not approved for it.** A call's data class is the most
   sensitive of what it sends (ADR-0040). The router plans a stand-in only when the stand-in's model
   accepts that class, so a `personal` call goes to the task's own model and nowhere else: when that
   model fails, the run fails and says so — it is never retried on Groq. Groq stays `public` and
   `course` (ADR-0038).
3. **`restricted` goes to no model**: refused before any call, as before (credentials, hidden tests,
   reference solutions, answer keys, staff notes are never read for the agent at all).
4. **Unavailable is said, not guessed.** While `personal` is not approved, the learner-state and
   lab-attempt tools are `unavailable`; a run whose capability needs them ends with
   `context_unavailable` and the platform's own words; an optional state read is skipped; history
   messages kept as `personal` are left out of requests. The availability endpoint tells the browser
   (`subjects.learnerContext`) so it does not offer what would be refused; the API decides again on
   every run.
5. **Approved now, not only then.** The last check before an answer is given asks again whether its
   data class is approved: an approval withdrawn during the run withholds the answer.

## Consequences

- Locally and in staging today `AI_DATA_CLASSES` is `public` (or `public,course`): the learning
  agent explains lessons and clears doubts, and says it cannot use the learner's own records.
- Turning the learner context on in production is configuration — `AI_DATA_CLASSES` and the
  institute's settings — after the terms are recorded here and the client approves.
- CI and the browser smoke approve `personal` for the fake provider only (synthetic data).

## Terms verification record

| Provider | Tier | Terms verified | Recorded by | Personal approved |
| -------- | ---- | -------------- | ----------- | ----------------- |
| Gemini   | —    | not yet        | —           | **no**            |
| Groq     | —    | not applicable | ADR-0038    | **never**         |

## Alternatives considered

- **Personal to any configured provider.** Refused: a free tier may train on what it is sent.
- **Falling back to Groq with the learner's records removed.** Refused: an answer drafted without
  the context it needs is not the answer asked for; failing safely is clearer.
- **Approval per feature.** Not needed yet: the agent is the only surface sending `personal` besides
  the AI Hint (Phase 7E), which follows the same approval.
