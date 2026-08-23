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
    cost: 100,
  },
  {
    code: "CHAIN_REPLACEMENT",
    displayName: "Chain replacement",
    cost: 550,
  },
  {
    code: "BRAKE_MAINTENANCE",
    displayName: "Brake maintenance",
    cost: 300,
  },
  {
    code: "TIRE_REPLACEMENT",
    displayName: "Tire replacement",
    cost: 400,
  },
  {
    code: "BOUVET_DELUXE_TUNE_UP",
    displayName: "Bouvet Deluxe Tune-up",
    cost: 999,
  },
  {
    code: "OTHER",
    displayName: "Other",
    cost: 0,
  },
] as const;

export type ServiceTypeCode = (typeof SERVICE_TYPES)[number]["code"];

export type PricedServiceType = (typeof SERVICE_TYPES)[number];

export function getServiceType(code: ServiceTypeCode): PricedServiceType {
  return SERVICE_TYPES.find((serviceType) => serviceType.code === code)!;
}

export function calculateTotalCost(
  serviceTypes: readonly ServiceTypeCode[],
): number {
  return serviceTypes.reduce(
    (total, serviceType) => total + getServiceType(serviceType).cost,
    0,
  );
}

export const DISCOUNT_CODES = [
  {
    code: "BB50",
    percentage: 50,
  },
] as const;

export type DiscountCode = (typeof DISCOUNT_CODES)[number]["code"];
export type Discount = (typeof DISCOUNT_CODES)[number];

/**
 * Converts customer-entered discount code text to the canonical stored code.
 * An unrecognised code returns null.
 */
export function normalizeDiscountCode(value: string): DiscountCode | null {
  const normalized = value.trim().toUpperCase();
  const discount = DISCOUNT_CODES.find(({ code }) => code === normalized);
  return discount?.code ?? null;
}

export function getDiscount(
  discountCode: string | null | undefined,
): Discount | null {
  return DISCOUNT_CODES.find(({ code }) => code === discountCode) ?? null;
}

/** Returns the final whole-NOK amount after the configured discount. */
export function calculateDiscountedTotal(
  subtotal: number,
  discountCode: string | null | undefined,
): number {
  const discount = getDiscount(discountCode);
  if (!discount) return subtotal;

  return Math.ceil(subtotal * (1 - discount.percentage / 100));
}

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
