---
name: Preview and source duration drift
description: How video editor validation handles small duration differences between browser previews and original media.
---

Browser-compatible transcoded previews can report a duration that differs from the original container by a few frames. Treat a small difference as normal, but continue rejecting clearly out-of-range trim requests.

**Why:** A valid full-length clip selected from the browser preview can otherwise fail export because the server probes a slightly shorter duration from the immutable original.

**How to apply:** Let the server remain authoritative. Accept only a narrow drift tolerance and clamp the effective trim endpoint to the server-probed source duration before composing the export.