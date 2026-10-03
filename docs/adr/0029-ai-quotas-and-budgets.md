# ADR-0029 — AI quotas and budgets

- **Status**: accepted (decided in the client's Phase 7A brief, 3 October 2026)
- **Date**: 2026-10-03
- **Phase**: Roadmap Phase 7 (AI foundation), slice 7A
- **Implements**: `docs/architecture/AI_ARCHITECTURE.md` §9, decision 6

## Context

Model calls cost money per token, and a free tier is limited by requests. One heavy user, a loop in a
browser tab or an abusive script must not be able to spend an institute's budget.

## Decision

1. **No uncontrolled provider calls.** From Phase 7B each call is attributed to a user, an
   organisation, a feature and a task.
2. **Quotas (Phase 7C)** are enforced before a call: per user per day, and a monthly budget per
   organisation. An estimated cost per model comes from configuration. When a call cannot be
   accounted for, or is over quota, it is refused: the check fails closed.
3. The existing per-route rate limits apply to every AI route, and each user has at most one
   generation running at a time (the `ExecutionGate` pattern).
4. Usage is recorded per call and per user per day (7C), so that usage reports and budget alerts
   (7D) read the platform's own data.

## Alternatives

- Relying on the provider's own quotas: no per-user fairness and no institute budget.

## Consequences

- Phase 7A makes no provider calls at all: the gateway answers that AI is unavailable. The message
  route already carries a per-user rate limit.

## Implementation (Phase 7C, 4 October 2026)

This section records how decisions 1–4 are carried out. Nothing above changes.

- **Allowances.** They are deployment configuration (`AI_USER_DAILY_REQUESTS` 50 and
  `AI_USER_DAILY_TOKENS` 100,000 per person per day, in the institute's time zone). An optional
  `AI_ORG_MONTHLY_BUDGET_USD` caps the institute's monthly spend.
  - The defaults are deliberately modest.
  - Per-institute settings can follow the AI settings (Phase 7D or 7E).
- **The check.** It runs before any call and refuses at the limit (`429 ai_quota_exceeded`,
  audited). If usage cannot be read, the error stops the question: it fails closed.
- **Prices.** With a budget set, every routed model needs a price in `AI_MODEL_COSTS`, or the API
  refuses to start.
- **Counting.** It happens once, in the transaction that closes the answer. That transaction
  writes:
  - one ledger row per call (`ai_requests`);
  - one question in the day's totals (`ai_usage_daily`), however many calls the question took.

  A call that stopped while writing is counted with estimated tokens, marked so.

- **Overshoot.** The last question of a day may finish a little over the token allowance, because
  its size is not known in advance. `AI_MAX_OUTPUT_TOKENS` (4096) and the context window bound it.
- **One answer at a time.** Each person has one answer at a time (decision 3), enforced by the
  database: a partial unique index allows one `streaming` message per person.
- **Rate limits.** The existing `@RateLimit` stays the short-term abuse limit: 20 questions in 5
  minutes per person.
- **Budget alerts and usage reports** are 7D's.

## Implementation (Phase 7D, 4 October 2026)

This section records how decisions 1–4 are carried further. Nothing above changes.

- **The institute's allowances.** The Super Admin's AI settings (`GET` and `PATCH
/ai/admin/settings`, `ai:manage`; the `ai` row of the settings table) set the daily questions
  and tokens per person, the monthly budget and the warning share. An empty field keeps the
  deployment's variable, which stays the default. Every change is checked whole and audited
  (`ai.settings.updated`).
- **A budget the platform can count.** While a budget is set, a routed model without a price could
  not be counted against it: saving such settings is refused, and should the deployment's prices
  change later, no call is made until the model has one (the check fails closed).
- **Calls in the background.** A conversation's title and notes are calls made for its owner. They
  are checked against the owner's tokens and the institute's budget before they are made, recorded
  in the ledger, and added to the owner's day — tokens and cost, never a question.
- **The ledger's day.** Each call keeps the institute day it was counted on (`ai_requests.day`), and
  the call that carried a question is marked (`counts_as_question`), so the ledger alone gives each
  day's totals.
- **The usage roll-up** (`ai.usage.rollup`, every hour) settles each closed day: it sets each
  person's daily totals to what the ledger says. A day is taken by moving a watermark onto it in the
  same transaction, so it is settled once however many runs race; only closed days, never today,
  and never an erased person's anonymous totals. A repair is audited (`ai.usage.reconciled`).
- **Budget alerts** (`ai.budget.alert`, every quarter of an hour): at the warning share
  (`ai.budget.warning`) and at the budget (`ai.budget.exceeded`), each once a month, claimed in the
  database so two workers raise it once. Costs are said to be estimates. At the budget no question
  is answered and no title or note is written — enforced on the server before every call.
- **Usage figures** (`GET /ai/usage`, `ai:usage_read`): per day and per person, for administrators
  everyone and for trainers the learners of their batches; figures only.
