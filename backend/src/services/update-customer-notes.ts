import type { PrismaClient } from "@prisma/client";

import { parseOptionalNotes } from "../domain/notes.js";
import { prisma } from "../infrastructure/prisma.js";
import {
  customerOrderSelection,
  toCustomerOrder,
  type CustomerOrder,
} from "./lookup-orders.js";

export class CustomerNotesValidationError extends Error {
  constructor(public readonly fields: Record<string, string>) {
    super("Check the highlighted fields and try again.");
  }
}

export class CustomerOrderNotFoundError extends Error {}
export class CustomerOrderNotEditableError extends Error {}

type CustomerNotesClient = Pick<PrismaClient, "$transaction">;

function parseCustomerNotesUpdate(value: unknown): string | null {
  const input =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const errors: Record<string, string> = {};

  if (
    !("notes" in input) ||
    Object.keys(input).some((field) => field !== "notes")
  ) {
    errors.form = "Only notes can be changed.";
  }

  const notes = parseOptionalNotes(input.notes, errors);

  if (Object.keys(errors).length > 0) {
    throw new CustomerNotesValidationError(errors);
  }

  return notes;
}

export async function updateCustomerNotes(
  orderId: string,
  value: unknown,
  client: CustomerNotesClient = prisma,
): Promise<CustomerOrder> {
  const notes = parseCustomerNotesUpdate(value);

  return client.$transaction(async (transaction) => {
    const existingOrder = await transaction.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    });

    if (!existingOrder) throw new CustomerOrderNotFoundError();
    if (existingOrder.status !== "NEW") {
      throw new CustomerOrderNotEditableError();
    }

    const result = await transaction.order.updateMany({
      where: { id: orderId, status: "NEW" },
      data: { notes },
    });

    if (result.count !== 1) {
      throw new CustomerOrderNotEditableError();
    }

    const updatedOrder = await transaction.order.findUnique({
      where: { id: orderId },
      select: customerOrderSelection,
    });

    if (!updatedOrder) throw new CustomerOrderNotFoundError();
    return toCustomerOrder(updatedOrder);
  });
}
