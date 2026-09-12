---
name: Truthful analysis progress
description: Rules for reporting progress and ETA while forensic analysis is running.
---

Analysis progress must advance at real weighted phase boundaries. Time-based movement is allowed only inside the currently active long phase and must be explicitly identified as an estimate.

**Why:** Random or purely cosmetic percentages can imply that a detector or AI agent has finished when it has not, which is misleading in a forensic workflow.

**How to apply:** Keep server phases authoritative, never let an estimated value cross the next real phase boundary, show ETA as unavailable when there is not enough evidence, and remove runtime progress after terminal completion.