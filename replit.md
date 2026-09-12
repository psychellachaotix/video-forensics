# Video Forensics

Forenzní pracovní prostor pro nahrávání videí, kontrolu technických stop úprav, ruční rozhodování sporných případů a tvorbu HTML reportů.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- App Storage env vars are provisioned automatically for uploaded video evidence.
- AI env: `ANTHROPIC_API_KEY`, or the Replit-managed `AI_INTEGRATIONS_ANTHROPIC_API_KEY` and `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`.
- AI model defaults to `claude-sonnet-4-6`; `ANTHROPIC_MODEL` can explicitly override it when pricing is updated alongside the model.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5, with ffprobe-based media inspection
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract and generated frontend hooks
- `lib/db/src/schema/` — videos, raw analysis steps, AI results, and cost log
- `artifacts/api-server/src/routes/analyses.ts` — analysis lifecycle and hash cache
- `artifacts/api-server/src/routes/storage.ts` — validated presigned uploads
- `artifacts/video-forensics/src/` — bilingual React application

## Architecture decisions

- Each video stores six independent analysis-step rows so one unavailable step does not abort the whole pipeline.
- Only metadata/playability and an encoder-tag heuristic currently run; cuts, frames, audio, and color analysis remain explicitly unavailable until the Python worker is implemented.
- SHA-256 is computed in the browser before upload metadata is committed; duplicate hashes return the cached database result.
- More than half of unavailable analysis steps forces an uncertain result instead of guessing.
- Interpret and Verifier run as separate Anthropic calls; prompt version, token usage, estimated cost, retry count, and manual verdict are persisted.

## Product

- Multi-video upload for MP4, MOV, AVI, and MKV files up to 2 GB
- Dashboard, monthly AI-cost total, recent cases, and manual-review queue
- Technical metadata inspection with evidence ledger and HTML report
- Manual verdict override for disputed or uncertain analyses
- Czech/English switch with Czech as the default language

## User preferences

- Keep the entire application bilingual (Czech and English) with a visible language switch.
- Do not guess a verdict when source evidence is insufficient.

## Gotchas

- Re-run API codegen after every OpenAPI change.
- Uploaded file bytes go directly to App Storage using a presigned URL; the API receives metadata and object paths only.
- AI API network and rate-limit failures are retried after 2 and 5 seconds; permanent failures remain rerunnable with `CHYBA_API`.
- The current API and private-object routes have no user authentication or per-case authorization and must not be treated as production-secure.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
