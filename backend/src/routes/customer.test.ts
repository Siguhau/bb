import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createLookupRateLimiter } from "../middleware/lookup-rate-limit.js";
import type { CustomerOrder } from "../services/lookup-orders.js";
import {
  OrderSubmissionValidationError,
  type SubmittedOrder,
} from "../services/submit-order.js";
import {
  CustomerNotesValidationError,
  CustomerOrderNotEditableError,
  CustomerOrderNotFoundError,
} from "../services/update-customer-notes.js";
import { createCustomerRouter } from "./customer.js";

const matchingOrder: CustomerOrder = {
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
  updatedAt: new Date("2026-08-22T08:00:00Z"),
  serviceTypes: [
    { code: "BRAKE_MAINTENANCE", displayName: "Brake maintenance" },
  ],
};

function testApp(
  findOrders: (value: string) => Promise<CustomerOrder[]>,
  attemptLimit = 5,
  trustProxyHops = 0,
  createOrder?: (value: unknown) => Promise<SubmittedOrder>,
) {
  const app = express();
  if (trustProxyHops > 0) app.set("trust proxy", trustProxyHops);
  app.use(express.json());
  app.use(
    "/api/customer",
    createCustomerRouter({
      createOrder,
      findOrders,
      issueAccessGrant: (orderIds) => ({
        token: `grant-for-${orderIds.join("-")}`,
        expiresAt: "2026-08-22T09:00:00.000Z",
      }),
      rateLimiter: createLookupRateLimiter({
        attemptLimit,
        blockDurationMs: 60_000,
      }),
    }),
  );
  return app;
}

function notesTestApp({
  accessGrantAllowsOrder = vi.fn().mockReturnValue(true),
  updateNotes = vi.fn().mockResolvedValue({
    ...matchingOrder,
    notes: "Leave by the side door",
  }),
}: {
  accessGrantAllowsOrder?: (token: string, orderId: string) => boolean;
  updateNotes?: (orderId: string, value: unknown) => Promise<CustomerOrder>;
} = {}) {
  const app = express();
  app.use(express.json());
  app.use(
    "/api/customer",
    createCustomerRouter({
      accessGrantAllowsOrder,
      findOrders: async () => [],
      updateNotes,
      rateLimiter: createLookupRateLimiter({
        attemptLimit: 5,
        blockDurationMs: 60_000,
      }),
    }),
  );
  return app;
}

const submittedOrder: SubmittedOrder = {
  id: "order-1",
  reference: "A1B2C3D4",
  customerName: "Ada Lovelace",
  phoneNumber: "+47 123 45 678",
  emailAddress: "ada@example.com",
  bikeBrand: "Trek",
  expectedDueDate: "2026-08-24",
  status: "NEW",
  notes: null,
  serviceTypes: [
    { code: "BRAKE_MAINTENANCE", displayName: "Brake maintenance" },
  ],
};

describe("GET /api/customer/order-options", () => {
  it("returns the backend-authoritative service catalog", async () => {
    const response = await request(testApp(async () => [])).get(
      "/api/customer/order-options",
    );

    expect(response.status).toBe(200);
    expect(response.body.serviceTypes).toEqual([
      { code: "WHEEL_ADJUSTMENT", displayName: "Wheel adjustment" },
      { code: "CHAIN_REPLACEMENT", displayName: "Chain replacement" },
      { code: "BRAKE_MAINTENANCE", displayName: "Brake maintenance" },
      { code: "TIRE_REPLACEMENT", displayName: "Tire replacement" },
      { code: "BOUVET_DELUXE_TUNE_UP", displayName: "Bouvet Deluxe Tune-up" },
      { code: "OTHER", displayName: "Other" },
    ]);
  });
});

describe("POST /api/customer/orders", () => {
  it("returns the stored order after a successful submission", async () => {
    const createOrder = vi.fn().mockResolvedValue(submittedOrder);
    const input = {
      customerName: "Ada Lovelace",
      phoneNumber: "+47 123 45 678",
      emailAddress: "ada@example.com",
      bikeBrand: "Trek",
      serviceTypes: ["BRAKE_MAINTENANCE"],
    };

    const response = await request(testApp(async () => [], 5, 0, createOrder))
      .post("/api/customer/orders")
      .send(input);

    expect(response.status).toBe(201);
    expect(createOrder).toHaveBeenCalledWith(input);
    expect(response.body).toEqual({
      order: JSON.parse(JSON.stringify(submittedOrder)),
    });
  });

  it("returns field errors for invalid submissions", async () => {
    const createOrder = vi.fn().mockRejectedValue(
      new OrderSubmissionValidationError({
        emailAddress: "Enter a valid email address.",
      }),
    );

    const response = await request(testApp(async () => [], 5, 0, createOrder))
      .post("/api/customer/orders")
      .send({ emailAddress: "invalid" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Check the highlighted fields and try again.",
      fields: { emailAddress: "Enter a valid email address." },
    });
  });

  it("does not expose persistence details when submission fails", async () => {
    const createOrder = vi
      .fn()
      .mockRejectedValue(new Error("database path and customer data"));

    const response = await request(testApp(async () => [], 5, 0, createOrder))
      .post("/api/customer/orders")
      .send({ customerName: "Ada" });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: "We could not place your order. Please try again.",
    });
  });
});

describe("POST /api/customer/order-lookups", () => {
  it("returns every exact match as a separate customer-safe order", async () => {
    const findOrders = vi
      .fn()
      .mockResolvedValue([
        matchingOrder,
        { ...matchingOrder, id: "order-2", reference: "E5F6G7H8" },
      ]);

    const response = await request(testApp(findOrders))
      .post("/api/customer/order-lookups")
      .send({ value: "ada@example.com" });

    expect(response.status).toBe(200);
    expect(findOrders).toHaveBeenCalledWith("ada@example.com");
    expect(response.body.orders).toHaveLength(2);
    expect(response.body.accessGrant).toEqual({
      token: "grant-for-order-1-order-2",
      expiresAt: "2026-08-22T09:00:00.000Z",
    });
    expect(response.body.orders[0]).toMatchObject({
      reference: "A1B2C3D4",
      serviceTypes: [
        { code: "BRAKE_MAINTENANCE", displayName: "Brake maintenance" },
      ],
    });
    expect(response.body.orders[0]).not.toHaveProperty("totalCost");
    expect(response.body.orders[0].serviceTypes[0]).not.toHaveProperty("cost");
  });

  it("continues to return completed and cancelled orders with a scoped grant", async () => {
    const findOrders = vi.fn().mockResolvedValue([
      { ...matchingOrder, id: "completed", status: "COMPLETED" },
      { ...matchingOrder, id: "cancelled", status: "CANCELLED" },
    ]);

    const response = await request(testApp(findOrders))
      .post("/api/customer/order-lookups")
      .send({ value: "ada@example.com" });

    expect(response.status).toBe(200);
    expect(
      response.body.orders.map(({ status }: CustomerOrder) => status),
    ).toEqual(["COMPLETED", "CANCELLED"]);
    expect(response.body.accessGrant.token).toBe(
      "grant-for-completed-cancelled",
    );
  });

  it("uses a generic response when no order matches", async () => {
    const response = await request(testApp(async () => []))
      .post("/api/customer/order-lookups")
      .send({ value: "missing@example.com" });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "No matching orders were found." });
  });

  it("temporarily blocks a client after repeated unsuccessful attempts", async () => {
    const app = testApp(async () => [], 2);

    await request(app)
      .post("/api/customer/order-lookups")
      .send({ value: "first" });
    await request(app)
      .post("/api/customer/order-lookups")
      .send({ value: "second" });
    const response = await request(app)
      .post("/api/customer/order-lookups")
      .send({ value: "third" });

    expect(response.status).toBe(429);
    expect(response.body).toEqual({
      error: "Order lookup is temporarily unavailable. Please try again later.",
    });
  });

  it("limits total attempts even when a successful lookup occurs between misses", async () => {
    const findOrders = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([matchingOrder])
      .mockResolvedValueOnce([]);
    const app = testApp(findOrders, 2);

    await request(app)
      .post("/api/customer/order-lookups")
      .send({ value: "first" });
    await request(app)
      .post("/api/customer/order-lookups")
      .send({ value: "A1B2C3D4" });
    const response = await request(app)
      .post("/api/customer/order-lookups")
      .send({ value: "third" });

    expect(response.status).toBe(429);
    expect(findOrders).toHaveBeenCalledTimes(2);
  });

  it("keeps rate limits separate for clients behind a configured trusted proxy", async () => {
    const app = testApp(async () => [], 1, 1);

    await request(app)
      .post("/api/customer/order-lookups")
      .set("X-Forwarded-For", "192.0.2.1")
      .send({ value: "first" });
    const blockedResponse = await request(app)
      .post("/api/customer/order-lookups")
      .set("X-Forwarded-For", "192.0.2.1")
      .send({ value: "second" });
    const otherClientResponse = await request(app)
      .post("/api/customer/order-lookups")
      .set("X-Forwarded-For", "192.0.2.2")
      .send({ value: "first" });

    expect(blockedResponse.status).toBe(429);
    expect(otherClientResponse.status).toBe(404);
  });

  it("rejects missing and oversized lookup values without searching", async () => {
    const findOrders = vi.fn().mockResolvedValue([]);
    const app = testApp(findOrders);

    const missingResponse = await request(app)
      .post("/api/customer/order-lookups")
      .send({});
    const oversizedResponse = await request(app)
      .post("/api/customer/order-lookups")
      .send({ value: "a".repeat(255) });

    expect(missingResponse.status).toBe(400);
    expect(oversizedResponse.status).toBe(400);
    expect(findOrders).not.toHaveBeenCalled();
  });

  it("reports lookup failures without exposing database details", async () => {
    const response = await request(
      testApp(async () => {
        throw new Error("database path and customer data");
      }),
    )
      .post("/api/customer/order-lookups")
      .send({ value: "A1B2C3D4" });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: "We could not search for orders. Please try again.",
    });
  });
});

describe("PATCH /api/customer/orders/:id/notes", () => {
  it("uses the exact order-scoped bearer grant and returns the persisted order", async () => {
    const accessGrantAllowsOrder = vi.fn().mockReturnValue(true);
    const updatedOrder = { ...matchingOrder, notes: "Leave by the side door" };
    const updateNotes = vi.fn().mockResolvedValue(updatedOrder);

    const response = await request(
      notesTestApp({ accessGrantAllowsOrder, updateNotes }),
    )
      .patch("/api/customer/orders/order-1/notes")
      .set("Authorization", "Bearer valid_grant-1")
      .send({ notes: " Leave by the side door " });

    expect(response.status).toBe(200);
    expect(accessGrantAllowsOrder).toHaveBeenCalledWith(
      "valid_grant-1",
      "order-1",
    );
    expect(updateNotes).toHaveBeenCalledWith("order-1", {
      notes: " Leave by the side door ",
    });
    expect(response.body).toEqual({
      order: JSON.parse(JSON.stringify(updatedOrder)),
    });
    expect(response.body.order).not.toHaveProperty("totalCost");
    expect(response.body.order.serviceTypes[0]).not.toHaveProperty("cost");
  });

  it.each([
    ["missing", undefined],
    ["malformed", "Basic abc"],
    ["empty", "Bearer "],
  ])(
    "rejects a %s grant without attempting persistence",
    async (_name, header) => {
      const accessGrantAllowsOrder = vi.fn().mockReturnValue(true);
      const updateNotes = vi.fn();
      let pendingRequest = request(
        notesTestApp({ accessGrantAllowsOrder, updateNotes }),
      )
        .patch("/api/customer/orders/order-1/notes")
        .send({ notes: "Changed" });
      if (header) pendingRequest = pendingRequest.set("Authorization", header);

      const response = await pendingRequest;

      expect(response.status).toBe(403);
      expect(response.body.error).toContain("Look up the order again");
      expect(accessGrantAllowsOrder).not.toHaveBeenCalled();
      expect(updateNotes).not.toHaveBeenCalled();
    },
  );

  it.each(["invalid", "expired", "wrong-order"])(
    "rejects an %s or unscoped grant with the same safe response",
    async () => {
      const accessGrantAllowsOrder = vi.fn().mockReturnValue(false);
      const updateNotes = vi.fn();

      const response = await request(
        notesTestApp({ accessGrantAllowsOrder, updateNotes }),
      )
        .patch("/api/customer/orders/order-1/notes")
        .set("Authorization", "Bearer unavailable-token")
        .send({ notes: "Changed" });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain("Look up the order again");
      expect(updateNotes).not.toHaveBeenCalled();
    },
  );

  it("returns field-safe validation errors", async () => {
    const updateNotes = vi.fn().mockRejectedValue(
      new CustomerNotesValidationError({
        notes: "Notes must be 2000 characters or fewer.",
      }),
    );

    const response = await request(notesTestApp({ updateNotes }))
      .patch("/api/customer/orders/order-1/notes")
      .set("Authorization", "Bearer valid-token")
      .send({ notes: "n".repeat(2_001) });

    expect(response.status).toBe(400);
    expect(response.body.fields).toEqual({
      notes: "Notes must be 2000 characters or fewer.",
    });
  });

  it.each([
    "IN_PROGRESS",
    "WAITING_FOR_CUSTOMER_PICKUP",
    "COMPLETED",
    "CANCELLED",
  ])("rejects notes changes when the persisted order is %s", async () => {
    const updateNotes = vi
      .fn()
      .mockRejectedValue(new CustomerOrderNotEditableError());

    const response = await request(notesTestApp({ updateNotes }))
      .patch("/api/customer/orders/order-1/notes")
      .set("Authorization", "Bearer valid-token")
      .send({ notes: "Changed" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: "Notes can only be changed while the order is New.",
    });
  });

  it("returns a safe not-found error when a looked-up order was removed", async () => {
    const updateNotes = vi
      .fn()
      .mockRejectedValue(new CustomerOrderNotFoundError());

    const response = await request(notesTestApp({ updateNotes }))
      .patch("/api/customer/orders/order-1/notes")
      .set("Authorization", "Bearer valid-token")
      .send({ notes: "Changed" });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Order not found." });
  });

  it("does not expose persistence details", async () => {
    const updateNotes = vi
      .fn()
      .mockRejectedValue(new Error("database path and customer data"));

    const response = await request(notesTestApp({ updateNotes }))
      .patch("/api/customer/orders/order-1/notes")
      .set("Authorization", "Bearer valid-token")
      .send({ notes: "Changed" });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: "We could not update your notes. Please try again.",
    });
  });
});
