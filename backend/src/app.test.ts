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
  it("requires administrator authentication for admin data routes", async () => {
    const response = await request(createApp()).get("/api/admin/orders");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "Administrator authentication is required.",
    });
  });
});
