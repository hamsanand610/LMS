# ADR-0007: Code execution through an isolated adapter

- Status: Accepted (client decision: external/isolated adapter, never inside the API). Amended by ADR-0016 (accepted 2026-10-01, Task 4): the drivers become `runner` (default), `judge0` and `none`; the browser driver is retired; the rule that the API never executes learner code stands.
- Context: Coding practice is required; Judge0 needs a Linux host with specific kernel settings; the demo must be safe and free (plan §10, §19.2).
- Decision: An `ExecutionDriver` interface with two drivers: `browser-sandbox` (JavaScript in a sandboxed iframe/Web Worker at an opaque origin; Python via Pyodide; results recorded as untrusted) and `judge0` (separate service over a private network; results trusted). The API process never compiles, evaluates or spawns student code; a test asserts the browser driver performs no server-side execution.
- Alternatives: Judge0 required for the demo (blocked on Windows/Arm hosts), custom container runner (too costly for the team).
- Consequences: practice and coding questions work in the demo with trust badges; trusted grading is enabled by configuring a Judge0 host.
