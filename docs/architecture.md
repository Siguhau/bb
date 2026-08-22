# Architecture

## Overview

Bouvet Bike is a modular monolith. It has one responsive React application, one
Express backend, and one SQLite database. The customer and administrator
interfaces are separate route and authorization boundaries, while both use the
same backend business logic and database.

This structure keeps the MVP simple to develop and run locally while preserving
clear boundaries between HTTP handling, business rules, and persistence.

```text
Browser
  `-- React application
      |-- /customer
      `-- /admin
              |
              v
          Express API
          |-- Orders
          |-- Scheduling and capacity
          |-- Customer access
          `-- Admin authentication
              |
              v
          Prisma ORM
              |
              v
            SQLite
```

## Technology stack

### Frontend

- React
- TypeScript
- Vite
- A client-side router for the Customer and Admin interfaces

### Backend

- Node.js
- TypeScript
- Express
- Prisma ORM
- SQLite

The application is kept in one pnpm workspace. The frontend and backend are
separate source areas, but they are deployed together.

## Application boundaries

### Customer interface

The customer interface is available below `/customer`. It supports submitting an
order, looking up matching orders, viewing order details, and updating notes while
an order is `New`.

Customers do not have accounts. A successful lookup should create a short-lived
grant scoped to the matching orders. That grant is required when a customer
updates notes. Lookup attempts are rate-limited and unsuccessful attempts use a
generic response.

### Admin interface

The admin interface is available below `/admin`. Administrators must sign in
before they can view or change order data. Authentication and authorization are
enforced by the backend; protecting only the React routes is not sufficient.

### Backend

Express exposes the HTTP API and handles request validation, authentication, and
response formatting. Business rules are implemented in backend services rather
than directly in route handlers.

The backend is divided into these modules:

- **Orders:** order creation, references, statuses, services, notes, and deletion.
- **Scheduling:** due-date assignment, weekday capacity, moving, cancellation,
  and reopening.
- **Customer access:** exact-match lookup, lookup grants, and rate limiting.
- **Admin identity:** administrator accounts, passwords, and sessions.
- **Infrastructure:** Prisma access, configuration, logging, and error handling.

Statuses, service types, daily capacity, and editable-field rules have one
authoritative definition in the backend.

## API boundaries

The initial API is divided into customer and admin routes.

### Customer routes

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/customer/orders` | Submit an order |
| `POST` | `/api/customer/order-lookups` | Look up orders by one exact value |
| `PATCH` | `/api/customer/orders/:id/notes` | Update notes on a `New` order after lookup |

Lookup uses `POST` so email addresses and phone numbers do not appear in URLs or
normal access logs.

### Admin routes

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/admin/session` | Sign in |
| `DELETE` | `/api/admin/session` | Sign out |
| `GET` | `/api/admin/orders` | List, search, and filter orders |
| `GET` | `/api/admin/orders/:id` | View one order |
| `PATCH` | `/api/admin/orders/:id` | Update allowed order fields |
| `DELETE` | `/api/admin/orders/:id` | Permanently delete a cancelled order |
| `GET` | `/api/admin/capacity` | View used capacity by weekday |

The admin order list accepts optional `search`, `status`, `serviceType`, and
`dueDate` query parameters. `dueDate` is an exact `YYYY-MM-DD` calendar date.
Results are ordered by due date ascending, creation time descending, and ID
ascending so pagination-free reads remain deterministic.

The capacity endpoint requires `from` and `to` query parameters as
`YYYY-MM-DD` calendar dates. The range is inclusive and limited to 366 calendar
days. Its response contains every weekday in the range, including days with
zero use, and omits Saturdays and Sundays. Each day contains numeric `used` and
`capacity` values plus the admin-facing display value such as `"3 of 5"`.

The admin update route accepts only notes, service types, expected due date, and
status. It rejects changes to customer name, phone number, email address, and bike
brand. Internally, updates use explicit operations such as `moveOrder`,
`changeStatus`, and `reopenOrder` so scheduling rules cannot be bypassed.

The delete route verifies that the order is `Cancelled`. The frontend asks the
administrator for confirmation before sending the request, but the backend still
enforces the deletion rule.

## Backend structure

```text
backend/src/
|-- routes/          HTTP handling and authorization
|-- services/        Use cases and transaction boundaries
|-- domain/          Statuses, services, and capacity rules
|-- repositories/    Prisma database access
`-- middleware/      Validation, sessions, and rate limiting
```

Route handlers delegate to use cases such as `submitOrder`, `lookupOrders`,
`updateCustomerNotes`, `moveOrder`, `cancelOrder`, and `reopenOrder`.

## Persistence and concurrency

SQLite is the source of truth and its database file is stored on persistent disk.
Prisma owns the schema and migrations. SQLite should use write-ahead logging and a
busy timeout to handle concurrent local requests predictably.

Each non-cancelled order owns one of five numbered capacity reservations for its
due date. A unique database constraint on the due date and slot number prevents
more than five reservations for a weekday, including when requests run
concurrently.

The following operations run in a single database transaction:

- Creating an order and reserving its earliest available weekday.
- Moving an order between dates.
- Cancelling an order and releasing its capacity reservation.
- Reopening a cancelled order and reserving capacity again.

If any part fails, the entire operation is rolled back. Weekends are rejected and
all date calculations use the configured shop timezone. Timestamps are stored in
UTC, while an expected due date is stored as a calendar date.

SQLite is suitable while the system has one backend instance and modest write
traffic. Moving to multiple backend instances or heavier concurrent writes would
require reassessing the database; PostgreSQL is the expected migration path.

## Deployment

### Local development

- Vite runs the React development server.
- Express runs the backend API.
- Vite proxies `/api` requests to Express.
- SQLite runs as a local database file.

### Production

Vite builds the React application into static files. Express serves those files
and the API from one Node.js process on one server. The SQLite file is kept on
persistent storage and backed up at least daily with a documented retention
period. Production traffic uses HTTPS.

Configuration such as secrets, shop timezone, lookup attempt limit, and temporary
block duration is supplied through environment variables. Application logs avoid
customer contact information and other unnecessary personal data.

## Testing strategy

- Domain tests cover references, statuses, editable fields, weekdays, and
  capacity rules.
- API integration tests cover validation, customer access, admin authorization,
  and persistence failures.
- Concurrency tests verify the five-order boundary for creation, moving, and
  reopening.
- Browser tests cover the core Customer and Admin workflows at desktop and mobile
  widths.
