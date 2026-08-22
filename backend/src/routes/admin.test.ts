import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { ADMIN_SESSION_COOKIE_NAME } from "../config/admin-auth.js";
import type { AdminLoginRateLimiter } from "../middleware/admin-login-rate-limit.js";
import { InvalidAdministratorCredentialsError } from "../services/admin-auth.js";
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
