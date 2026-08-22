import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { ADMIN_SESSION_COOKIE_NAME } from "../config/admin-auth.js";
import { createRequireAdministrator } from "./admin-auth.js";

const token = "t".repeat(43);

function protectedApp(
  findAdministrator: Parameters<typeof createRequireAdministrator>[0],
) {
  const app = express();
  app.get(
    "/protected",
    createRequireAdministrator(findAdministrator),
    (_request, response) => response.json(response.locals.administrator),
  );
  return app;
}

describe("administrator authentication middleware", () => {
  it("rejects requests without a session before the handler runs", async () => {
    const findAdministrator = vi.fn();
    const response = await request(protectedApp(findAdministrator)).get(
      "/protected",
    );

    expect(response.status).toBe(401);
    expect(findAdministrator).not.toHaveBeenCalled();
  });

  it("rejects unknown or expired sessions with the same response", async () => {
    const response = await request(protectedApp(async () => null))
      .get("/protected")
      .set("Cookie", `${ADMIN_SESSION_COOKIE_NAME}=${token}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "Administrator authentication is required.",
    });
  });

  it("makes only the safe administrator identity available downstream", async () => {
    const findAdministrator = vi
      .fn()
      .mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
    const response = await request(protectedApp(findAdministrator))
      .get("/protected")
      .set("Cookie", `unrelated=value; ${ADMIN_SESSION_COOKIE_NAME}=${token}`);

    expect(response.status).toBe(200);
    expect(findAdministrator).toHaveBeenCalledWith(token);
    expect(response.body).toEqual({
      id: "admin-1",
      email: "admin@example.com",
    });
  });

  it("uses a safe error when session persistence fails", async () => {
    const response = await request(
      protectedApp(async () => {
        throw new Error("database and token details");
      }),
    )
      .get("/protected")
      .set("Cookie", `${ADMIN_SESSION_COOKIE_NAME}=${token}`);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: "We could not verify administrator access.",
    });
  });
});
