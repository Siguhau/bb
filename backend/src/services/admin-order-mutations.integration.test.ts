import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { OrderStatus } from "../domain/order.js";
import { configureSqlite } from "../infrastructure/prisma.js";
import { PrismaAdminOrderMutationRepository } from "../repositories/admin-order-mutation-repository.js";
import {
  AdminOrderCapacityUnavailableError,
  AdminOrderDeletionNotAllowedError,
  deleteCancelledAdminOrder,
  updateAdminOrder,
} from "./admin-order-mutations.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(
  testDirectory,
  "../../prisma/migrations/20260822170000_create_orders_model/migration.sql",
);

let temporaryDirectory: string;
let client: PrismaClient;
let concurrentClient: PrismaClient;
let repository: PrismaAdminOrderMutationRepository;
let concurrentRepository: PrismaAdminOrderMutationRepository;
let referenceSequence = 0;

async function seedOrder({
  dueDate,
  status = "NEW",
  slot,
  serviceTypes = ["BRAKE_MAINTENANCE"],
}: {
  dueDate: string;
  status?: OrderStatus;
  slot?: number;
  serviceTypes?: string[];
}) {
  referenceSequence += 1;
  return client.order.create({
    data: {
      reference: referenceSequence.toString(36).toUpperCase().padStart(8, "0"),
      customerName: `Customer ${referenceSequence}`,
      phoneNumber: `+47 123 45 ${String(referenceSequence).padStart(3, "0")}`,
      emailAddress: `customer-${referenceSequence}@example.com`,
      bikeBrand: "Trek",
      expectedDueDate: dueDate,
      status,
      serviceTypes: {
        create: serviceTypes.map((code) => ({
          serviceType: { connect: { code } },
        })),
      },
      capacityReservation:
        slot === undefined ? undefined : { create: { slot } },
    },
    select: { id: true },
  });
}

async function fillDate(dueDate: string, slots = [1, 2, 3, 4, 5]) {
  const orders = [];
  for (const slot of slots) {
    orders.push(await seedOrder({ dueDate, slot }));
  }
  return orders;
}

async function persistedOrder(id: string) {
  return client.order.findUnique({
    where: { id },
    include: {
      capacityReservation: true,
      serviceTypes: { orderBy: { serviceTypeCode: "asc" } },
    },
  });
}

async function expectReservationInvariant(id: string) {
  const order = await persistedOrder(id);
  expect(order).not.toBeNull();
  if (order!.status === "CANCELLED") {
    expect(order!.capacityReservation).toBeNull();
  } else {
    expect(order!.capacityReservation).toMatchObject({
      orderId: id,
      dueDate: order!.expectedDueDate,
    });
  }
}

beforeAll(async () => {
  temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), "bouvet-bike-admin-mutations-"),
  );
  client = new PrismaClient({
    datasourceUrl: `file:${path.join(temporaryDirectory, "test.db")}`,
  });
  concurrentClient = new PrismaClient({
    datasourceUrl: `file:${path.join(temporaryDirectory, "test.db")}`,
  });
  const migration = await readFile(migrationPath, "utf8");
  for (const statement of migration.split(/;\s*(?:\r?\n|$)/)) {
    if (statement.trim()) await client.$executeRawUnsafe(statement);
  }
  await configureSqlite(client);
  await configureSqlite(concurrentClient);
  repository = new PrismaAdminOrderMutationRepository(client);
  concurrentRepository = new PrismaAdminOrderMutationRepository(
    concurrentClient,
  );
});

beforeEach(async () => {
  await client.$executeRawUnsafe("DROP TRIGGER IF EXISTS fail_order_update");
  await client.$executeRawUnsafe("DROP TRIGGER IF EXISTS fail_order_delete");
  await client.order.deleteMany();
});

afterAll(async () => {
  await concurrentClient.$disconnect();
  await client.$disconnect();
  await rm(temporaryDirectory, { recursive: true, force: true });
});

describe("admin order mutations with SQLite", () => {
  it("atomically persists combined allowed-field changes and moves capacity", async () => {
    const { id } = await seedOrder({ dueDate: "2026-08-24", slot: 1 });

    await updateAdminOrder(
      id,
      {
        notes: " Chain and wheel ",
        serviceTypes: ["CHAIN_REPLACEMENT", "WHEEL_ADJUSTMENT"],
        expectedDueDate: "2026-08-25",
        status: "IN_PROGRESS",
      },
      repository,
    );

    const order = await persistedOrder(id);
    expect(order).toMatchObject({
      notes: "Chain and wheel",
      expectedDueDate: "2026-08-25",
      status: "IN_PROGRESS",
      capacityReservation: { dueDate: "2026-08-25", slot: 1 },
    });
    expect(
      order!.serviceTypes.map(({ serviceTypeCode }) => serviceTypeCode),
    ).toEqual(["CHAIN_REPLACEMENT", "WHEEL_ADJUSTMENT"]);
    await expectReservationInvariant(id);
  });

  it("moves to a past weekday and releases the source slot", async () => {
    const { id } = await seedOrder({ dueDate: "2026-08-25", slot: 4 });

    await updateAdminOrder(id, { expectedDueDate: "2020-01-06" }, repository);

    await expect(
      client.capacityReservation.findUnique({
        where: { dueDate_slot: { dueDate: "2026-08-25", slot: 4 } },
      }),
    ).resolves.toBeNull();
    await expectReservationInvariant(id);
  });

  it("treats a same-date move as a no-op even when the date is full", async () => {
    const orders = await fillDate("2026-08-24");
    const id = orders[2]!.id;
    const before = await persistedOrder(id);

    await updateAdminOrder(
      id,
      { expectedDueDate: "2026-08-24", status: "IN_PROGRESS" },
      repository,
    );

    const after = await persistedOrder(id);
    expect(after!.capacityReservation).toEqual(before!.capacityReservation);
    expect(after!.status).toBe("IN_PROGRESS");
    await expectReservationInvariant(id);
  });

  it("rejects a full different date and rolls the source move back", async () => {
    await fillDate("2026-08-25");
    const { id } = await seedOrder({ dueDate: "2026-08-24", slot: 1 });
    const before = await persistedOrder(id);

    await expect(
      updateAdminOrder(
        id,
        { expectedDueDate: "2026-08-25", notes: "Must roll back" },
        repository,
      ),
    ).rejects.toBeInstanceOf(AdminOrderCapacityUnavailableError);

    expect(await persistedOrder(id)).toEqual(before);
  });

  it("rejects weekend moves before persistence", async () => {
    const { id } = await seedOrder({ dueDate: "2026-08-24", slot: 1 });
    const before = await persistedOrder(id);

    await expect(
      updateAdminOrder(id, { expectedDueDate: "2026-08-23" }, repository),
    ).rejects.toMatchObject({
      fields: { expectedDueDate: "Choose a weekday due date." },
    });

    expect(await persistedOrder(id)).toEqual(before);
  });

  it("cancels an order and immediately releases capacity", async () => {
    const { id } = await seedOrder({ dueDate: "2026-08-24", slot: 2 });

    await updateAdminOrder(id, { status: "CANCELLED" }, repository);

    expect((await persistedOrder(id))!.status).toBe("CANCELLED");
    await expectReservationInvariant(id);
  });

  it("allows a cancelled due-date change without capacity and enforces it on reopen", async () => {
    await fillDate("2026-08-25");
    const { id } = await seedOrder({
      dueDate: "2026-08-24",
      status: "CANCELLED",
    });

    await updateAdminOrder(id, { expectedDueDate: "2026-08-25" }, repository);
    await expectReservationInvariant(id);
    await expect(
      updateAdminOrder(id, { status: "NEW" }, repository),
    ).rejects.toBeInstanceOf(AdminOrderCapacityUnavailableError);

    expect(await persistedOrder(id)).toMatchObject({
      expectedDueDate: "2026-08-25",
      status: "CANCELLED",
      capacityReservation: null,
    });
  });

  it("reopens a cancelled order into an available slot", async () => {
    await fillDate("2026-08-25", [1, 2, 4, 5]);
    const { id } = await seedOrder({
      dueDate: "2026-08-25",
      status: "CANCELLED",
    });

    await updateAdminOrder(id, { status: "IN_PROGRESS" }, repository);

    expect((await persistedOrder(id))!.capacityReservation!.slot).toBe(3);
    await expectReservationInvariant(id);
  });

  it("preserves a completed order's reservation when changing it to active", async () => {
    const orders = await fillDate("2026-08-24");
    const id = orders[0]!.id;
    await client.order.update({ where: { id }, data: { status: "COMPLETED" } });
    const reservation = (await persistedOrder(id))!.capacityReservation;

    await updateAdminOrder(id, { status: "NEW" }, repository);

    expect((await persistedOrder(id))!.capacityReservation).toEqual(
      reservation,
    );
    await expectReservationInvariant(id);
  });

  it("rolls back every combined change when persistence fails", async () => {
    const { id } = await seedOrder({ dueDate: "2026-08-24", slot: 1 });
    const before = await persistedOrder(id);
    await client.$executeRawUnsafe(`
      CREATE TRIGGER fail_order_update BEFORE UPDATE ON "Order"
      WHEN NEW.notes = 'FAIL' BEGIN SELECT RAISE(ABORT, 'forced failure'); END
    `);

    await expect(
      updateAdminOrder(
        id,
        {
          notes: "FAIL",
          serviceTypes: ["CHAIN_REPLACEMENT"],
          expectedDueDate: "2026-08-25",
          status: "IN_PROGRESS",
        },
        repository,
      ),
    ).rejects.toThrow();

    expect(await persistedOrder(id)).toEqual(before);
    await expectReservationInvariant(id);
  });

  it("allows permanent deletion only for cancelled orders", async () => {
    const active = await seedOrder({ dueDate: "2026-08-24", slot: 1 });
    const cancelled = await seedOrder({
      dueDate: "2026-08-25",
      status: "CANCELLED",
      serviceTypes: ["CHAIN_REPLACEMENT"],
    });

    await expect(
      deleteCancelledAdminOrder(active.id, repository),
    ).rejects.toBeInstanceOf(AdminOrderDeletionNotAllowedError);
    await deleteCancelledAdminOrder(cancelled.id, repository);

    await expect(persistedOrder(active.id)).resolves.not.toBeNull();
    await expect(persistedOrder(cancelled.id)).resolves.toBeNull();
    await expect(
      client.orderService.count({ where: { orderId: cancelled.id } }),
    ).resolves.toBe(0);
  });

  it("does not report deletion success when persistence fails", async () => {
    const { id } = await seedOrder({
      dueDate: "2026-08-25",
      status: "CANCELLED",
    });
    await client.$executeRawUnsafe(`
      CREATE TRIGGER fail_order_delete BEFORE DELETE ON "Order"
      BEGIN SELECT RAISE(ABORT, 'forced failure'); END
    `);

    await expect(deleteCancelledAdminOrder(id, repository)).rejects.toThrow();
    await expect(persistedOrder(id)).resolves.not.toBeNull();
  });

  it("uses uniqueness and retries so concurrent moves cannot exceed capacity", async () => {
    await fillDate("2026-08-25", [1, 2, 3, 4]);
    const first = await seedOrder({ dueDate: "2026-08-24", slot: 1 });
    const second = await seedOrder({ dueDate: "2026-08-26", slot: 1 });

    const outcomes = await Promise.allSettled([
      updateAdminOrder(first.id, { expectedDueDate: "2026-08-25" }, repository),
      updateAdminOrder(
        second.id,
        { expectedDueDate: "2026-08-25" },
        concurrentRepository,
      ),
    ]);

    expect(
      outcomes.filter(({ status }) => status === "fulfilled"),
    ).toHaveLength(1);
    const rejected = outcomes.filter(
      (outcome): outcome is PromiseRejectedResult =>
        outcome.status === "rejected",
    );
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toBeInstanceOf(
      AdminOrderCapacityUnavailableError,
    );
    await expect(
      client.capacityReservation.count({ where: { dueDate: "2026-08-25" } }),
    ).resolves.toBe(5);
    await expectReservationInvariant(first.id);
    await expectReservationInvariant(second.id);
  }, 30_000);

  it("allows only one concurrent reopen into the last slot", async () => {
    await fillDate("2026-08-25", [1, 2, 3, 4]);
    const first = await seedOrder({
      dueDate: "2026-08-25",
      status: "CANCELLED",
    });
    const second = await seedOrder({
      dueDate: "2026-08-25",
      status: "CANCELLED",
    });

    const outcomes = await Promise.allSettled([
      updateAdminOrder(first.id, { status: "NEW" }, repository),
      updateAdminOrder(second.id, { status: "NEW" }, concurrentRepository),
    ]);

    expect(
      outcomes.filter(({ status }) => status === "fulfilled"),
    ).toHaveLength(1);
    const rejected = outcomes.filter(
      (outcome): outcome is PromiseRejectedResult =>
        outcome.status === "rejected",
    );
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toBeInstanceOf(
      AdminOrderCapacityUnavailableError,
    );
    await expect(
      client.capacityReservation.count({ where: { dueDate: "2026-08-25" } }),
    ).resolves.toBe(5);
    await expectReservationInvariant(first.id);
    await expectReservationInvariant(second.id);
  }, 30_000);
});
