# AGENTS.md

Portal Dokumen Perusahaan (PALOS) — Next.js App Router + Postgres (Drizzle) + better-auth. UI copy and code comments are in Indonesian; keep that convention.

## Commands (pnpm only — `packageManager: pnpm@12.3.4`)
- `pnpm dev` / `pnpm build` / `pnpm start`
- `pnpm typecheck` — the only verification script. There is **no `lint` script and no ESLint config** despite `eslint` being a devDependency; do not assume `pnpm lint` works.
- No test runner is configured.
- DB: `pnpm db:generate` (drizzle-kit generate from `lib/db/schema.ts` into `drizzle/`), `pnpm db:migrate` (apply). Migrations are checked in (`drizzle/0000_old_warlock.sql`, `drizzle/0001_amused_gideon.sql` + `drizzle/meta/`); regenerate rather than hand-writing SQL.
- **`pnpm db:migrate` / `drizzle-kit push` fail silently (exit 1) in this environment.** Workaround used so far: run `db:generate`, then apply the generated SQL manually (e.g. via a throwaway `tsx` script using `pg` reading `DATABASE_URL` from `.env.local`), and insert the statement hash into `drizzle.__drizzle_migrations` with the matching `when` from `drizzle/meta/_journal.json`.

## Setup
- Copy `.env.example` → `.env.local` (gitignored via `.env*.local`) and fill `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`.
- `/env.local` (no leading dot) is a stray file that is **NOT gitignored** and contains real Neon/AWS credentials. Never commit it; do not treat it as the env file Next loads.
- `drizzle.config.ts` falls back to `postgres://postgres:postgres@localhost:5432/portal` when `DATABASE_URL` is unset.

## Architecture
- Entrypoints: `app/page.tsx` + `app/[...slug]/page.tsx` both require a session and render `components/dashboard.tsx`; catch-all maps friendly slugs (`/rab`, `/quotations`, ...) to `/documents?type=...`.
- Data layer lives in `lib/db/` (schema + pooled Drizzle client). Domain logic is in `lib/documents/` (`service.ts` transactions, `calc.ts`, `schemas.ts` zod, `constants.ts`).
- API routes under `app/api/**` all wrap handlers with `route()` from `lib/api.ts`, which enforces auth + resolves role and centralizes error mapping (Zod → 422, Postgres `23505` → 409). `route()` passes a custom `Response` straight through, so binary/file responses work.
- Approval workflow: `STATUS_TRANSITIONS` in `lib/documents/constants.ts` is the source of truth; `transitionDocument()` in `service.ts` validates transition + permission + `expectedVersion` server-side and snapshots a version on approve/publish. Route: `POST /api/documents/[id]/transition`.
- Export: `lib/documents/export-docx.ts` (`docx`) and `export-pdf.ts` (`pdf-lib`, pure JS + WinAnsi glyph sanitizer). Routes `GET/POST` under `app/api/documents/[id]/export/docx|pdf` and bulk ZIP at `app/api/documents/export/bulk` (max 50 ids, partial-failure `_gagal.txt`). All export routes need `export const runtime = 'nodejs'`.
- Import: `app/api/documents/import` (parse only) + `/import/confirm` (create + store source). `lib/documents/import-service.ts` validates ext/MIME/size (8 MB) and extracts via `mammoth` (DOCX) / `pdfjs-dist` legacy build (PDF text). **Scanned/image-only PDFs fall back to OCR**: `pdf-to-img` (renders pages to PNG) + `tesseract.js` (`ind`+`eng`), bounded to 5 pages / 45 s — result carries `ocr: true`. If OCR also yields no text, the file is stored as an attachment-only draft (`parsed: false`; UI keeps the confirm button enabled and skips item validation). `.doc`/no-text files are stored as attachments without extraction. OCR/raster deps are in `serverExternalPackages` in `next.config.mjs` (native/wasm must be required at runtime, not bundled).
- File storage is **in the database** (`document_files.content` is `bytea`, private), not the filesystem/public dir. Download route: `GET /api/documents/[id]/files/[fileId]/download` (permission-checked).

## Conventions & gotchas
- **Permission rules live in `lib/permissions-client.ts`** (pure, no DB) as the single source of truth; `lib/permissions.ts` re-exports `can` and adds the DB-backed `getRole`. `can()` in client code only hides UI — the server re-checks via the same function.
- First user on an empty `user_role` table is bootstrapped as `admin`; everyone else defaults to `staff` (`lib/permissions.ts`).
- Money is integer rupiah stored in `bigint` columns; all totals are computed **server-side** in `lib/documents/calc.ts` (`computeTotals`) — never trust client totals.
- Document numbers are generated transactionally in `service.ts` `nextNumber` via the `document_counters` table, prefixed per `DOCUMENT_TYPES`.
- Soft delete everywhere: filter on `deletedAt IS NULL`. The `documents_number_uq` index is partial (`WHERE "deletedAt" IS NULL`), so numbers can be reused after deletion.
- Edit/delete are gated by status lists in `constants.ts` (`EDITABLE_STATUSES`, `DELETABLE_STATUSES`); updates use optimistic concurrency via `expectedVersion`.
- `documentUpdateSchema` is intentionally `.partial()` with **no `.default()`** so omitted fields are not reset; `documentInputSchema` has defaults.
- `components/dashboard.tsx` still renders hardcoded mock data (stats, recent docs) alongside real document pages — don't mistake it for live data.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
