import { randomInt } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";

import {
  CAPACITY_SLOT_NUMBERS,
  SERVICE_TYPES,
  isServiceTypeCode,
  type ServiceTypeCode,
} from "../domain/order.js";
import { parseOptionalNotes } from "../domain/notes.js";
import { prisma } from "../infrastructure/prisma.js";

const REFERENCE_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const MAX_TRANSACTION_ATTEMPTS = 10;
const MAX_SCHEDULING_DAYS = 3_660;

export type OrderSubmission = {
  customerName: string;
  phoneNumber: string;
  emailAddress: string;
  bikeBrand: string;
  serviceTypes: ServiceTypeCode[];
  notes: string | null;
};

export type SubmittedOrder = Omit<OrderSubmission, "serviceTypes"> & {
  id: string;
  reference: string;
  expectedDueDate: string;
  status: "NEW";
  serviceTypes: Array<{ code: ServiceTypeCode; displayName: string }>;
};

export class OrderSubmissionValidationError extends Error {
  constructor(public readonly fields: Record<string, string>) {
    super("Check the highlighted fields and try again.");
  }
}

type SubmissionClient = Pick<PrismaClient, "$transaction">;

type SubmitOrderOptions = {
  client?: SubmissionClient;
  generateReference?: () => string;
  now?: () => Date;
  shopTimeZone?: string;
};

function requiredString(
  input: Record<string, unknown>,
  field: string,
  label: string,
  maxLength: number,
  errors: Record<string, string>,
): string {
  const value = input[field];

  if (typeof value !== "string" || value.trim().length === 0) {
    errors[field] = `${label} is required.`;
    return "";
  }

  const trimmedValue = value.trim();
  if (trimmedValue.length > maxLength) {
    errors[field] = `${label} must be ${maxLength} characters or fewer.`;
  }

  return trimmedValue;
}

export function parseOrderSubmission(value: unknown): OrderSubmission {
  const input =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const errors: Record<string, string> = {};
  const allowedFields = new Set([
    "customerName",
    "phoneNumber",
    "emailAddress",
    "bikeBrand",
    "serviceTypes",
    "notes",
  ]);

  if (Object.keys(input).some((field) => !allowedFields.has(field))) {
    errors.form = "The order contains fields that cannot be submitted.";
  }

  const customerName = requiredString(
    input,
    "customerName",
    "Customer name",
    120,
    errors,
  );
  const phoneNumber = requiredString(
    input,
    "phoneNumber",
    "Phone number",
    30,
    errors,
  );
  const emailAddress = requiredString(
    input,
    "emailAddress",
    "Email address",
    254,
    errors,
  );
  const bikeBrand = requiredString(
    input,
    "bikeBrand",
    "Bike brand",
    120,
    errors,
  );

  if (emailAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) {
    errors.emailAddress = "Enter a valid email address.";
  }

  const phoneDigits = phoneNumber.replace(/\D/g, "");
  if (
    phoneNumber &&
    (!/^\+?[\d ()-]+$/.test(phoneNumber) || phoneDigits.length < 7)
  ) {
    errors.phoneNumber = "Enter a valid phone number.";
  }

  const rawServiceTypes = input.serviceTypes;
  let serviceTypes: ServiceTypeCode[] = [];

  if (!Array.isArray(rawServiceTypes) || rawServiceTypes.length === 0) {
    errors.serviceTypes = "Select at least one service.";
  } else if (
    rawServiceTypes.some(
      (serviceType) =>
        typeof serviceType !== "string" || !isServiceTypeCode(serviceType),
    ) ||
    new Set(rawServiceTypes).size !== rawServiceTypes.length
  ) {
    errors.serviceTypes = "Select only supported services once.";
  } else {
    serviceTypes = rawServiceTypes as ServiceTypeCode[];
  }

  const notes = parseOptionalNotes(input.notes, errors);

  if (Object.keys(errors).length > 0) {
    throw new OrderSubmissionValidationError(errors);
  }

  return {
    customerName,
    phoneNumber,
    emailAddress,
    bikeBrand,
    serviceTypes,
    notes,
  };
}

export function generateOrderReference(): string {
  return Array.from(
    { length: 8 },
    () => REFERENCE_CHARACTERS[randomInt(REFERENCE_CHARACTERS.length)],
  ).join("");
}

export function shopLocalCalendarDate(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value;

  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function assertValidShopTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format();
  } catch {
    throw new Error(`SHOP_TIME_ZONE is not a valid IANA timezone: ${timeZone}`);
  }
}

export function addCalendarDays(calendarDate: string, days: number): string {
  const date = new Date(`${calendarDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isWeekend(calendarDate: string): boolean {
  const weekday = new Date(`${calendarDate}T00:00:00Z`).getUTCDay();
  return weekday === 0 || weekday === 6;
}

async function findEarliestReservation(
  transaction: Prisma.TransactionClient,
  firstDate: string,
): Promise<{ dueDate: string; slot: number }> {
  let dueDate = firstDate;

  for (let day = 0; day < MAX_SCHEDULING_DAYS; day += 1) {
    if (!isWeekend(dueDate)) {
      const reservations = await transaction.capacityReservation.findMany({
        where: { dueDate },
        select: { slot: true },
      });
      const usedSlots = new Set(reservations.map(({ slot }) => slot));
      const slot = CAPACITY_SLOT_NUMBERS.find(
        (candidate) => !usedSlots.has(candidate),
      );

      if (slot !== undefined) return { dueDate, slot };
    }

    dueDate = addCalendarDays(dueDate, 1);
  }

  throw new Error("No available scheduling date was found.");
}

function isRetryableTransactionError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    ["P1008", "P2002", "P2024", "P2028", "P2034"].includes(error.code)
  );
}

export async function submitOrder(
  value: unknown,
  {
    client = prisma,
    generateReference = generateOrderReference,
    now = () => new Date(),
    shopTimeZone = process.env.SHOP_TIME_ZONE ?? "Europe/Oslo",
  }: SubmitOrderOptions = {},
): Promise<SubmittedOrder> {
  const input = parseOrderSubmission(value);
  const firstDate = addCalendarDays(
    shopLocalCalendarDate(now(), shopTimeZone),
    1,
  );

  for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    const reference = generateReference();

    try {
      const createdOrder = await client.$transaction(
        async (transaction) => {
          const { dueDate, slot } = await findEarliestReservation(
            transaction,
            firstDate,
          );

          return transaction.order.create({
            data: {
              reference,
              customerName: input.customerName,
              phoneNumber: input.phoneNumber,
              emailAddress: input.emailAddress,
              bikeBrand: input.bikeBrand,
              expectedDueDate: dueDate,
              status: "NEW",
              notes: input.notes,
              serviceTypes: {
                create: input.serviceTypes.map((serviceTypeCode) => ({
                  serviceType: { connect: { code: serviceTypeCode } },
                })),
              },
              capacityReservation: { create: { slot } },
            },
            select: { id: true, expectedDueDate: true },
          });
        },
        { maxWait: 5_000, timeout: 10_000 },
      );

      return {
        ...input,
        id: createdOrder.id,
        reference,
        expectedDueDate: createdOrder.expectedDueDate,
        status: "NEW",
        serviceTypes: input.serviceTypes.map((code) => {
          const serviceType = SERVICE_TYPES.find(
            (candidate) => candidate.code === code,
          )!;
          return {
            code: serviceType.code,
            displayName: serviceType.displayName,
          };
        }),
      };
    } catch (error) {
      if (
        !isRetryableTransactionError(error) ||
        attempt === MAX_TRANSACTION_ATTEMPTS - 1
      ) {
        throw error;
      }
    }
  }

  throw new Error("Order submission attempts were exhausted.");
}
