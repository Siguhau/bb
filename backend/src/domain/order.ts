export const ORDER_STATUSES = [
  "NEW",
  "IN_PROGRESS",
  "WAITING_FOR_CUSTOMER_PICKUP",
  "COMPLETED",
  "CANCELLED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const SERVICE_TYPES = [
  {
    code: "WHEEL_ADJUSTMENT",
    displayName: "Wheel adjustment",
  },
  {
    code: "CHAIN_REPLACEMENT",
    displayName: "Chain replacement",
  },
  {
    code: "BRAKE_MAINTENANCE",
    displayName: "Brake maintenance",
  },
  {
    code: "TIRE_REPLACEMENT",
    displayName: "Tire replacement",
  },
  {
    code: "BOUVET_DELUXE_TUNE_UP",
    displayName: "Bouvet Deluxe Tune-up",
  },
  {
    code: "OTHER",
    displayName: "Other",
  },
] as const;

export type ServiceTypeCode = (typeof SERVICE_TYPES)[number]["code"];

export const DAILY_CAPACITY = 5;
export const CAPACITY_SLOT_NUMBERS = [1, 2, 3, 4, 5] as const;
export type CapacitySlotNumber = (typeof CAPACITY_SLOT_NUMBERS)[number];

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

export function isServiceTypeCode(value: string): value is ServiceTypeCode {
  return SERVICE_TYPES.some((serviceType) => serviceType.code === value);
}

export function isCapacitySlotNumber(
  value: number,
): value is CapacitySlotNumber {
  return (CAPACITY_SLOT_NUMBERS as readonly number[]).includes(value);
}
