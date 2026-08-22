import { Prisma, type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  OrderSubmissionValidationError,
  assertValidShopTimeZone,
  generateOrderReference,
  parseOrderSubmission,
  shopLocalCalendarDate,
  submitOrder,
} from "./submit-order.js";

const validInput = {
  customerName: " Ada Lovelace ",
  phoneNumber: " +47 123 45 678 ",
  emailAddress: " ada@example.com ",
  bikeBrand: " Trek ",
  serviceTypes: ["BRAKE_MAINTENANCE"],
  notes: " Rear brake rubs ",
};

function submissionClient(reservationsByDate: Record<string, number[]> = {}) {
  const create = vi.fn(
    async ({ data }: { data: { expectedDueDate: string } }) => ({
      id: "order-1",
      expectedDueDate: data.expectedDueDate,
    }),
  );
  const transaction = {
    capacityReservation: {
      findMany: vi.fn(async ({ where }: { where: { dueDate: string } }) =>
        (reservationsByDate[where.dueDate] ?? []).map((slot) => ({ slot })),
      ),
    },
    order: { create },
  };
  const client = {
    $transaction: vi.fn(
      async (operation: (value: typeof transaction) => unknown) =>
        operation(transaction),
    ),
  } as unknown as Pick<PrismaClient, "$transaction">;

  return { client, create, transaction };
}

describe("order submission validation", () => {
  it("trims valid customer input without changing contact formatting", () => {
    expect(parseOrderSubmission(validInput)).toEqual({
      customerName: "Ada Lovelace",
      phoneNumber: "+47 123 45 678",
      emailAddress: "ada@example.com",
      bikeBrand: "Trek",
      serviceTypes: ["BRAKE_MAINTENANCE"],
      notes: "Rear brake rubs",
    });
  });

  it.each([
    ["customerName", ""],
    ["phoneNumber", "abc"],
    ["emailAddress", "not-an-email"],
    ["bikeBrand", "  "],
    ["serviceTypes", []],
    ["serviceTypes", ["NOT_SUPPORTED"]],
    ["serviceTypes", ["BRAKE_MAINTENANCE", "BRAKE_MAINTENANCE"]],
    ["notes", "n".repeat(2_001)],
    ["status", "COMPLETED"],
  ])("rejects invalid or server-owned %s input", (field, invalidValue) => {
    expect(() =>
      parseOrderSubmission({ ...validInput, [field]: invalidValue }),
    ).toThrow(OrderSubmissionValidationError);
  });
});

describe("submitOrder", () => {
  it("creates one new order with services and the earliest available slot", async () => {
    const { client, create } = submissionClient({
      "2026-08-24": [1, 2],
    });

    const order = await submitOrder(validInput, {
      client,
      generateReference: () => "A1B2C3D4",
      now: () => new Date("2026-08-21T10:00:00Z"),
      shopTimeZone: "Europe/Oslo",
    });

    expect(order).toMatchObject({
      reference: "A1B2C3D4",
      expectedDueDate: "2026-08-24",
      status: "NEW",
      serviceTypes: [
        { code: "BRAKE_MAINTENANCE", displayName: "Brake maintenance" },
      ],
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          expectedDueDate: "2026-08-24",
          status: "NEW",
          capacityReservation: { create: { dueDate: "2026-08-24", slot: 3 } },
        }),
      }),
    );
  });

  it("moves to the next weekday when the first weekday is full", async () => {
    const { client } = submissionClient({
      "2026-08-24": [1, 2, 3, 4, 5],
    });

    const order = await submitOrder(validInput, {
      client,
      generateReference: () => "A1B2C3D4",
      now: () => new Date("2026-08-21T10:00:00Z"),
    });

    expect(order.expectedDueDate).toBe("2026-08-25");
  });

  it("retries the transaction with a new reference after a unique collision", async () => {
    const { client: workingClient } = submissionClient();
    const references = ["AAAAAAAA", "BBBBBBBB"];
    const client = {
      $transaction: vi
        .fn()
        .mockRejectedValueOnce(
          new Prisma.PrismaClientKnownRequestError("collision", {
            code: "P2002",
            clientVersion: "6.19.1",
          }),
        )
        .mockImplementation((operation) =>
          workingClient.$transaction(operation),
        ),
    } as unknown as Pick<PrismaClient, "$transaction">;

    const order = await submitOrder(validInput, {
      client,
      generateReference: () => references.shift()!,
      now: () => new Date("2026-08-23T10:00:00Z"),
    });

    expect(order.reference).toBe("BBBBBBBB");
    expect(client.$transaction).toHaveBeenCalledTimes(2);
  });
});

describe("submission helpers", () => {
  it("generates eight-character uppercase alphanumeric references", () => {
    expect(generateOrderReference()).toMatch(/^[A-Z0-9]{8}$/);
  });

  it("uses the configured shop timezone for the local calendar day", () => {
    const instant = new Date("2026-08-22T22:30:00Z");
    expect(shopLocalCalendarDate(instant, "Europe/Oslo")).toBe("2026-08-23");
    expect(shopLocalCalendarDate(instant, "America/New_York")).toBe(
      "2026-08-22",
    );
  });

  it("rejects an invalid configured shop timezone", () => {
    expect(() => assertValidShopTimeZone("Not/A_Timezone")).toThrow(
      /SHOP_TIME_ZONE/,
    );
  });
});
