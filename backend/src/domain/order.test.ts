import { describe, expect, it } from "vitest";

import {
  CAPACITY_SLOT_NUMBERS,
  DAILY_CAPACITY,
  ORDER_STATUSES,
  SERVICE_TYPES,
  calculateTotalCost,
  isCapacitySlotNumber,
  isOrderStatus,
  isServiceTypeCode,
} from "./order.js";

describe("order domain definitions", () => {
  it("defines the supported statuses and service types in one place", () => {
    expect(ORDER_STATUSES).toEqual([
      "NEW",
      "IN_PROGRESS",
      "WAITING_FOR_CUSTOMER_PICKUP",
      "COMPLETED",
      "CANCELLED",
    ]);
    expect(SERVICE_TYPES.map((serviceType) => serviceType.code)).toEqual([
      "WHEEL_ADJUSTMENT",
      "CHAIN_REPLACEMENT",
      "BRAKE_MAINTENANCE",
      "TIRE_REPLACEMENT",
      "BOUVET_DELUXE_TUNE_UP",
      "OTHER",
    ]);
    expect(SERVICE_TYPES.map(({ code, cost }) => ({ code, cost }))).toEqual([
      { code: "WHEEL_ADJUSTMENT", cost: 100 },
      { code: "CHAIN_REPLACEMENT", cost: 550 },
      { code: "BRAKE_MAINTENANCE", cost: 300 },
      { code: "TIRE_REPLACEMENT", cost: 400 },
      { code: "BOUVET_DELUXE_TUNE_UP", cost: 999 },
      { code: "OTHER", cost: 0 },
    ]);
  });

  it("keeps the reservation slots aligned with daily capacity", () => {
    expect(CAPACITY_SLOT_NUMBERS).toHaveLength(DAILY_CAPACITY);
    expect(isCapacitySlotNumber(1)).toBe(true);
    expect(isCapacitySlotNumber(5)).toBe(true);
    expect(isCapacitySlotNumber(0)).toBe(false);
    expect(isCapacitySlotNumber(6)).toBe(false);
  });

  it("recognizes only configured statuses and services", () => {
    expect(isOrderStatus("NEW")).toBe(true);
    expect(isOrderStatus("CANCELLED")).toBe(true);
    expect(isOrderStatus("PENDING")).toBe(false);
    expect(isServiceTypeCode("BRAKE_MAINTENANCE")).toBe(true);
    expect(isServiceTypeCode("TUNE_UP")).toBe(false);
  });

  it("calculates the total from configured service costs", () => {
    expect(calculateTotalCost(["WHEEL_ADJUSTMENT", "CHAIN_REPLACEMENT"])).toBe(
      650,
    );
  });
});
