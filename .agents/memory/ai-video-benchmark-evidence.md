---
name: AI video benchmark evidence
description: Evidence standard for prompt-regression benchmarks in video forensics.
---

Do not treat hand-authored forensic JSON as a valid accuracy measurement. A
benchmark sample needs a stable media hash and source, documented label evidence,
a reproducible transformation recipe where applicable, and forensic findings
captured through the production worker in the production AI-input shape.

**Why:** Synthetic findings encoded the expected answer and produced an
optimistic result that did not survive evaluation on actual labeled videos.

**How to apply:** Keep paid execution and database writes in an internal,
restart-safe runner. Public API routes may expose the catalog and reports but
must not accept benchmark verdicts or launch paid benchmark calls. Never lower
regression thresholds to make the current baseline pass; report failures as the
measured outcome.