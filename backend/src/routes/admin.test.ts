import express, { type RequestHandler } from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import {
  AdminReadValidationError,
  parseAdminOrderQuery,
  parseCapacityQuery,
} from "../services/admin-read.js";
import { createAdminRouter } from "./admin.js";

const completeOrder = {
  id: "order-1",
  reference: "A1B2C3D4",
  customerName: "Ada Lovelace",
  phoneNumber: "+47 123 45 678",
  emailAddress: "ada@example.com",
  bikeBrand: "Trek",
  expectedDueDate: "2026-08-24",
  status: "NEW",
  notes: "Rear brake rubs",
  createdAt: new Date("2026-08-22T08:00:00Z"),
  updatedAt: new Date("2026-08-22T09:00:00Z"),
  serviceTypes: [
    { code: "BRAKE_MAINTENANCE", displayName: "Brake maintenance" },
  ],
};

const capacityDays = [
  { date: "2026-08-21", used: 3, capacity: 5, display: "3 of 5" },
  { date: "2026-08-24", used: 0, capacity: 5, display: "0 of 5" },
];

function createTestApp({
  authorize = (_request, _response, next) => next(),
  listOrders = async () => [completeOrder],
  getOrder = async () => completeOrder,
  getCapacity = async () => capacityDays,
}: {
  authorize?: RequestHandler;
  listOrders?: (query: unknown) => Promise<(typeof completeOrder)[]>;
  getOrder?: (id: string) => Promise<typeof completeOrder | null>;
  getCapacity?: (query: unknown) => Promise<typeof capacityDays>;
} = {}) {
  const app = express();
  app.use(
    "/api/admin",
    createAdminRouter({ authorize, listOrders, getOrder, getCapacity }),
  );
  return app;
}

describe("admin read routes", () => {
  it("attaches authorization before listing orders", async () => {
    const authorize = vi.fn<RequestHandler>((_request, _response, next) =>
      next(),
    );
    const listOrders = vi.fn().mockResolvedValue([completeOrder]);

    const response = await request(createTestApp({ authorize, listOrders }))
      .get("/api/admin/orders")
      .query({
        search: "Ada",
        status: "NEW",
        serviceType: "BRAKE_MAINTENANCE",
        dueDate: "2026-08-24",
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      orders: JSON.parse(JSON.stringify([completeOrder])),
    });
    expect(authorize).toHaveBeenCalledTimes(1);
    expect(listOrders).toHaveBeenCalledWith(
      expect.objectContaining({
        search: "Ada",
        status: "NEW",
        serviceType: "BRAKE_MAINTENANCE",
        dueDate: "2026-08-24",
      }),
    );
  });

  it("does not invoke list services when authorization blocks the request", async () => {
    const listOrders = vi.fn().mockResolvedValue([completeOrder]);
    const authorize: RequestHandler = (_request, response) => {
      response.status(401).json({ error: "Unauthorized" });
    };

    const response = await request(
      createTestApp({ authorize, listOrders }),
    ).get("/api/admin/orders");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Unauthorized" });
    expect(listOrders).not.toHaveBeenCalled();
  });

  it("returns service validation errors for invalid order list queries", async () => {
    const error = new AdminReadValidationError({
      status: "Choose a supported order status.",
    });
    const listOrders = vi.fn().mockRejectedValue(error);

    const response = await request(createTestApp({ listOrders }))
      .get("/api/admin/orders")
      .query({ status: "PENDING" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: error.message,
      fields: error.fields,
    });
  });

  it("returns 400 for calendar-shaped query dates with invalid months", async () => {
    const response = await request(
      createTestApp({
        listOrders: async (query) => {
          parseAdminOrderQuery(query);
          return [];
        },
      }),
    )
      .get("/api/admin/orders")
      .query({ dueDate: "2026-13-01" });

    expect(response.status).toBe(400);
    expect(response.body.fields.dueDate).toEqual(expect.any(String));
  });

  it("does not expose persistence failures while listing orders", async () => {
    const response = await request(
      createTestApp({
        listOrders: async () => {
          throw new Error("database path and customer data");
        },
      }),
    ).get("/api/admin/orders");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: "We could not load orders. Please try again.",
    });
  });

  it("returns a complete individual order", async () => {
    const getOrder = vi.fn().mockResolvedValue(completeOrder);

    const response = await request(createTestApp({ getOrder })).get(
      "/api/admin/orders/order-1",
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      order: JSON.parse(JSON.stringify(completeOrder)),
    });
    expect(getOrder).toHaveBeenCalledWith("order-1");
  });

  it("returns 404 when an individual order does not exist", async () => {
    const response = await request(
      createTestApp({ getOrder: async () => null }),
    ).get("/api/admin/orders/missing-order");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Order not found." });
  });

  it("does not expose persistence failures while loading an individual order", async () => {
    const response = await request(
      createTestApp({
        getOrder: async () => {
          throw new Error("database path and customer data");
        },
      }),
    ).get("/api/admin/orders/order-1");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: "We could not load the order. Please try again.",
    });
  });

  it("returns weekday capacity and forwards the inclusive date range", async () => {
    const getCapacity = vi.fn().mockResolvedValue(capacityDays);

    const response = await request(createTestApp({ getCapacity }))
      .get("/api/admin/capacity")
      .query({ from: "2026-08-21", to: "2026-08-24" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ days: capacityDays });
    expect(getCapacity).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "2026-08-21",
        to: "2026-08-24",
      }),
    );
  });

  it("returns service validation errors for invalid capacity ranges", async () => {
    const error = new AdminReadValidationError({
      endDate: "End date must not be before start date.",
    });
    const getCapacity = vi.fn().mockRejectedValue(error);

    const response = await request(createTestApp({ getCapacity }))
      .get("/api/admin/capacity")
      .query({ from: "2026-08-25", to: "2026-08-24" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: error.message,
      fields: error.fields,
    });
  });

  it("returns 400 for capacity dates with invalid months", async () => {
    const response = await request(
      createTestApp({
        getCapacity: async (query) => {
          parseCapacityQuery(query);
          return [];
        },
      }),
    )
      .get("/api/admin/capacity")
      .query({ from: "2026-00-01", to: "2026-08-24" });

    expect(response.status).toBe(400);
    expect(response.body.fields.from).toEqual(expect.any(String));
  });

  it("does not expose persistence failures while loading capacity", async () => {
    const response = await request(
      createTestApp({
        getCapacity: async () => {
          throw new Error("database path and customer data");
        },
      }),
    ).get("/api/admin/capacity");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: "We could not load capacity. Please try again.",
    });
  });
});
