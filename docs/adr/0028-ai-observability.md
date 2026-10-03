# ADR-0028 — AI observability with the platform's own records

- **Status**: accepted (decided in the client's Phase 7A brief, 3 October 2026)
- **Date**: 2026-10-03
- **Phase**: Roadmap Phase 7 (AI foundation), slice 7A
- **Implements**: `docs/architecture/AI_ARCHITECTURE.md` §9, decision 5

## Context

Every AI call must be traceable to a user, a purpose, a model and a cost (AI architecture §3,
guarantee 8). The platform already has request ids on every log line and in the audit log,
structured logs with redaction, and the audit log itself. Prompts and answers may hold personal data.

## Decision

1. **Reuse** request ids, the structured pino logs and `AuditService`. No new logging system.
2. From Phase 7B, each AI call records provider, model, task, latency, token usage, outcome and the
   request id. It goes to the usage ledger (7C) and the log, without prompt or answer text.
3. **Never log** provider keys or authorization headers. The logger carries explicit redaction paths
   for them (7A). Prompts and answers are content: they are stored only in the owner's conversation,
   once that exists, and never in logs.
4. The audit log records governance events: AI settings, models, quotas, flags, policy refusals
   (as metadata only) and deletions. It is not a log of every call.
5. **No external tracing platform** (LangSmith, OpenTelemetry exporters) in Phase 7. A later ADR
   decides what may leave the platform and how it is redacted.

## Alternatives

- LangSmith or another hosted tracer now: learner data could leave the platform before that has been
  decided.

## Consequences

- AI observability is queryable in the platform's own database and logs.
- External tracing remains an option once its data rules are settled.
