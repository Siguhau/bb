# Bouvet Bike

Bouvet Bike is a responsive web portal for submitting and managing bicycle
maintenance orders.

## Project structure

```text
.
|-- frontend/    React, TypeScript, and Vite application
|-- backend/     Express, TypeScript, and Prisma configuration
|-- docs/        Requirements and architecture decisions
|-- package.json Shared pnpm scripts
`-- pnpm-workspace.yaml
```

The customer interface is available at `/customer` and the administrator
interface at `/admin`. Both use the same Express API and SQLite database.

## Prerequisites

- Node.js 22.12 or newer
- pnpm 11 or newer

## Setup

```sh
pnpm install
cp backend/.env.example backend/.env
pnpm db:generate
pnpm db:migrate
```

Create the initial administrator after setting `ADMIN_BOOTSTRAP_EMAIL` and
`ADMIN_BOOTSTRAP_PASSWORD` in `backend/.env`:

```sh
pnpm --filter bouvet-bike-backend admin:provision
```

Provisioning is create-only: running it again for the same normalized email does
not reset the password. Remove `ADMIN_BOOTSTRAP_PASSWORD` from the environment
afterward. Administrator sessions expire after `ADMIN_SESSION_TTL_SECONDS`
(eight hours by default). Their cookies are `HttpOnly`, `SameSite=Strict`, scoped
to `/api/admin`, and automatically marked `Secure` when `NODE_ENV=production`.
Production must serve the application over HTTPS.
Repeated failed sign-in attempts are temporarily blocked per client according to
`ADMIN_LOGIN_ATTEMPT_LIMIT` and `ADMIN_LOGIN_BLOCK_DURATION_SECONDS`.

## Local development

```sh
pnpm dev
```

The frontend runs at `http://localhost:5173` and proxies API requests to the
backend at `http://localhost:3000`.

## Running tests

After completing the setup steps, run all workspace test suites from the
project root:

```sh
pnpm test
```

This currently runs the backend Vitest suite.

## Production-style run

```sh
pnpm build
pnpm start
```

Express serves the built frontend and API at `http://localhost:3000`.

## Checks

```sh
pnpm typecheck
pnpm build
```

See [the requirements](docs/requirements.md) and
[the architecture](docs/architecture.md) for the agreed behavior and design.
