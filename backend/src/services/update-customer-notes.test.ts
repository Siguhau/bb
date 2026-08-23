import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { CustomerOrder } from "./lookup-orders.js";
import {
  CustomerNotesValidationError,
  CustomerOrderNotEditableError,
  CustomerOrderNotFoundError,
  updateCustomerNotes,
} from "./update-customer-notes.js";

const customerOrder: CustomerOrder = {
  id: "order-1",
  reference: "A1B2C3D4",
  customerName: "Ada Lovelace",
  phoneNumber: "+47 123 45 678",
  emailAddress: "ada@example.com",
  bikeBrand: "Trek",
  expectedDueDate: "2026-08-24",
  status: "NEW",
  notes: "Updated brake details",
  createdAt: new Date("2026-08-22T08:00:00Z"),
  updatedAt: new Date("2026-08-22T09:00:00Z"),
  serviceTypes: [
    { code: "BRAKE_MAINTENANCE", displayName: "Brake maintenance" },
  ],
};

function notesClient({
  existingOrder = { id: "order-1", status: "NEW" },
  updateCount = 1,
  persistedOrder = {
    ...customerOrder,
    serviceTypes: customerOrder.serviceTypes.map((serviceType) => ({
      serviceType,
    })),
  },
}: {
  existingOrder?: { id: string; status: string } | null;
  updateCount?: number;
  persistedOrder?: unknown;
} = {}) {
  const findUnique = vi
    .fn()
    .mockResolvedValueOnce(existingOrder)
    .mockResolvedValueOnce(persistedOrder);
  const updateMany = vi.fn().mockResolvedValue({ count: updateCount });
  const transaction = { order: { findUnique, updateMany } };
  const client = {
    $transaction: vi.fn(
      async (operation: (value: typeof transaction) => unknown) =>
        operation(transaction),
    ),
  } as unknown as Pick<PrismaClient, "$transaction">;

  return { client, findUnique, updateMany };
}

describe("updateCustomerNotes", () => {
  it.each([
    [{ notes: " Updated brake details " }, "Updated brake details"],
    [{ notes: "   " }, null],
    [{ notes: null }, null],
  ])("normalizes optional notes %#", async (input, notes) => {
    const { client, updateMany } = notesClient();

    await updateCustomerNotes("order-1", input, client);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "order-1", status: "NEW" },
      data: { notes },
    });
  });

  it.each([
    [undefined, { form: "Only notes can be changed." }],
    [{}, { form: "Only notes can be changed." }],
    [{ notes: "valid", status: "NEW" }, { form: "Only notes can be changed." }],
    [{ notes: 123 }, { notes: "Notes must be text." }],
    [
      { notes: "n".repeat(2_001) },
      { notes: "Notes must be 2000 characters or fewer." },
    ],
  ])("rejects invalid or non-notes payload %#", async (input, fields) => {
    const { client, findUnique, updateMany } = notesClient();

    await expect(updateCustomerNotes("order-1", input, client)).rejects.toEqual(
      expect.objectContaining({
        constructor: CustomerNotesValidationError,
        fields,
      }),
    );
    expect(findUnique).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("uses an atomic New-status predicate and returns only the persisted customer-safe order", async () => {
    const { client, findUnique, updateMany } = notesClient();

    await expect(
      updateCustomerNotes(
        "order-1",
        { notes: " Updated brake details " },
        client,
      ),
    ).resolves.toEqual(customerOrder);

    expect(findUnique).toHaveBeenNthCalledWith(1, {
      where: { id: "order-1" },
      select: { id: true, status: true },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "order-1", status: "NEW" },
      data: { notes: "Updated brake details" },
    });
    expect(findUnique).toHaveBeenNthCalledWith(2, {
      where: { id: "order-1" },
      select: expect.objectContaining({
        id: true,
        notes: true,
        serviceTypes: expect.any(Object),
      }),
    });
  });

  it("reports an absent order without attempting an update", async () => {
    const { client, updateMany } = notesClient({ existingOrder: null });

    await expect(
      updateCustomerNotes("missing-order", { notes: "Details" }, client),
    ).rejects.toBeInstanceOf(CustomerOrderNotFoundError);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it.each([
    "IN_PROGRESS",
    "WAITING_FOR_CUSTOMER_PICKUP",
    "COMPLETED",
    "CANCELLED",
  ])("rejects a %s order without attempting an update", async (status) => {
    const { client, updateMany } = notesClient({
      existingOrder: { id: "order-1", status },
    });

    await expect(
      updateCustomerNotes("order-1", { notes: "Details" }, client),
    ).rejects.toBeInstanceOf(CustomerOrderNotEditableError);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("rejects when the status changes after the New-state read", async () => {
    const { client, updateMany } = notesClient({ updateCount: 0 });

    await expect(
      updateCustomerNotes("order-1", { notes: "Details" }, client),
    ).rejects.toBeInstanceOf(CustomerOrderNotEditableError);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "order-1", status: "NEW" },
      data: { notes: "Details" },
    });
  });

  it("propagates a persistence failure without reporting a successful update", async () => {
    const { client, findUnique, updateMany } = notesClient();
    updateMany.mockRejectedValueOnce(new Error("database unavailable"));

    await expect(
      updateCustomerNotes("order-1", { notes: "Details" }, client),
    ).rejects.toThrow("database unavailable");
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it("rolls back when the persisted response cannot be read", async () => {
    let storedNotes = "Original details";
    const transaction = {
      order: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({ id: "order-1", status: "NEW" })
          .mockRejectedValueOnce(new Error("database read unavailable")),
        updateMany: vi.fn().mockImplementation(async ({ data }) => {
          storedNotes = data.notes;
          return { count: 1 };
        }),
      },
    };
    const client = {
      $transaction: vi.fn(
        async (operation: (value: typeof transaction) => Promise<unknown>) => {
          const originalNotes = storedNotes;
          try {
            return await operation(transaction);
          } catch (error) {
            storedNotes = originalNotes;
            throw error;
          }
        },
      ),
    } as unknown as Pick<PrismaClient, "$transaction">;

    await expect(
      updateCustomerNotes("order-1", { notes: "Changed details" }, client),
    ).rejects.toThrow("database read unavailable");
    expect(storedNotes).toBe("Original details");
  });
});
