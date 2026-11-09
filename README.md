# Đêm Qua 🌙

> Tell your dream in 60 seconds. Understand yourself a little better every morning.

[![CI/CD](https://github.com/erotonin/dream/actions/workflows/ci.yml/badge.svg)](https://github.com/erotonin/dream/actions/workflows/ci.yml)

**Đêm Qua** ("last night" in Vietnamese; working name) is a dream journal with AI interpretation, built for Vietnamese users. Each morning you tap the mic and describe last night's dream. The app writes an interpretation for you with a psychological reading, a Vietnamese folk reading, a question to reflect on and a small suggestion for the day. Over time it spots recurring symbols and dreams and sends a monthly letter about your dream life.

The business model is a monthly subscription: journaling stays free forever, while full interpretations, dream art and monthly reports are paid.

## Status

🚧 **Early skeleton.** The core flow works end to end: tell a dream (voice or text), get an interpretation, save it to the journal. Accounts, payments, reminders and the retention features are still to come. See the [roadmap](#roadmap).

## Features in this skeleton

- **Voice or text input.** Vietnamese dictation through the browser's Web Speech API.
- **Interpretation in 6 parts** (title, summary, symbols, link to your life, reflection question, message for today), returned as validated structured JSON.
- **Three quick questions** before interpreting: waking mood, current concern, preferred lens (psychology / folk / both).
- **Dream journal** stored in Cloudflare D1, scoped to an anonymous device id until accounts exist.
- **Safety guards:**
  - First-person crisis language skips the interpretation and shows a support message instead.
  - The model also returns a distress flag that triggers the same support message.
  - Requests for lottery numbers get a friendly refusal. The product never gives lottery numbers.
- **Mock mode.** Without an API key the app returns a placeholder interpretation, so you can develop and test offline.
- **Installable PWA** with an offline app shell. API responses are never cached.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Vite + TypeScript (no framework), PWA |
| Backend | Cloudflare Workers + [Hono](https://hono.dev) |
| Database | Cloudflare D1 (SQLite) |
| AI | Anthropic Messages API via `@anthropic-ai/sdk`, structured outputs + Zod |
| Tests | Vitest |
| CI/CD | GitHub Actions → `wrangler deploy` |

## Project structure

```
.
├── index.html                 # App shell
├── public/                    # PWA manifest, icon, service worker
├── src/
│   ├── client/                # Browser code: UI, API client, dictation
│   ├── shared/                # Zod schemas, types and labels used by both sides
│   └── worker/                # Cloudflare Worker
│       ├── app.ts             # Hono routes (/api/health, /api/dreams)
│       ├── interpreter.ts     # AI interpreter + mock interpreter
│       ├── prompt.ts          # System prompt and user message builder
│       ├── repo.ts            # D1 and in-memory storage
│       └── safety.ts          # Crisis and lottery screens
├── migrations/                # D1 SQL migrations
├── test/                      # Unit and API tests
├── docs/KE-HOACH-SAN-PHAM.md  # Full product plan (Vietnamese)
└── wrangler.jsonc             # Worker, assets and D1 config
```

## Getting started

Requirements: Node.js 22+ (24 recommended, see `.nvmrc`).

```bash
npm install
cp .dev.vars.example .dev.vars    # optional: add ANTHROPIC_API_KEY for real interpretations
npm run db:migrate:local          # create the local D1 tables
npm run dev                       # http://localhost:5173 (PWA + Worker + local D1)
```

Without `ANTHROPIC_API_KEY` the app runs in mock mode. `GET /api/health` shows which mode is active.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the app and the Worker locally with hot reload |
| `npm run typecheck` | Type-check the Worker and the client |
| `npm test` | Run the unit and API tests |
| `npm run build` | Build the client and the Worker into `dist/` |
| `npm run check` | Typecheck + test + build (same as CI) |
| `npm run db:migrate:local` / `db:migrate:remote` | Apply D1 migrations |
| `npm run deploy` | Build and deploy with Wrangler |

### Configuration

| Name | Where | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | Worker secret / `.dev.vars` | Enables live interpretations. Unset means mock mode |
| `AI_MODEL` | `wrangler.jsonc` vars | Model id. Defaults to `claude-opus-5-5`. A cheaper model can be set here once quality is measured |
| `APP_ENV` | `wrangler.jsonc` vars / `.dev.vars` | `production`, `development`, ... |

## API

All `/api/dreams` routes require an `x-device-id` header containing a UUID.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Liveness check and interpreter mode |
| `POST` | `/api/dreams` | Body `{ text, mood?, concern?, lens? }`. Interprets and stores the dream |
| `GET` | `/api/dreams` | Latest 50 dreams for this device |
| `GET` | `/api/dreams/:id` | One dream |

## CI/CD

The workflow in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push and pull request:

1. **check**: `npm ci` → typecheck → tests → build.
2. **deploy** (pushes to `main` only, after `check` passes): applies remote D1 migrations, then builds and deploys the Worker. Without Cloudflare secrets this job skips itself with a notice, so CI stays green.

One-time setup to turn on deploys:

1. Create the database: `npx wrangler d1 create dream`. Put the printed `database_id` into `wrangler.jsonc`.
2. Set the API key on the Worker: `npx wrangler secret put ANTHROPIC_API_KEY`.
3. In GitHub, go to **Settings → Secrets and variables → Actions** and add:
   - Secrets: `CLOUDFLARE_API_TOKEN` (needs *Workers Scripts: Edit* and *D1: Edit*) and `CLOUDFLARE_ACCOUNT_ID`.
   - Optional variable: `APP_URL` (e.g. `https://dream.<subdomain>.workers.dev`). When set, the deploy job runs a smoke test against `/api/health`.

Dependabot opens weekly dependency PRs, which go through the same checks.

## Product principles

- Never provide lottery numbers or gambling hints.
- Never predict death, illness or accidents. Folk readings are framed as gentle reminders, not omens.
- Dreams are sensitive personal data. Do not log dream text, offer export and deletion, and encrypt at rest before launch.
- The app is for reflection and does not replace medical or psychological care.

## Roadmap

1. **Weeks 1–2:** validate demand with the "tell a dream, get an interpretation" page and short videos.
2. **Weeks 3–6:** paid MVP: accounts (Zalo/Google/phone), morning reminders via Zalo OA, streaks, share cards, VietQR/MoMo/ZaloPay payments.
3. **Months 2–3:** dream art, symbol map, recurring-dream detection, monthly letter.
4. **Months 4–6:** nightmare rescripting program, lucid dreaming course, native iOS/Android apps.

The full product plan (in Vietnamese) is in [docs/KE-HOACH-SAN-PHAM.md](docs/KE-HOACH-SAN-PHAM.md).
