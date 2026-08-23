import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type {
  AdminOrderMutationRepository,
  AdminOrderMutationResult,
  AdminOrderMutationTransaction,
  MutableOrder,
} from "../repositories/admin-order-mutation-repository.js";
import {
  AdminOrderDeletionNotAllowedError,
  AdminOrderMutationValidationError,
  AdminOrderNotFoundError,
  deleteCancelledAdminOrder,
  parseAdminOrderPatch,
  updateAdminOrder,
} from "./admin-order-mutations.js";

const result: AdminOrderMutationResult = {
  id: "order-1",
  reference: "A1B2C3D4",
  customerName: "Ada Lovelace",
  phoneNumber: "+47 123 45 678",
  emailAddress: "ada@example.com",
  bikeBrand: "Trek",
  expectedDueDate: "2026-08-25",
  status: "IN_PROGRESS",
  notes: "Ready",
  discountCode: null,
  subtotalCost: 550,
  discountAmount: 0,
  totalCost: 550,
  createdAt: new Date("2026-08-20T08:00:00Z"),
  updatedAt: new Date("2026-08-22T08:00:00Z"),
  serviceTypes: [
    { code: "CHAIN_REPLACEMENT", displayName: "Chain replacement", cost: 550 },
  ],
};

function repositoryFor(current: MutableOrder, usedSlots: number[] = []) {
  const operations: string[] = [];
  const transaction: AdminOrderMutationTransaction = {
    findOrder: vi.fn(async () => current),
    findReservedSlots: vi.fn(async () => usedSlots),
    deleteReservation: vi.fn(async () => {
      operations.push("delete-reservation");
    }),
    createReservation: vi.fn(async (_orderId, dueDate, slot) => {
      operations.push(`create-reservation:${dueDate}:${slot}`);
    }),
    updateOrder: vi.fn(async () => {
      operations.push("update-order");
      return result;
    }),
    deleteOrder: vi.fn(async () => {
      operations.push("delete-order");
    }),
  };
  const repository: AdminOrderMutationRepository = {
    transaction: vi.fn(async (operation) => {
      operations.push("transaction-start");
      const value = await operation(transaction);
      operations.push("transaction-end");
      return value;
    }),
  };
  return { repository, transaction, operations };
}

describe("admin order patch validation", () => {
  it("normalizes all allowed fields", () => {
    expect(
      parseAdminOrderPatch({
        notes: " Ready ",
        serviceTypes: ["CHAIN_REPLACEMENT"],
        expectedDueDate: "2026-08-25",
        status: "IN_PROGRESS",
      }),
    ).toEqual({
      notes: "Ready",
      serviceTypes: ["CHAIN_REPLACEMENT"],
      expectedDueDate: "2026-08-25",
      status: "IN_PROGRESS",
    });
    expect(parseAdminOrderPatch({ notes: "  " })).toEqual({ notes: null });
  });

  it.each([
    "customerName",
    "phoneNumber",
    "emailAddress",
    "bikeBrand",
    "reference",
    "unknown",
  ])("strictly rejects the forbidden or unknown %s field", (field) => {
    expect(() =>
      parseAdminOrderPatch({ notes: "Allowed", [field]: "Forbidden" }),
    ).toThrow(AdminOrderMutationValidationError);
  });

  it.each([
    null,
    [],
    {},
    { notes: 4 },
    { notes: "n".repeat(2_001) },
    { serviceTypes: [] },
    { serviceTypes: ["NOT_SUPPORTED"] },
    { serviceTypes: ["BRAKE_MAINTENANCE", "BRAKE_MAINTENANCE"] },
    { expectedDueDate: "2026-02-30" },
    { expectedDueDate: "2026-08-23" },
    { status: "PENDING" },
  ])("rejects invalid patch %#", (patch) => {
    expect(() => parseAdminOrderPatch(patch)).toThrow(
      AdminOrderMutationValidationError,
    );
  });

  it("does not impose a future-only due-date rule", () => {
    expect(parseAdminOrderPatch({ expectedDueDate: "2020-01-06" })).toEqual({
      expectedDueDate: "2020-01-06",
    });
  });
});

describe("updateAdminOrder", () => {
  it("applies a combined change and reservation move in one transaction", async () => {
    const { repository, transaction, operations } = repositoryFor({
      id: "order-1",
      expectedDueDate: "2026-08-24",
      status: "NEW",
      capacityReservation: { dueDate: "2026-08-24", slot: 1 },
    });

    await updateAdminOrder(
      "order-1",
      {
        notes: "Ready",
        serviceTypes: ["CHAIN_REPLACEMENT"],
        expectedDueDate: "2026-08-25",
        status: "IN_PROGRESS",
      },
      repository,
    );

    expect(repository.transaction).toHaveBeenCalledTimes(1);
    expect(transaction.updateOrder).toHaveBeenCalledWith("order-1", {
      notes: "Ready",
      serviceTypes: ["CHAIN_REPLACEMENT"],
      expectedDueDate: "2026-08-25",
      status: "IN_PROGRESS",
    });
    expect(operations).toEqual([
      "transaction-start",
      "delete-reservation",
      "update-order",
      "create-reservation:2026-08-25:1",
      "transaction-end",
    ]);
  });

  it("preserves the reservation for a same-date move on a full day", async () => {
    const { repository, transaction } = repositoryFor(
      {
        id: "order-1",
        expectedDueDate: "2026-08-24",
        status: "COMPLETED",
        capacityReservation: { dueDate: "2026-08-24", slot: 3 },
      },
      [1, 2, 3, 4, 5],
    );

    await updateAdminOrder(
      "order-1",
      { expectedDueDate: "2026-08-24", status: "NEW" },
      repository,
    );

    expect(transaction.findReservedSlots).not.toHaveBeenCalled();
    expect(transaction.deleteReservation).not.toHaveBeenCalled();
    expect(transaction.createReservation).not.toHaveBeenCalled();
  });

  it("releases capacity when cancelled", async () => {
    const { repository, transaction } = repositoryFor({
      id: "order-1",
      expectedDueDate: "2026-08-24",
      status: "NEW",
      capacityReservation: { dueDate: "2026-08-24", slot: 2 },
    });

    await updateAdminOrder("order-1", { status: "CANCELLED" }, repository);

    expect(transaction.deleteReservation).toHaveBeenCalledWith("order-1");
    expect(transaction.createReservation).not.toHaveBeenCalled();
  });

  it("allows a cancelled order to store a full weekday without reserving it", async () => {
    const { repository, transaction } = repositoryFor(
      {
        id: "order-1",
        expectedDueDate: "2026-08-24",
        status: "CANCELLED",
        capacityReservation: null,
      },
      [1, 2, 3, 4, 5],
    );

    await updateAdminOrder(
      "order-1",
      { expectedDueDate: "2026-08-25" },
      repository,
    );

    expect(transaction.findReservedSlots).not.toHaveBeenCalled();
    expect(transaction.createReservation).not.toHaveBeenCalled();
  });

  it("reserves capacity when a cancelled order is reopened", async () => {
    const { repository, transaction } = repositoryFor(
      {
        id: "order-1",
        expectedDueDate: "2026-08-25",
        status: "CANCELLED",
        capacityReservation: null,
      },
      [1, 2, 4],
    );

    await updateAdminOrder("order-1", { status: "NEW" }, repository);

    expect(transaction.createReservation).toHaveBeenCalledWith(
      "order-1",
      "2026-08-25",
      3,
    );
  });

  it("retries a bounded transaction conflict", async () => {
    const { repository, transaction } = repositoryFor({
      id: "order-1",
      expectedDueDate: "2026-08-24",
      status: "CANCELLED",
      capacityReservation: null,
    });
    vi.mocked(repository.transaction)
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("collision", {
          code: "P2002",
          clientVersion: "6.19.1",
        }),
      )
      .mockImplementation(async (operation) => operation(transaction));

    await updateAdminOrder("order-1", { status: "NEW" }, repository);

    expect(repository.transaction).toHaveBeenCalledTimes(2);
  });

  it("does not enter a transaction when validation fails", async () => {
    const { repository } = repositoryFor({
      id: "order-1",
      expectedDueDate: "2026-08-24",
      status: "NEW",
      capacityReservation: { dueDate: "2026-08-24", slot: 1 },
    });

    await expect(
      updateAdminOrder("order-1", { customerName: "Grace" }, repository),
    ).rejects.toBeInstanceOf(AdminOrderMutationValidationError);
    expect(repository.transaction).not.toHaveBeenCalled();
  });

  it("reports a missing order without writing", async () => {
    const { repository, transaction } = repositoryFor({
      id: "order-1",
      expectedDueDate: "2026-08-24",
      status: "NEW",
      capacityReservation: { dueDate: "2026-08-24", slot: 1 },
    });
    vi.mocked(transaction.findOrder).mockResolvedValue(null);

    await expect(
      updateAdminOrder("missing", { notes: "No write" }, repository),
    ).rejects.toBeInstanceOf(AdminOrderNotFoundError);
    expect(transaction.updateOrder).not.toHaveBeenCalled();
    expect(transaction.deleteReservation).not.toHaveBeenCalled();
    expect(transaction.createReservation).not.toHaveBeenCalled();
  });
});

describe("deleteCancelledAdminOrder", () => {
  it("deletes a cancelled order transactionally", async () => {
    const { repository, transaction } = repositoryFor({
      id: "order-1",
      expectedDueDate: "2026-08-24",
      status: "CANCELLED",
      capacityReservation: null,
    });

    await deleteCancelledAdminOrder("order-1", repository);

    expect(transaction.deleteOrder).toHaveBeenCalledWith("order-1");
  });

  it("rejects deletion in every non-cancelled status", async () => {
    for (const status of [
      "NEW",
      "IN_PROGRESS",
      "WAITING_FOR_CUSTOMER_PICKUP",
      "COMPLETED",
    ] as const) {
      const { repository, transaction } = repositoryFor({
        id: "order-1",
        expectedDueDate: "2026-08-24",
        status,
        capacityReservation: { dueDate: "2026-08-24", slot: 1 },
      });

      await expect(
        deleteCancelledAdminOrder("order-1", repository),
      ).rejects.toBeInstanceOf(AdminOrderDeletionNotAllowedError);
      expect(transaction.deleteOrder).not.toHaveBeenCalled();
    }
  });

  it("reports a missing order without attempting deletion", async () => {
    const { repository, transaction } = repositoryFor({
      id: "order-1",
      expectedDueDate: "2026-08-24",
      status: "CANCELLED",
      capacityReservation: null,
    });
    vi.mocked(transaction.findOrder).mockResolvedValue(null);

    await expect(
      deleteCancelledAdminOrder("missing", repository),
    ).rejects.toBeInstanceOf(AdminOrderNotFoundError);
    expect(transaction.deleteOrder).not.toHaveBeenCalled();
  });
});
