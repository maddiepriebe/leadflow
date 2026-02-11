# LeadFlow

LeadFlow is a monorepo MVP for B2B lead discovery, enrichment, messaging sequences, inbox management, and analytics.

## Stack
- Frontend: React + Vite + TypeScript + Tailwind
- API: Express + TypeScript + Prisma
- Async jobs: BullMQ workers + Redis
- Database: PostgreSQL

## Monorepo Layout
- `apps/web`: React app
- `apps/api`: API server, Prisma schema/migrations, workers
- `packages/types`: shared types
- `packages/ui`: shared UI components

## Quick Start
1. Install dependencies.
```bash
npm install
```

2. Start the full dev stack from root.
```bash
npm run dev
```

What `npm run dev` does:
- Attempts to start local `postgres` + `redis` via `docker compose` (non-blocking if Docker is unavailable)
- Starts web (`http://localhost:3000`)
- Starts API (`http://localhost:5050`)
- Starts workers

3. Initialize database schema (first run only).
```bash
npm run prisma:migrate --workspace @leadflow/api
npm run prisma:seed --workspace @leadflow/api
```

## Environment
- API loads `apps/api/.env` if present.
- If `.env` is missing, local dev fallback is used for `DATABASE_URL`:
  - `postgresql://postgres:postgres@localhost:5433/leadgen`
- Reference template: `apps/api/.env.example`.

## Local Services
- Optional explicit service startup:
```bash
npm run dev:services
```

- Stop compose services:
```bash
npm run dev:services:down
```

## Troubleshooting
- Redis not running:
  - Symptoms: worker connection errors to `localhost:6379`
  - Fix: run `npm run dev:services` or start Redis locally

- Postgres not running / DB auth errors:
  - Symptoms: Prisma errors involving `DATABASE_URL`
  - Fix: run `npm run dev:services` or set a valid `DATABASE_URL` in `apps/api/.env`

- Port conflicts:
  - Web default: `3000`
  - API default: `5050`
  - Postgres compose host port: `5433`
  - Redis compose host port: `6379`

- Docker unavailable:
  - `npm run dev` still starts app processes, but DB/Redis must exist separately

- Missing generated Prisma client after dependency changes:
```bash
npm run prisma:generate --workspace @leadflow/api
```
