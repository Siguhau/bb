import { afterEach, describe, expect, it, vi } from "vitest";

import {
  grantAllowsOrder,
  issueCustomerAccessGrant,
} from "./customer-access-grants.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("customer access grants", () => {
  it("grants access only to matching orders until expiry", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-22T08:00:00Z"));
    const grant = issueCustomerAccessGrant(["order-1", "order-2"]);

    expect(grant.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(grantAllowsOrder(grant.token, "order-1")).toBe(true);
    expect(grantAllowsOrder(grant.token, "other-order")).toBe(false);

    vi.advanceTimersByTime(15 * 60 * 1_000);
    expect(grantAllowsOrder(grant.token, "order-1")).toBe(false);
  });
});
