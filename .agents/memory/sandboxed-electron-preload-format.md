---
name: Sandboxed Electron preload format
description: Required module and path conventions for Electron preload scripts in the desktop package.
---

Compile the preload entry as CommonJS (`.cts` to `.cjs`) while keeping renderer sandboxing, context isolation, and disabled Node integration. Resolve main-process filesystem paths from `import.meta.url`; never use CommonJS `__dirname` in the ESM main entry.

**Why:** Typecheck and bundling can pass while a sandboxed ESM preload silently fails at runtime, leaving the renderer bridge undefined. An ESM main entry also throws immediately when it references `__dirname`.

**How to apply:** Preserve the `.cjs` preload output and clean both the emitted main directory and TypeScript build-info cache before every release build. Confirm a real Electron window renders, not only that compilation succeeds.