import express, { type RequestHandler } from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { ADMIN_SESSION_COOKIE_NAME } from "../config/admin-auth.js";
import type { AdminLoginRateLimiter } from "../middleware/admin-login-rate-limit.js";
import type { CompleteOrder } from "../repositories/admin-order-repository.js";
import { InvalidAdministratorCredentialsError } from "../services/admin-auth.js";
import {
  AdminOrderCapacityUnavailableError,
  AdminOrderDeletionNotAllowedError,
  AdminOrderMutationValidationError,
  AdminOrderNotFoundError,
  deleteCancelledAdminOrder,
  updateAdminOrder,
} from "../services/admin-order-mutations.js";
import {
  AdminReadValidationError,
  parseAdminOrderQuery,
  parseCapacityQuery,
} from "../services/admin-read.js";
import { createAdminRouter } from "./admin.js";

const session = {
  administrator: { id: "admin-1", email: "admin@example.com" },
  token: "a".repeat(43),
  expiresAt: new Date("2026-08-23T08:00:00.000Z"),
};

function testApp(
  createSession = vi.fn().mockResolvedValue(session),
  revokeSession = vi.fn().mockResolvedValue(undefined),
  secureCookie = false,
  loginRateLimiter?: AdminLoginRateLimiter,
) {
  const app = express();
  app.use(express.json());
  app.use(
    "/api/admin",
    createAdminRouter({
      config: {
        sessionTtlMs: 28_800_000,
        secureCookie,
        loginAttemptLimit: 5,
        loginBlockDurationMs: 900_000,
      },
      createSession,
      revokeSession,
      loginRateLimiter,
    }),
  );
  return { app, createSession, revokeSession };
}

describe("POST /api/admin/session", () => {
  it("signs in without exposing password or session data", async () => {
    const { app, createSession } = testApp();
    const response = await request(app).post("/api/admin/session").send({
      email: "ADMIN@example.com",
      password: "correct horse battery staple",
    });

    expect(response.status).toBe(200);
    expect(createSession).toHaveBeenCalledWith({
      email: "ADMIN@example.com",
      password: "correct horse battery staple",
    });
    expect(response.body).toEqual({ administrator: session.administrator });
    expect(JSON.stringify(response.body)).not.toContain(session.token);
    const setCookie = response.headers["set-cookie"];
    const cookie = Array.isArray(setCookie) ? setCookie[0]! : setCookie!;
    expect(cookie).toContain(`${ADMIN_SESSION_COOKIE_NAME}=${session.token}`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/api/admin");
    expect(cookie).toContain("Max-Age=28800");
    expect(cookie).not.toContain("Secure");
  });

  it("marks the cookie Secure in production configuration", async () => {
    const response = await request(testApp(undefined, undefined, true).app)
      .post("/api/admin/session")
      .send({ email: "admin@example.com", password: "password" });

    const setCookie = response.headers["set-cookie"];
    const cookie = Array.isArray(setCookie) ? setCookie[0]! : setCookie!;
    expect(cookie).toContain("Secure");
  });

  it("uses the same generic response for unknown accounts and wrong passwords", async () => {
    const createSession = vi
      .fn()
      .mockRejectedValue(new InvalidAdministratorCredentialsError());
    const { app } = testApp(createSession);

    const response = await request(app)
      .post("/api/admin/session")
      .send({ email: "missing@example.com", password: "wrong" });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "Invalid email address or password.",
    });
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("validates the request before calling the authentication service", async () => {
    const { app, createSession } = testApp();
    const response = await request(app)
      .post("/api/admin/session")
      .send({ email: "admin@example.com" });

    expect(response.status).toBe(400);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("does not expose persistence errors", async () => {
    const { app } = testApp(
      vi.fn().mockRejectedValue(new Error("database path and password hash")),
    );
    const response = await request(app)
      .post("/api/admin/session")
      .send({ email: "admin@example.com", password: "password" });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: "We could not sign you in. Please try again.",
    });
  });

  it("blocks a client before invoking expensive password verification", async () => {
    const loginRateLimiter = {
      isBlocked: vi.fn().mockReturnValue(true),
      recordFailure: vi.fn(),
      reset: vi.fn(),
    };
    const { app, createSession } = testApp(
      undefined,
      undefined,
      false,
      loginRateLimiter,
    );
    const response = await request(app)
      .post("/api/admin/session")
      .send({ email: "admin@example.com", password: "password" });

    expect(response.status).toBe(429);
    expect(createSession).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/admin/session", () => {
  it("revokes the persisted session and clears the cookie", async () => {
    const { app, revokeSession } = testApp();
    const response = await request(app)
      .delete("/api/admin/session")
      .set("Cookie", `${ADMIN_SESSION_COOKIE_NAME}=${session.token}`);

    expect(response.status).toBe(204);
    expect(revokeSession).toHaveBeenCalledWith(session.token);
    const setCookie = response.headers["set-cookie"];
    const cookie = Array.isArray(setCookie) ? setCookie[0]! : setCookie!;
    expect(cookie).toContain(`${ADMIN_SESSION_COOKIE_NAME}=;`);
    expect(cookie).toContain("Path=/api/admin");
    expect(cookie).toContain("SameSite=Strict");
  });

  it("is idempotent when no session cookie is present", async () => {
    const { app, revokeSession } = testApp();
    const response = await request(app).delete("/api/admin/session");

    expect(response.status).toBe(204);
    expect(revokeSession).not.toHaveBeenCalled();
    expect(response.headers["set-cookie"]).toBeDefined();
  });

  it("retains the cookie when revocation fails so sign-out can be retried", async () => {
    const { app } = testApp(
      undefined,
      vi.fn().mockRejectedValue(new Error("database unavailable")),
    );
    const response = await request(app)
      .delete("/api/admin/session")
      .set("Cookie", `${ADMIN_SESSION_COOKIE_NAME}=${session.token}`);

    expect(response.status).toBe(500);
    expect(response.headers["set-cookie"]).toBeUndefined();
  });
});

const completeOrder: CompleteOrder = {
  id: "order-1",
  reference: "A1B2C3D4",
  customerName: "Ada Lovelace",
  phoneNumber: "+47 123 45 678",
  emailAddress: "ada@example.com",
  bikeBrand: "Trek",
  expectedDueDate: "2026-08-24",
  status: "NEW",
  notes: "Rear brake rubs",
  discountCode: null,
  subtotalCost: 300,
  discountAmount: 0,
  totalCost: 300,
  createdAt: new Date("2026-08-22T08:00:00Z"),
  updatedAt: new Date("2026-08-22T09:00:00Z"),
  serviceTypes: [
    { code: "BRAKE_MAINTENANCE", displayName: "Brake maintenance", cost: 300 },
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
  it("returns the backend-authoritative admin options", async () => {
    const response = await request(createTestApp()).get("/api/admin/options");

    expect(response.status).toBe(200);
    expect(response.body.serviceTypes).toEqual(expect.any(Array));
    expect(response.body.statuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "NEW", displayName: "New" }),
        expect.objectContaining({ code: "CANCELLED" }),
      ]),
    );
    expect(response.body.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

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

describe("admin mutation routes", () => {
  function mutationApp(
    updateOrder = vi.fn().mockResolvedValue(completeOrder),
    deleteOrder = vi.fn().mockResolvedValue(undefined),
  ) {
    const app = express();
    app.use(express.json());
    app.use(
      "/api/admin",
      createAdminRouter({
        authorize: (_request, _response, next) => next(),
        updateOrder: updateOrder as typeof updateAdminOrder,
        deleteOrder: deleteOrder as typeof deleteCancelledAdminOrder,
      }),
    );
    return { app, updateOrder, deleteOrder };
  }

  it("updates an order through the protected mutation service", async () => {
    const { app, updateOrder } = mutationApp();
    const patch = { status: "IN_PROGRESS", notes: "Started" };
    const response = await request(app)
      .patch("/api/admin/orders/order-1")
      .send(patch);

    expect(response.status).toBe(200);
    expect(response.body.order.reference).toBe(completeOrder.reference);
    expect(updateOrder).toHaveBeenCalledWith("order-1", patch);
  });

  it.each([
    [new AdminOrderMutationValidationError({ status: "Invalid" }), 400],
    [new AdminOrderNotFoundError(), 404],
    [new AdminOrderCapacityUnavailableError("2026-08-24"), 409],
  ])("maps update errors to safe HTTP responses", async (error, status) => {
    const response = await request(
      mutationApp(vi.fn().mockRejectedValue(error)).app,
    )
      .patch("/api/admin/orders/order-1")
      .send({ status: "IN_PROGRESS" });

    expect(response.status).toBe(status);
    expect(response.body.error).toEqual(expect.any(String));
  });

  it("permanently deletes a cancelled order", async () => {
    const { app, deleteOrder } = mutationApp();
    const response = await request(app).delete("/api/admin/orders/order-1");

    expect(response.status).toBe(204);
    expect(deleteOrder).toHaveBeenCalledWith("order-1");
  });

  it.each([
    [new AdminOrderNotFoundError(), 404],
    [new AdminOrderDeletionNotAllowedError(), 409],
  ])("maps delete errors to safe HTTP responses", async (error, status) => {
    const response = await request(
      mutationApp(undefined, vi.fn().mockRejectedValue(error)).app,
    ).delete("/api/admin/orders/order-1");

    expect(response.status).toBe(status);
    expect(response.body.error).toEqual(expect.any(String));
  });
});
