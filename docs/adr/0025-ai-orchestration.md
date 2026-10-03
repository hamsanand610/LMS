# ADR-0025 — AI orchestration stays in house for Phase 7

- **Status**: accepted (decided in the client's Phase 7A brief, 3 October 2026)
- **Date**: 2026-10-03
- **Phase**: Roadmap Phase 7 (AI foundation), slice 7A
- **Implements**: `docs/architecture/AI_ARCHITECTURE.md` §9, decision 2

## Context

The target architecture names LangChain for prompts and retrievers and LangGraph for the agent
(Phases 8–9). Phase 7 needs none of that yet: it needs provider calls, routing, streaming, usage
accounting and policy, and those are the parts where control matters most — abort on disconnect,
exact token counts, refusals and audit.

## Decision

1. Phase 7's provider calls, routing, streaming, usage and policy are TypeScript inside the API's
   `ai` module (ADR-0001), under SI Academy's control.
2. Phase 7 adds **no** LangChain, LangGraph or LangSmith dependency.
3. Adopting any of them later (LangChain retrievers in Phase 8, a LangGraph agent in Phase 9) needs
   its own ADR. An adopted framework wraps `AiProvider`; it never bypasses usage, policy or audit.

## Alternatives

- LangChain.js from the start: more dependency weight and less control over streaming, abort and
  usage, before anything needs a chain.
- A separate Python service: a second language and runtime, and every guard and scope check
  duplicated.

## Consequences

- The orchestration layer of the target architecture stays a target for Phases 8–9.
- The client's technology list keeps LangChain, LangGraph and LangSmith as planned, not decided.
