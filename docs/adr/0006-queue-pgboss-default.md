# ADR-0006: Queue interface with pg-boss as the default driver

- Status: Accepted (refinement R-1 of the master report, approved with the architecture plan)
- Context: Free staging options lack worker processes or count Redis commands; the scale target (≤ 5,000 students) is small; one less service simplifies local development.
- Decision: Background work goes through a `QueueDriver` interface; the default driver is pg-boss on PostgreSQL (SKIP LOCKED, retries, cron); the worker runs embedded in the API (`WORKER_MODE=embedded`) locally and on free tiers, or as `apps/worker` in production. Redis/BullMQ remains a documented driver for high-scale deployments. Cache and rate-limit stores follow the same pattern (in-memory/PostgreSQL now, Redis later).
- Alternatives: Redis + BullMQ from day one (extra service, unfit for free tiers).
- Consequences: PostgreSQL carries queue load (acceptable at target scale); jobs must be idempotent; switching drivers is configuration.
