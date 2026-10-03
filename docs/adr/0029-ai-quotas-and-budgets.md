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
