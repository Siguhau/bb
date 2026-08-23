import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { createPrismaAdminOrderRepository } from "./admin-order-repository.js";

const storedOrder = {
  id: "order-1",
  reference: "A1B2C3D4",
  customerName: "Ada Lovelace",
  phoneNumber: "+47 123 45 678",
  emailAddress: "ada@example.com",
  bikeBrand: "Trek",
  expectedDueDate: "2026-08-24",
  status: "NEW",
  notes: null,
  createdAt: new Date("2026-08-22T08:00:00Z"),
  updatedAt: new Date("2026-08-22T09:00:00Z"),
  serviceTypes: [
    {
      serviceType: {
        code: "BRAKE_MAINTENANCE",
        displayName: "Brake maintenance",
      },
    },
  ],
};

function client({
  findMany = vi.fn().mockResolvedValue([]),
  findUnique = vi.fn().mockResolvedValue(null),
  groupBy = vi.fn().mockResolvedValue([]),
} = {}) {
  return {
    value: {
      order: { findMany, findUnique },
      capacityReservation: { groupBy },
    } as unknown as Pick<PrismaClient, "order" | "capacityReservation">,
    findMany,
    findUnique,
    groupBy,
  };
}

describe("Prisma admin order repository", () => {
  it("searches every supported field, intersects filters, and orders stably", async () => {
    const database = client({
      findMany: vi.fn().mockResolvedValue([storedOrder]),
    });
    const repository = createPrismaAdminOrderRepository(database.value);

    await expect(
      repository.listOrders({
        search: "ada",
        status: "NEW",
        serviceType: "BRAKE_MAINTENANCE",
        dueDate: "2026-08-24",
      }),
    ).resolves.toEqual([
      {
        ...storedOrder,
        serviceTypes: [
          { code: "BRAKE_MAINTENANCE", displayName: "Brake maintenance" },
        ],
      },
    ]);

    expect(database.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { reference: { contains: "ada" } },
            { customerName: { contains: "ada" } },
            { emailAddress: { contains: "ada" } },
            { phoneNumber: { contains: "ada" } },
            { bikeBrand: { contains: "ada" } },
          ],
          status: "NEW",
          expectedDueDate: "2026-08-24",
          serviceTypes: {
            some: { serviceTypeCode: "BRAKE_MAINTENANCE" },
          },
        },
        orderBy: [
          { expectedDueDate: "asc" },
          { createdAt: "desc" },
          { id: "asc" },
        ],
      }),
    );
  });

  it("loads a complete individual order and flattens services", async () => {
    const database = client({
      findUnique: vi.fn().mockResolvedValue(storedOrder),
    });
    const repository = createPrismaAdminOrderRepository(database.value);

    const order = await repository.findOrder("order-1");

    expect(database.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "order-1" } }),
    );
    expect(order?.serviceTypes).toEqual([
      { code: "BRAKE_MAINTENANCE", displayName: "Brake maintenance" },
    ]);
  });

  it("counts authoritative reservations in the inclusive capacity range", async () => {
    const database = client({
      groupBy: vi
        .fn()
        .mockResolvedValue([{ dueDate: "2026-08-24", _count: { _all: 3 } }]),
    });
    const repository = createPrismaAdminOrderRepository(database.value);

    await expect(
      repository.listCapacityUsage("2026-08-24", "2026-08-28"),
    ).resolves.toEqual([{ dueDate: "2026-08-24", used: 3 }]);
    expect(database.groupBy).toHaveBeenCalledWith({
      by: ["dueDate"],
      where: { dueDate: { gte: "2026-08-24", lte: "2026-08-28" } },
      _count: { _all: true },
      orderBy: { dueDate: "asc" },
    });
  });
});
