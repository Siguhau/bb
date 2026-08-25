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

Create an empty, timestamped migration file with a kebab-case description:

```sh
pnpm db:migration:create add-new-service-types
```

This creates
`backend/prisma/migrations/<timestamp>_add-new-service-types/migration.sql`
and prints `Add new service types`.

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

This runs the frontend and backend Vitest suites. Browser tests run separately
with Playwright:

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

The browser suite starts the frontend and backend automatically, recreates a
dedicated `e2e.db` SQLite database, applies migrations, and provisions a test
administrator. It never uses the development database. To inspect a test
interactively, run `pnpm test:e2e:ui`.

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

## Assumptions

This web application is not meant to be production ready yet, for that some architectural decisions should be made to provide a more stable environment. Examples of this is the choice of backend and db. Both Express and SQLite work for a simple mvp, however, they might face issues running in a container 24/7.
There is no monitoring added.

Customers would not need an account to submit an order
Customers can use either the reference code, email or phone number to fetch orders, there is no need to use two or all three.

Orders are given the next available day as the due date. Not the same day.
We ignore holidays for now.
No phone or email integration is added.
Each order represents one bike.
Admin auth is simplified for this demo
The demo will be done on localhost, however the application is running live on https://bouvetbike.siguhau.no/

## Reflection

Using AI tools to help productivity and decision making has already become the new normal. It is generally easy to make a demo, and it can be very helpful to go deep, find angles and ambiguity.

For me, this project displays exactly that. The creation of the requirement prompt, which was a manual task took some time, and the following session I had with GPT 5.6 Sol made that prompt into something implementable.

I am quite happy with the fact that the three-tier application worked out of the box. I did not do a lot of fighting with the AI after the initial three changes (Requirements, architecture and project setup).

I think however there is a lot of places where I could have fought more. Especially when it comes to keeping the components small with less concerns.

The bulk part of my work has been review, and that has been though. I had longer review sessions which I really do not like. I struggled to find larger issues with the PRs, even though, when I worked on them myself, they screamed at me.

I wish I did a few things more manually, the first would be the project setup. I wanted to save some time running a prompt rather than running the different install scripts. I do however think that if I put more effort into making a structure of what I wanted, the AI would follow it better.

I also am unsure about how well I solved the task. I feel like I did not get to show much of me, but more how I work with AI. I usually dont do so much so fast, and the review was difficult. I should have tried more tools for review. Additionally, I wish the solution looked less vibe coded.

Lastly, I have not update the architecture after I was "done" and there are discrepancies there, like if it should be running in production environment, monitoring and backed up.
