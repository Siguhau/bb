import { describe, expect, it, vi } from "vitest";

import type { AdminOrderRepository } from "../repositories/admin-order-repository.js";
import {
  AdminReadValidationError,
  createAdminReadService,
  parseAdminOrderQuery,
  parseCapacityQuery,
} from "./admin-read.js";

function repository(
  overrides: Partial<AdminOrderRepository> = {},
): AdminOrderRepository {
  return {
    listOrders: vi.fn().mockResolvedValue([]),
    findOrder: vi.fn().mockResolvedValue(null),
    listCapacityUsage: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe("admin order query validation", () => {
  it("trims and accepts all supported filters", () => {
    expect(
      parseAdminOrderQuery({
        search: "  Ada  ",
        status: "IN_PROGRESS",
        serviceType: "BRAKE_MAINTENANCE",
        dueDate: "2026-08-24",
      }),
    ).toEqual({
      search: "Ada",
      status: "IN_PROGRESS",
      serviceType: "BRAKE_MAINTENANCE",
      dueDate: "2026-08-24",
    });
  });

  it.each([
    [{ search: " " }, "search"],
    [{ search: "a".repeat(255) }, "search"],
    [{ status: "PENDING" }, "status"],
    [{ serviceType: "PAINTING" }, "serviceType"],
    [{ dueDate: "2026-02-30" }, "dueDate"],
    [{ dueDate: "2026-13-01" }, "dueDate"],
    [{ dueDate: "2026-2-03" }, "dueDate"],
    [{ status: ["NEW", "COMPLETED"] }, "status"],
    [{ page: "1" }, "query"],
  ])("rejects invalid order query %#", (query, field) => {
    expect(() => parseAdminOrderQuery(query)).toThrowError(
      expect.objectContaining<Partial<AdminReadValidationError>>({
        fields: expect.objectContaining({ [field]: expect.any(String) }),
      }),
    );
  });

  it("passes validated filters to the repository", async () => {
    const data = repository();
    const service = createAdminReadService(data);

    await service.listOrders({ status: "COMPLETED", dueDate: "2026-08-24" });

    expect(data.listOrders).toHaveBeenCalledWith({
      search: undefined,
      status: "COMPLETED",
      serviceType: undefined,
      dueDate: "2026-08-24",
    });
  });
});

describe("admin capacity reads", () => {
  it("accepts a 366-day inclusive range", () => {
    expect(
      parseCapacityQuery({ from: "2024-01-01", to: "2024-12-31" }),
    ).toEqual({ from: "2024-01-01", to: "2024-12-31" });
  });

  it("accepts a range ending on the last four-digit calendar date", () => {
    expect(
      parseCapacityQuery({ from: "9999-12-30", to: "9999-12-31" }),
    ).toEqual({ from: "9999-12-30", to: "9999-12-31" });
  });

  it.each([
    [{}, "from"],
    [{ from: "2026-08-24" }, "to"],
    [{ from: "2026-02-30", to: "2026-03-02" }, "from"],
    [{ from: "2026-00-01", to: "2026-03-02" }, "from"],
    [{ from: "2026-08-25", to: "2026-08-24" }, "to"],
    [{ from: "2024-01-01", to: "2025-01-01" }, "to"],
    [{ from: ["2026-08-24"], to: "2026-08-25" }, "from"],
    [{ from: "2026-08-24", to: "2026-08-25", extra: "x" }, "query"],
  ])("rejects invalid capacity query %#", (query, field) => {
    expect(() => parseCapacityQuery(query)).toThrowError(
      expect.objectContaining<Partial<AdminReadValidationError>>({
        fields: expect.objectContaining({ [field]: expect.any(String) }),
      }),
    );
  });

  it("returns every weekday with numeric and display capacity", async () => {
    const data = repository({
      listCapacityUsage: vi.fn().mockResolvedValue([
        { dueDate: "2026-08-21", used: 3 },
        { dueDate: "2026-08-24", used: 5 },
      ]),
    });
    const service = createAdminReadService(data);

    await expect(
      service.getCapacity({ from: "2026-08-21", to: "2026-08-25" }),
    ).resolves.toEqual([
      { date: "2026-08-21", used: 3, capacity: 5, display: "3 of 5" },
      { date: "2026-08-24", used: 5, capacity: 5, display: "5 of 5" },
      { date: "2026-08-25", used: 0, capacity: 5, display: "0 of 5" },
    ]);
    expect(data.listCapacityUsage).toHaveBeenCalledWith(
      "2026-08-21",
      "2026-08-25",
    );
  });

  it("stops without overflowing after the range's final date", async () => {
    const service = createAdminReadService(repository());

    await expect(
      service.getCapacity({ from: "9999-12-31", to: "9999-12-31" }),
    ).resolves.toEqual([
      { date: "9999-12-31", used: 0, capacity: 5, display: "0 of 5" },
    ]);
  });
});
