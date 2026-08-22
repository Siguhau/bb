import { randomBytes } from "node:crypto";

export type CustomerAccessGrant = {
  token: string;
  expiresAt: string;
};

type StoredGrant = {
  orderIds: Set<string>;
  expiresAt: number;
};

const grants = new Map<string, StoredGrant>();

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsedValue = Number(value);
  return Number.isInteger(parsedValue) && parsedValue > 0
    ? parsedValue
    : fallback;
}

export function issueCustomerAccessGrant(
  orderIds: string[],
): CustomerAccessGrant {
  const token = randomBytes(32).toString("base64url");
  const expiresAt =
    Date.now() +
    positiveInteger(process.env.CUSTOMER_ACCESS_GRANT_TTL_SECONDS, 900) * 1_000;

  grants.set(token, { orderIds: new Set(orderIds), expiresAt });

  return { token, expiresAt: new Date(expiresAt).toISOString() };
}

export function grantAllowsOrder(token: string, orderId: string): boolean {
  const grant = grants.get(token);

  if (!grant) return false;
  if (grant.expiresAt <= Date.now()) {
    grants.delete(token);
    return false;
  }

  return grant.orderIds.has(orderId);
}
