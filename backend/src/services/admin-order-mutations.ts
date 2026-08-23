import {
  CAPACITY_SLOT_NUMBERS,
  isOrderStatus,
  isServiceTypeCode,
  type OrderStatus,
  type ServiceTypeCode,
} from "../domain/order.js";
import {
  PrismaAdminOrderMutationRepository,
  isRetryableAdminOrderMutationError,
  type AdminOrderMutationData,
  type AdminOrderMutationRepository,
  type AdminOrderMutationResult,
  type AdminOrderMutationTransaction,
} from "../repositories/admin-order-mutation-repository.js";

const MAX_MUTATION_ATTEMPTS = 10;
const ALLOWED_PATCH_FIELDS = new Set([
  "notes",
  "serviceTypes",
  "expectedDueDate",
  "status",
]);

export class AdminOrderMutationValidationError extends Error {
  constructor(public readonly fields: Record<string, string>) {
    super("Check the highlighted fields and try again.");
  }
}

export class AdminOrderNotFoundError extends Error {
  constructor() {
    super("The order was not found.");
  }
}

export class AdminOrderCapacityUnavailableError extends Error {
  constructor(public readonly dueDate: string) {
    super(`No capacity is available on ${dueDate}.`);
  }
}

export class AdminOrderDeletionNotAllowedError extends Error {
  constructor() {
    super("Only cancelled orders can be permanently deleted.");
  }
}

export type AdminOrderPatch = AdminOrderMutationData;

function isRealCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function isWeekend(value: string): boolean {
  const weekday = new Date(`${value}T00:00:00Z`).getUTCDay();
  return weekday === 0 || weekday === 6;
}

export function parseAdminOrderPatch(value: unknown): AdminOrderPatch {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AdminOrderMutationValidationError({
      form: "Provide the order fields to update.",
    });
  }

  const input = value as Record<string, unknown>;
  const fields = Object.keys(input);
  const errors: Record<string, string> = {};
  const patch: AdminOrderPatch = {};

  if (fields.length === 0) {
    errors.form = "Provide at least one order field to update.";
  } else if (fields.some((field) => !ALLOWED_PATCH_FIELDS.has(field))) {
    errors.form =
      "Only notes, service types, expected due date, and status can be changed.";
  }

  if ("notes" in input) {
    if (input.notes !== null && typeof input.notes !== "string") {
      errors.notes = "Notes must be text or null.";
    } else if (
      typeof input.notes === "string" &&
      input.notes.trim().length > 2_000
    ) {
      errors.notes = "Notes must be 2000 characters or fewer.";
    } else {
      patch.notes =
        typeof input.notes === "string" ? input.notes.trim() || null : null;
    }
  }

  if ("serviceTypes" in input) {
    if (
      !Array.isArray(input.serviceTypes) ||
      input.serviceTypes.length === 0 ||
      input.serviceTypes.some(
        (serviceType) =>
          typeof serviceType !== "string" || !isServiceTypeCode(serviceType),
      ) ||
      new Set(input.serviceTypes).size !== input.serviceTypes.length
    ) {
      errors.serviceTypes =
        "Select at least one supported service, without duplicates.";
    } else {
      patch.serviceTypes = input.serviceTypes as ServiceTypeCode[];
    }
  }

  if ("expectedDueDate" in input) {
    if (
      typeof input.expectedDueDate !== "string" ||
      !isRealCalendarDate(input.expectedDueDate)
    ) {
      errors.expectedDueDate = "Enter a valid due date in YYYY-MM-DD format.";
    } else if (isWeekend(input.expectedDueDate)) {
      errors.expectedDueDate = "Choose a weekday due date.";
    } else {
      patch.expectedDueDate = input.expectedDueDate;
    }
  }

  if ("status" in input) {
    if (typeof input.status !== "string" || !isOrderStatus(input.status)) {
      errors.status = "Select a supported order status.";
    } else {
      patch.status = input.status;
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new AdminOrderMutationValidationError(errors);
  }

  return patch;
}

async function mutateOrder(
  transaction: AdminOrderMutationTransaction,
  orderId: string,
  patch: AdminOrderPatch,
): Promise<AdminOrderMutationResult> {
  const current = await transaction.findOrder(orderId);
  if (!current) throw new AdminOrderNotFoundError();

  const finalStatus: OrderStatus = patch.status ?? current.status;
  const finalDueDate = patch.expectedDueDate ?? current.expectedDueDate;
  const finalNeedsReservation = finalStatus !== "CANCELLED";
  const reservationAlreadyMatches =
    current.capacityReservation?.dueDate === finalDueDate;

  if (!finalNeedsReservation) {
    if (current.capacityReservation) {
      await transaction.deleteReservation(orderId);
    }
    return transaction.updateOrder(orderId, patch);
  }

  if (reservationAlreadyMatches) {
    return transaction.updateOrder(orderId, patch);
  }

  if (current.capacityReservation) {
    await transaction.deleteReservation(orderId);
  }

  const usedSlots = new Set(await transaction.findReservedSlots(finalDueDate));
  const slot = CAPACITY_SLOT_NUMBERS.find(
    (candidate) => !usedSlots.has(candidate),
  );
  if (slot === undefined) {
    throw new AdminOrderCapacityUnavailableError(finalDueDate);
  }

  const order = await transaction.updateOrder(orderId, patch);
  await transaction.createReservation(orderId, finalDueDate, slot);
  return order;
}

/**
 * Applies every requested admin change atomically and restores the invariant
 * that a reservation exists exactly when the resulting status is not CANCELLED.
 *
 * A cancelled order may store a different weekday due date without reserving
 * capacity. Capacity is intentionally checked only when that order is reopened.
 */
export async function updateAdminOrder(
  orderId: string,
  value: unknown,
  repository: AdminOrderMutationRepository = new PrismaAdminOrderMutationRepository(),
): Promise<AdminOrderMutationResult> {
  const patch = parseAdminOrderPatch(value);

  for (let attempt = 0; attempt < MAX_MUTATION_ATTEMPTS; attempt += 1) {
    try {
      return await repository.transaction((transaction) =>
        mutateOrder(transaction, orderId, patch),
      );
    } catch (error) {
      if (
        !isRetryableAdminOrderMutationError(error) ||
        attempt === MAX_MUTATION_ATTEMPTS - 1
      ) {
        throw error;
      }
    }
  }

  throw new Error("Admin order mutation attempts were exhausted.");
}

export async function deleteCancelledAdminOrder(
  orderId: string,
  repository: AdminOrderMutationRepository = new PrismaAdminOrderMutationRepository(),
): Promise<void> {
  for (let attempt = 0; attempt < MAX_MUTATION_ATTEMPTS; attempt += 1) {
    try {
      await repository.transaction(async (transaction) => {
        const order = await transaction.findOrder(orderId);
        if (!order) throw new AdminOrderNotFoundError();
        if (order.status !== "CANCELLED") {
          throw new AdminOrderDeletionNotAllowedError();
        }
        await transaction.deleteOrder(orderId);
      });
      return;
    } catch (error) {
      if (
        !isRetryableAdminOrderMutationError(error) ||
        attempt === MAX_MUTATION_ATTEMPTS - 1
      ) {
        throw error;
      }
    }
  }
}
