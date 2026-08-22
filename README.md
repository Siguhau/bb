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
```

## Local development

```sh
pnpm dev
```

The frontend runs at `http://localhost:5173` and proxies API requests to the
backend at `http://localhost:3000`.

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
