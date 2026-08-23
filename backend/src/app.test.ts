import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "./app.js";

describe("GET /api/health", () => {
  it("returns the service status", async () => {
    const response = await request(createApp()).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});

describe("admin access", () => {
  it("fails closed when admin authentication has not been configured", async () => {
    const response = await request(createApp()).get("/api/admin/orders");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      error: "Admin authentication is not configured.",
    });
  });
});
