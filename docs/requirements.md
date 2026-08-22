# Requirements

## Purpose

Bouvet Bike is a web-based portal for a bicycle repair shop to receive, track, and manage bicycle maintenance orders.

## Goals

- Give customers a simple way to submit and track maintenance orders.
- Give administrators a simple way to manage orders, due dates, and daily workload.
- Keep the solution focused on two interfaces: Customer and Admin.

## MVP scope and assumptions

- Customers do not need accounts.
- Administrators use individual accounts with an email address and password and must sign in before accessing admin functionality.
- Customers may look up orders using a reference, email address, or phone number as a single lookup value. Allowing email or phone lookup without additional verification is an accepted MVP privacy tradeoff.
- A successful lookup also permits the customer to update notes on any matching order whose status is `New`. This write access is part of the accepted MVP privacy tradeoff.
- Prices, payments, inventory, appointment booking, notifications, photo uploads, technician assignment, and automatic rescheduling are outside the MVP.
- Current major desktop and mobile browsers are supported.

## Order data

Each order contains:

- A unique, non-sequential reference containing exactly eight randomly generated characters. Each character must be an uppercase English letter (`A-Z`) or digit (`0-9`). If a generated reference already exists, the system must generate another before saving the order.
- Customer name.
- Phone number.
- Email address.
- Bike brand.
- One or more service types:
  - Wheel adjustment.
  - Chain replacement.
  - Brake maintenance.
- Expected due date, assigned by the system and adjustable by an administrator.
- Notes, which are optional.
- Current status.
- Creation and last-updated timestamps.

Customer name, phone number, email address, bike brand, and at least one service type are required. Notes are optional. The expected due date and status are assigned by the system rather than entered by the customer.

## Functional requirements

### Customer interface

A customer can:

- Submit a maintenance order.
- Receive the order reference after a successful submission.
- Look up orders using exactly one of the following:
  - Reference.
  - Email address.
  - Phone number.
- View each matching order separately when an email address or phone number matches multiple orders.
- View the submitted order data, expected due date, and current status.
- Add or update notes only while the order status is `New`.
- Continue to view completed and cancelled orders.

Customers cannot change contact information, bike brand, service types, due date, or status after submission.

### Admin interface

An authenticated administrator can:

- View all orders.
- View an individual order.
- Search orders by reference, customer name, email address, phone number, or bike brand.
- Filter orders by status, service type, or due date.
- Change an order's notes and service types.
- Change an order's expected due date, provided the destination date has available capacity.
- Change an order's status.
- Reopen an order by changing it from `Completed` or `Cancelled` to another status.
- View weekday capacity in the form "used of 5," such as "3 of 5."
- Permanently delete a cancelled order after confirming the action.

Administrators cannot permanently delete an order unless its current status is `Cancelled`.

### Order statuses

Every new order begins with the status `New`. Only administrators can change an order's status.

The supported statuses are:

- `New`: The order has been submitted and work has not started.
- `In Progress`: Repair work has started.
- `Waiting for customer pickup`: Repair work is finished and the bicycle is waiting to be collected.
- `Completed`: The bicycle has been collected and the order is complete.
- `Cancelled`: The order is no longer scheduled for work.

Orders may be reopened by changing their status. Reopening a cancelled order must not cause its due date to exceed the daily capacity limit.

### Scheduling and capacity

- Each weekday has a hard capacity limit of five non-cancelled orders.
- Weekends are unavailable and have no capacity.
- On submission, the system assigns the earliest weekday with available capacity, starting from the next calendar day.
- If the next calendar day is a weekend or is already at capacity, the system continues to the next available weekday.
- All orders consume one capacity slot regardless of the number or type of services selected.
- Cancelling an order immediately releases its capacity slot.
- A newly available slot does not cause existing orders to be rescheduled automatically.
- Administrators may move an order to another weekday only when that date has available capacity.
- The capacity limit must also be enforced when an administrator reopens a cancelled order.
- Capacity checks and due-date assignment or changes must be performed as one concurrency-safe operation so simultaneous requests cannot exceed the limit.
- Date calculations use the shop's configured local timezone.

## Non-functional requirements

### Reliability

- Orders and updates must be stored in a persistent database.
- The system must confirm a submission or update only after it has been stored successfully.
- An unsuccessful operation must not leave a partial order or report success.
- Successfully stored orders must remain available after an application restart or period of application downtime.
- The production database must be backed up at least daily.
- Permanently deleting an order removes it from the live database immediately. Backup copies expire according to a documented backup-retention policy.

### Privacy and security

- Customer lookup must use exact matching.
- Lookup attempts must be rate-limited to reduce automated guessing.
- Repeated unsuccessful attempts from the same client must result in a temporary lookup block. The limit and block duration must be configurable.
- An unsuccessful lookup must use a generic error message that does not expose additional customer data.
- A lookup must return only orders matching the supplied reference, email address, or phone number.
- Admin functionality and access to the complete set of customer and order data must be unavailable without administrator authentication.
- Production traffic must use HTTPS.
- Sensitive customer data must not be included unnecessarily in application logs or error messages.

### Validation and error handling

- All input must be validated on the server, with client-side validation used to provide faster feedback where appropriate.
- Required fields and email and phone formats must be validated.
- At least one supported service type must be selected.
- Validation and system errors must use clear, meaningful language.
- Recoverable validation errors should preserve the information already entered by the user.

### Maintainability

- Customer and admin functionality must have clearly separated access rules.
- Business rules such as statuses, service types, and daily capacity must be defined in one clear location in the application.
- Setup, configuration, and database changes must be documented.

### Responsive use

- The Customer and Admin interfaces must be usable on current major desktop and mobile browsers.
- Core workflows must work at a viewport width of 320 pixels without horizontal page scrolling.

### Automated tests

Automated tests must cover at least:

- Successful and unsuccessful order submission.
- Eight-character uppercase alphanumeric reference generation, uniqueness, and collision handling.
- Lookup by reference, email address, and phone number.
- Multiple orders returned as separate results for matching contact information.
- Generic lookup failures and temporary blocking after repeated unsuccessful attempts.
- Customer note updates while `New` and rejection in every other status.
- Continued customer access to completed and cancelled orders.
- Admin authentication and access restrictions.
- Rejection of admin changes to customer name, phone number, email address, or bike brand.
- Admin search and filtering.
- Status changes, cancellation, reopening, and confirmed permanent deletion.
- Automatic due-date assignment, weekend skipping, rejection of weekend dates, and the five-order daily limit.
- Concurrent submissions and date changes at the capacity boundary.
- Capacity release on cancellation without automatic rescheduling.
- Server-side validation and persistence failures.

## Acceptance criteria

- A valid submission stores exactly one order, assigns it the status `New`, assigns the earliest available weekday starting from the next day, and returns a unique reference matching `[A-Z0-9]{8}`.
- No weekday can contain more than five non-cancelled orders.
- A reference lookup returns only the matching order.
- An email or phone lookup returns every exactly matching order as a separate result.
- A customer can change notes while an order is `New` and receives an error when attempting the same change in any other status.
- Only an authenticated administrator can search all orders, change service types or due dates, change status, or delete orders.
- An administrator cannot move or reopen an order onto a weekday that already contains five non-cancelled orders.
- Only a cancelled order can be permanently deleted, and deletion requires confirmation.
- A permanently deleted order is no longer retrievable from the live system by customers or administrators.
- A failed database operation is reported as a failure and does not create or partially update an order.

## Priorities - Tasks

1. Create the orders model
2. Create the basic theme
3. Create the customer landing page where they can either search for their order or place a new order
4. Create the view where customers can create an order
