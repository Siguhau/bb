import { describe, expect, it } from "vitest";

import { createAdminLoginRateLimiter } from "./admin-login-rate-limit.js";

describe("administrator login rate limiter", () => {
  it("blocks a client after repeated failures and resets after a successful login", () => {
    const limiter = createAdminLoginRateLimiter({
      attemptLimit: 2,
      blockDurationMs: 60_000,
    });

    limiter.recordFailure("client-1");
    expect(limiter.isBlocked("client-1")).toBe(false);
    limiter.recordFailure("client-1");
    expect(limiter.isBlocked("client-1")).toBe(true);
    expect(limiter.isBlocked("client-2")).toBe(false);
    limiter.reset("client-1");
    expect(limiter.isBlocked("client-1")).toBe(false);
  });

  it("unblocks a client when the configured block expires", () => {
    let now = 1_000;
    const limiter = createAdminLoginRateLimiter({
      attemptLimit: 1,
      blockDurationMs: 100,
      now: () => now,
    });

    limiter.recordFailure("client-1");
    expect(limiter.isBlocked("client-1")).toBe(true);
    now = 1_100;
    expect(limiter.isBlocked("client-1")).toBe(false);
  });
});
