---
name: Stable video preview ranges
description: Why browser-compatible transcoded previews must be stable across HTTP Range requests.
---

Browser video playback may issue several overlapping byte-range requests and abort earlier ones while seeking or buffering. A preview endpoint that creates a new transcoded file for every request can report valid metadata yet remain stuck at time zero.

**Why:** A real browser loaded the full video metadata but could not advance playback because each fallback WebM request launched another multi-second conversion and then deleted its temporary result.

**How to apply:** Generate one atomic, cacheable browser-compatible preview per source revision, share concurrent generation work, retain the completed preview for later Range requests, and serve ranges from that stable file.