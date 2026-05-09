# Research: AI Provider Thinking Layer

## Decision: Default to non-stream structured Thinking calls

**Rationale**: The Thinking Result is a short structured object and downstream stages must wait for the complete validated object before starting. A non-stream structured call simplifies parsing, validation, retry, and observability while the outer agent stream still keeps users informed with safe status events.

**Alternatives considered**:

- Internal provider streaming with buffered output: viable but adds stream parsing edge cases without user-facing benefit because raw chunks must not be forwarded.
- Free-form text completion followed by parsing: rejected because downstream code must never rely on unconstrained text from the model.

## Decision: Three-stage validation before downstream use

**Rationale**: Shape validation ensures the model returns the expected contract; business validation catches contradictory or unsafe combinations; one repair attempt handles recoverable model mistakes without silently inventing new requirements. This matches the safety requirements for destructive changes, stack changes, and uninitialized projects.

**Alternatives considered**:

- Shape validation only: rejected because valid JSON can still be unsafe or logically inconsistent.
- Multiple repair retries: rejected as over-engineering and increases latency/cost without a clear product need.

## Decision: Clarification fallback on unrecoverable analysis failures

**Rationale**: If parsing, validation, repair, or confidence checks cannot produce a safe result, asking the user for clarification avoids unsafe planning and preserves project state. This provides a consistent user-facing outcome for ambiguity and model/provider failures.

**Alternatives considered**:

- Continue with raw prompt: rejected because it violates the Agent Task contract and safety requirements.
- Hard failure only: rejected because many failures can be explained to the user as clarification/retry needs.

## Decision: Sanitized event stream only

**Rationale**: Users need progress while analysis blocks downstream work, but raw provider deltas, hidden reasoning, and unvalidated JSON must not leave the server. The event stream should expose only stable status and validated summaries.

**Alternatives considered**:

- Stream provider deltas directly: rejected due to privacy, prompt-injection, and unvalidated-output risk.
- No events until analysis completes: rejected because the client would appear idle during a blocking provider call.

## Decision: Agent Task as the downstream boundary

**Rationale**: Planner and source services should consume a normalized task built from a validated Thinking Result, not raw model output or raw user prompt. This gives downstream stages clear intent, affected areas, acceptance criteria, risk, and required actions.

**Alternatives considered**:

- Pass Thinking Result everywhere: rejected because it leaks analysis-only fields and couples downstream services to provider interpretation details.
- Pass only normalized text: rejected because planners need structured affected areas, risk, and requirements.

## Decision: Persist safe summaries, not raw reasoning

**Rationale**: Run history and debugging need intent, confidence, risk, recommended next step, and summary. Raw provider output, hidden reasoning, partial chunks, and secrets should not be stored or exposed.

**Alternatives considered**:

- Persist full raw provider response for debugging: rejected due to privacy and chain-of-thought exposure risk.
- Persist nothing: rejected because operators need enough observability to diagnose classification and safety outcomes.
