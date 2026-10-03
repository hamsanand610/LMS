# AI architecture plan — the SI Academy AI Learning Agent

| Field  | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status | **TARGET DESIGN, decisions taken** — written in Roadmap Phase 0 (2 October 2026); §9's decisions were taken as ADR-0024 to ADR-0031 on 3 October 2026, Phase 7A built the foundation, Phase 7B the providers and routing (Gemini, the model registry and router, circuits), Phase 7C the gateway: conversations, streamed answers, usage and quotas, and Phase 7D the lifecycle: the institute's AI settings, background jobs (titles, notes, usage roll-up, budget alerts, retention) and the exact-key answer cache, ADR-0032 (`apps/api/src/modules/ai`, off by default) |
| Starts | Roadmap Phase 7, and only after Phase 6's gate is green (`docs/ROADMAP.md`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Rule   | Technology choices are made by ADRs (§9; ADR-0024 to ADR-0031); what an ADR has not decided is still an option, not a decision                                                                                                                                                                                                                                                                                                                                                                                                                                              |

## 1. Goal and non-goals

**Goal.** An LMS-specific AI Learning Agent that teaches, explains and guides from SI Academy's own,
authorised context. That context includes:

- courses, lessons and learning material;
- assignments, and coding, SQL, web and debugging exercises;
- the learner's own progress, attempts and visible test results;
- skill and topic metadata, and learning history;
- knowledge created by trainers.

It works through retrieval and controlled, agentic workflows.

**Non-goals:**

- a generic public chatbot;
- training a foundation model;
- fine-tuning before evaluation data shows it is needed, and then only by a later ADR;
- AI that awards marks or verdicts. Verdicts come from the sandbox, marks from trainers and the
  server (ADR-0016).

## 2. Target architecture

```
LMS (web, API)
 └─▶ AI gateway — the `ai` module: authentication, permission, flag, rate limit, quota, conversation
      └─▶ Context + authorisation layer — LMS data through the existing services and scope checks
           └─▶ RAG retrieval — metadata filters first, then similarity
                └─▶ Vector search / embeddings
                     └─▶ LangChain orchestration — prompts, retrievers, model wrappers, parsers
                          └─▶ LangGraph agent workflow — explicit nodes and edges, bounded steps
                               └─▶ Controlled tools — typed, allow-listed, run as the user
                                    └─▶ LLM — behind a provider abstraction
                                         └─▶ Validation / safety / policy layer
                                              └─▶ Response (streamed) + audit and usage records
```

| Layer                     | Responsibility                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AI gateway                | The only entry point: `apps/api/src/modules/ai`, endpoints under `/api/v1/ai` with streaming. It uses the same guards as every module: authentication, a declared permission, a module flag that stays off in production until approved, rate limits. It adds per-user and per-institute quotas, and stores conversations.                                                                                                                       |
| Context + authorisation   | Assembles a request's context through the services the REST API already uses, with the requesting user's identity and scope; it never reads tables around them. It removes what the user may not see before anything reaches a prompt, and records which items were used.                                                                                                                                                                        |
| Retrieval (RAG)           | Filters on metadata first (organisation, course, publication to the user's batch, visibility, audience), then ranks by similarity. Keyword search can be combined in later, if evaluation shows it helps.                                                                                                                                                                                                                                        |
| Embeddings, vector search | Embeddings through the provider abstraction; storage decided by ADR (§9).                                                                                                                                                                                                                                                                                                                                                                        |
| Orchestration             | LangChain for prompt templates, retrievers, model wrappers and structured output; LangGraph for the agent: a stateful graph with explicit nodes, bounded tool calls, and a human hand-off (escalation to a trainer).                                                                                                                                                                                                                             |
| Controlled tools          | An allow-list per capability. Each tool is a typed function over an existing service, run with the user's identity and scope, read-only by default. Write tools exist only where the product defines them, such as escalating a doubt or saving generated practice, and they need the learner's confirmation. There is no shell, no free HTTP, no SQL. Code runs only through the sandbox runner, with a learner's limits and on visible inputs. |
| LLM                       | A provider-neutral interface (chat, streaming, embeddings, token counting), with a model per task set in AI settings. Keys live only on the server. The planning report proposed the Claude API (F-23, F-24); the ADR confirms or changes it.                                                                                                                                                                                                    |
| Validation / policy       | Retrieved and learner-written content is treated as data, never as instructions. Output is checked for leaks of protected material. The guided-learning policy applies (hints before solutions on graded work). AI is unavailable where an assessment forbids it.                                                                                                                                                                                |
| Response, audit, usage    | Streams to the browser. Records messages with the context they used, and per call the model, tokens, cost and latency. Writes audit entries. Enforces quotas and budget alerts.                                                                                                                                                                                                                                                                  |

## 3. Guarantees

These hold from Phase 7 onwards and are tested in Phase 10:

1. **No privilege through the AI.** A user can learn nothing through the AI that the product would
   not show them. The same permissions and scopes apply.
2. **No protected material leaks.** None of the following ever reaches a learner's prompt, a
   retrieval result a learner can reach, or a reply:
   - hidden test cases, expected outputs and answers not yet released;
   - unpublished content;
   - private trainer material.
3. **Learners stay separate.** Another learner's data never enters a prompt.
4. **Assessments stay intact.** No AI help inside a timed test or any assessment whose rules forbid
   it.
5. **Guided learning.** Where the policy requires it, the agent gives progressive hints rather than
   a complete solution.
6. **Verdicts are not the model's.** Verdicts and marks come from the sandbox and from trainers.
7. **Off by default.** Secrets stay on the server, and AI features are off in production until
   approved (operating rule 35).
8. **Traceable.** Every call can be traced to a user, a purpose, the context used, a model and a
   cost.

## 4. Knowledge system (Phase 8)

**Sources:**

- course descriptions, lessons and notes;
- documentation;
- assignment problem statements (the visible part only);
- approved learning resources;
- trainer-created knowledge.

**Pipeline:** source → clean → chunk → metadata → embedding → vector storage → retrieval →
reranking or selection where justified → context assembly → model.

**Metadata.** Each chunk carries everything that authorisation and filtering need:

- organisation;
- source type and ID;
- course, module and lesson;
- topics and skills;
- visibility (public, enrolled, staff, private) and audience roles;
- the publication or batch scope;
- version and checksum.

Ingestion runs as queue jobs triggered by publish, update and unpublish events. Deleting a source
deletes its chunks. Hidden test cases and expected outputs are never ingested.

## 5. Agent workflows (Phase 9)

| Capability                   | Context and tools                                                                                            | Guardrail                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Explain a lesson             | retrieval over lessons published to the learner                                                              | answers cite their sources                                      |
| Clarify doubts               | the doubt thread, lesson retrieval                                                                           | escalates when unresolved                                       |
| Explain a failed submission  | the learner's code, visible compiler and runtime output, visible test results, the visible problem statement | hidden tests never appear                                       |
| Coding hints                 | as above                                                                                                     | progressive hint levels set by policy                           |
| Explain SQL mistakes         | the schema description, the learner's query, visible results                                                 | no hidden expected rows                                         |
| Help debug                   | the learner's code and errors; may re-run it in the sandbox on visible inputs only                           | the learner's own limits apply                                  |
| Quiz the learner             | topic retrieval                                                                                              | generated questions never enter the bank without staff approval |
| Generate contextual practice | topic and the learner's current level                                                                        | marked as AI-generated                                          |
| Recommend material           | the learner's progress, the published catalogue                                                              | links only to content the learner can open                      |
| Identify weak-topic patterns | the learner's own attempts and progress                                                                      | explains the signals it used                                    |
| Guide learning progression   | progress and course structure                                                                                | suggestions, never automatic changes                            |
| Escalate to a trainer        | creates or updates a doubt for the learner's trainer                                                         | only on the learner's confirmation                              |

**Graph.** The agent is a LangGraph graph that runs these steps in order:

1. route the intent;
2. authorise and assemble context;
3. retrieve;
4. call tools in bounded steps;
5. draft;
6. validate against the policy;
7. reply or escalate.

Step count, token count and wall time are each capped.

## 6. Data (preliminary; settled in the Phase 7 phase plan)

Tables, in outline:

- AI settings per institute: features, models, quotas;
- conversations: user, purpose, the course, lesson or problem they are about;
- messages: role, content, tokens, model, the context used, policy flags;
- usage per call: model, tokens, cost, latency, feature;
- feedback on replies;
- knowledge sources, and chunks with their embeddings and metadata.

Retention follows the privacy rules of Phase 4. A learner's AI data is exported and erased with the
rest of their data.

## 7. Observability and evaluation

- **Tracing.** LangSmith, or an equivalent, traces development and evaluation runs. Before any
  learner data is traced, the ADR decides:
  - what may leave the platform, and how personal data is redacted;
  - which environments send traces;
  - whether the service is the hosted one or self-hosted.
- **Evaluation (Phase 10).** Datasets are built from SI Academy content:
  - factual correctness, grounding, relevance and hallucination;
  - retrieval quality and context selection;
  - response consistency;
  - quality of coding and SQL guidance;
  - usefulness to learners.
- **Red-team suite (Phase 10).** Covers:
  - prompt injection and system-prompt extraction;
  - hidden-test and answer leakage;
  - cross-user leakage and unauthorised retrieval;
  - quota bypass and cost abuse;
  - malicious uploaded content;
  - agent tool abuse.

Thresholds are set in the Phase 10 plan.

## 8. Cost and quotas

- Quotas per user, per role and per day, and a monthly budget per institute with alerts.
- A model chosen per task, so simple tasks run on cheaper models.
- Prompt caching where the provider supports it.
- Streaming, timeouts and cancellation.
- Usage is visible to administrators (Phase 4 reports, extended in Phase 7).

## 9. Decisions to take as ADRs at the start of Phase 7

1. **Provider and models,** with a fallback. Judged against the Phase 10 criteria and the provider's
   terms for learner data (retention, region).
2. **Where orchestration runs.** LangChain.js and LangGraph.js inside the API and the worker keep one
   language, one deployment, and the existing guards and scope services. A separate Python service
   is the alternative if a needed capability exists only there.
3. **Vector storage.** pgvector inside the existing PostgreSQL keeps one database: metadata stays in
   the same transactions, authorisation filters are plain SQL joins, and AWS's managed PostgreSQL
   supports it. It needs a PostgreSQL image with the extension in every environment, replacing
   today's `postgres:16-alpine`, and raw SQL alongside Prisma. The alternative is a separate vector
   database.
4. **Embedding model and dimension,** and how to re-embed when either changes.
5. **Observability:** LangSmith, hosted or self-hosted; what may be traced; redaction.
6. **Quotas, budgets and cost reporting.**
7. **Streaming transport** through the web app and the proxy; **conversation retention.**
8. **Where AI is allowed:** per feature, per role, and per assessment.

External dependency: an AI provider account and keys (and a LangSmith account, if chosen), supplied
by the client and held as server-side secrets.

## 10. Phases

| Phase | Delivers                                                                                                                                                                                       |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7     | AI module and gateway, provider abstraction, settings and flags, conversations and messages, usage, cost, quotas, streaming, context assembly, vector storage, orchestration skeleton, tracing |
| 8     | Knowledge ingestion, metadata, authorised retrieval                                                                                                                                            |
| 9     | The twelve agent capabilities through controlled tools                                                                                                                                         |
| 10    | Evaluation suite and red-team suite with thresholds                                                                                                                                            |
| 11    | Mock interviews, behind flags until quality is proven                                                                                                                                          |

**Amended 3 October 2026 by the client's Phase 7A brief:** vector storage and embeddings move to
Phase 8 with retrieval (ADR-0026, ADR-0027); orchestration frameworks (LangChain, LangGraph) and
external tracing (LangSmith) stay out of Phase 7 (ADR-0025, ADR-0028). Phase 7's slices are in
`docs/phases/PHASE-07-ai-foundation.md`.

## 11. Risks

| Risk                                                      | Mitigation                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Hallucination                                             | grounding with citations, evaluation thresholds, "I don't know" paths          |
| Leakage of protected material                             | material is never ingested, context is filtered, output checks, red-team tests |
| Prompt injection through lessons, uploads or learner code | content treated as data, no tools reachable from content, a bounded agent      |
| Cost overrun                                              | quotas, budgets, model per task, caching, alerts                               |
| Latency                                                   | streaming, smaller models for simple tasks, retrieval tuning                   |
| Provider lock-in                                          | provider abstraction, evaluation sets that can be re-run on another provider   |
| Learner data leaving the platform                         | ADR on what a provider and a tracer may receive; redaction                     |
