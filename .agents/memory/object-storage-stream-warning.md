---
name: Object Storage stream warning
description: Explains a benign listener warning emitted by the current Google Storage transport.
---

The Google Storage transport can emit `MaxListenersExceededWarning` from an internal `teeny-request` `PassThrough` while downloading an object, even when each request creates a new stream.

**Why:** Trace warnings showed all extra listeners originate inside `teeny-request` while it assembles one download pipeline, not from retained application listeners. Changing between `file.download()`, `createReadStream()`, and Node pipelines did not remove it.

**How to apply:** Do not hide it by raising the global listener limit. Treat it as a dependency/runtime transport quirk unless memory growth or repeated listeners on the same application-owned emitter are independently observed.