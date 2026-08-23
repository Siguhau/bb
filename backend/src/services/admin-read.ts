import {
  DAILY_CAPACITY,
  isOrderStatus,
  isServiceTypeCode,
} from "../domain/order.js";
import {
  prismaAdminOrderRepository,
  type AdminOrderRepository,
  type CompleteOrder,
} from "../repositories/admin-order-repository.js";
import { addCalendarDays } from "./submit-order.js";

const ORDER_QUERY_FIELDS = new Set([
  "search",
  "status",
  "serviceType",
  "dueDate",
]);
const CAPACITY_QUERY_FIELDS = new Set(["from", "to"]);
const MAX_SEARCH_LENGTH = 254;
const MAX_CAPACITY_RANGE_DAYS = 366;
const MILLISECONDS_PER_DAY = 86_400_000;

export class AdminReadValidationError extends Error {
  constructor(public readonly fields: Record<string, string>) {
    super("Check the query parameters and try again.");
  }
}

type Query = Record<string, unknown>;

function queryObject(value: unknown): Query {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Query)
    : {};
}

function singleQueryValue(
  query: Query,
  field: string,
  errors: Record<string, string>,
): string | undefined {
  const value = query[field];
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    errors[field] = `${field} must be provided once.`;
    return undefined;
  }
  return value.trim();
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function rejectUnknownFields(
  query: Query,
  allowedFields: Set<string>,
  errors: Record<string, string>,
): void {
  if (Object.keys(query).some((field) => !allowedFields.has(field))) {
    errors.query = "The query contains unsupported parameters.";
  }
}

export function parseAdminOrderQuery(value: unknown) {
  const query = queryObject(value);
  const errors: Record<string, string> = {};
  rejectUnknownFields(query, ORDER_QUERY_FIELDS, errors);

  const search = singleQueryValue(query, "search", errors);
  const status = singleQueryValue(query, "status", errors);
  const serviceType = singleQueryValue(query, "serviceType", errors);
  const dueDate = singleQueryValue(query, "dueDate", errors);

  if (search !== undefined && search.length === 0) {
    errors.search = "Search must not be empty.";
  } else if (search && search.length > MAX_SEARCH_LENGTH) {
    errors.search = `Search must be ${MAX_SEARCH_LENGTH} characters or fewer.`;
  }
  if (status !== undefined && !isOrderStatus(status)) {
    errors.status = "Select a supported order status.";
  }
  if (serviceType !== undefined && !isServiceTypeCode(serviceType)) {
    errors.serviceType = "Select a supported service type.";
  }
  if (dueDate !== undefined && !isCalendarDate(dueDate)) {
    errors.dueDate = "Due date must be a valid date in YYYY-MM-DD format.";
  }

  if (Object.keys(errors).length > 0) {
    throw new AdminReadValidationError(errors);
  }

  return { search, status, serviceType, dueDate };
}

export type CapacityDay = {
  date: string;
  used: number;
  capacity: number;
  display: string;
};

export function parseCapacityQuery(value: unknown): {
  from: string;
  to: string;
} {
  const query = queryObject(value);
  const errors: Record<string, string> = {};
  rejectUnknownFields(query, CAPACITY_QUERY_FIELDS, errors);
  const from = singleQueryValue(query, "from", errors);
  const to = singleQueryValue(query, "to", errors);

  if (!from || !isCalendarDate(from)) {
    errors.from = "From must be a valid date in YYYY-MM-DD format.";
  }
  if (!to || !isCalendarDate(to)) {
    errors.to = "To must be a valid date in YYYY-MM-DD format.";
  }
  if (from && to && isCalendarDate(from) && isCalendarDate(to)) {
    if (from > to) {
      errors.to = "To must be on or after from.";
    } else if (
      (new Date(`${to}T00:00:00Z`).getTime() -
        new Date(`${from}T00:00:00Z`).getTime()) /
        MILLISECONDS_PER_DAY >=
      MAX_CAPACITY_RANGE_DAYS
    ) {
      errors.to = `Capacity ranges cannot exceed ${MAX_CAPACITY_RANGE_DAYS} days.`;
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new AdminReadValidationError(errors);
  }
  return { from: from!, to: to! };
}

function isWeekday(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day !== 0 && day !== 6;
}

export function createAdminReadService(
  repository: AdminOrderRepository = prismaAdminOrderRepository,
) {
  return {
    async listOrders(query: unknown): Promise<CompleteOrder[]> {
      return repository.listOrders(parseAdminOrderQuery(query));
    },

    async getOrder(id: string): Promise<CompleteOrder | null> {
      return repository.findOrder(id);
    },

    async getCapacity(query: unknown): Promise<CapacityDay[]> {
      const { from, to } = parseCapacityQuery(query);
      const usage = new Map(
        (await repository.listCapacityUsage(from, to)).map(
          ({ dueDate, used }) => [dueDate, used],
        ),
      );
      const days: CapacityDay[] = [];

      for (let date = from; ; date = addCalendarDays(date, 1)) {
        if (isWeekday(date)) {
          const used = usage.get(date) ?? 0;
          days.push({
            date,
            used,
            capacity: DAILY_CAPACITY,
            display: `${used} of ${DAILY_CAPACITY}`,
          });
        }
        if (date === to) break;
      }
      return days;
    },
  };
}

export const adminReadService = createAdminReadService();
