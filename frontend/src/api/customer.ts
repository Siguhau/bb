import type {
  CustomerOrder,
  CustomerOrderLookup,
  ServiceType,
  SubmittedOrder,
} from "../types/customer";
import { ApiError, requestJson } from "./client";

const LOOKUP_ERROR = "We could not search for orders. Please try again.";
const ORDER_OPTIONS_ERROR =
  "We could not load the available services. Please try again.";
const SUBMISSION_ERROR = "We could not place your order. Please try again.";
const NOTES_UPDATE_ERROR = "We could not update your notes. Please try again.";
const DISCOUNT_VERIFICATION_ERROR =
  "We could not verify that discount code. Please try again.";

export type CustomerOrderSubmission = {
  customerName: string;
  phoneNumber: string;
  emailAddress: string;
  bikeBrand: string;
  serviceTypes: string[];
  notes: string;
  discountCode: string;
};

export type DiscountCodeVerification =
  | { valid: true; discountCode: string; discountPercentage: number }
  | { valid: false };

export async function getCustomerOrderOptions(): Promise<ServiceType[]> {
  const body = await requestJson<{ serviceTypes?: ServiceType[] }>(
    "/api/customer/order-options",
    undefined,
    ORDER_OPTIONS_ERROR,
  );

  if (!Array.isArray(body.serviceTypes))
    throw new ApiError(ORDER_OPTIONS_ERROR);
  return body.serviceTypes;
}

export async function lookupCustomerOrders(
  value: string,
): Promise<CustomerOrderLookup> {
  const body = await requestJson<{
    orders?: CustomerOrder[];
    accessGrant?: { token?: string; expiresAt?: string };
  }>(
    "/api/customer/order-lookups",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    },
    LOOKUP_ERROR,
  );

  if (
    !Array.isArray(body.orders) ||
    typeof body.accessGrant?.token !== "string" ||
    typeof body.accessGrant.expiresAt !== "string"
  ) {
    throw new ApiError(LOOKUP_ERROR);
  }

  return {
    orders: body.orders,
    accessGrant: {
      token: body.accessGrant.token,
      expiresAt: body.accessGrant.expiresAt,
    },
  };
}

export async function updateCustomerOrderNotes(
  orderId: string,
  notes: string,
  accessToken: string,
): Promise<CustomerOrder> {
  const body = await requestJson<{ order?: CustomerOrder }>(
    `/api/customer/orders/${encodeURIComponent(orderId)}/notes`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ notes: notes.trim() || null }),
    },
    NOTES_UPDATE_ERROR,
  );

  if (!body.order) throw new ApiError(NOTES_UPDATE_ERROR);
  return body.order;
}

export async function verifyDiscountCode(
  discountCode: string,
): Promise<DiscountCodeVerification> {
  const body = await requestJson<{
    valid?: unknown;
    discountCode?: unknown;
    discountPercentage?: unknown;
  }>(
    "/api/customer/discount-codes/verify",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discountCode: discountCode.trim() }),
    },
    DISCOUNT_VERIFICATION_ERROR,
  );

  if (body.valid === false) return { valid: false };
  if (
    body.valid === true &&
    typeof body.discountCode === "string" &&
    typeof body.discountPercentage === "number"
  ) {
    return {
      valid: true,
      discountCode: body.discountCode,
      discountPercentage: body.discountPercentage,
    };
  }

  throw new ApiError(DISCOUNT_VERIFICATION_ERROR);
}

export async function submitCustomerOrder(
  input: CustomerOrderSubmission,
): Promise<SubmittedOrder> {
  const body = await requestJson<{
    order?: SubmittedOrder;
    error?: string;
    fields?: Record<string, string>;
  }>(
    "/api/customer/orders",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: input.customerName.trim(),
        phoneNumber: input.phoneNumber.trim(),
        emailAddress: input.emailAddress.trim(),
        bikeBrand: input.bikeBrand.trim(),
        serviceTypes: input.serviceTypes,
        notes: input.notes.trim() || undefined,
        discountCode: input.discountCode.trim() || undefined,
      }),
    },
    SUBMISSION_ERROR,
  );

  if (!body.order)
    throw new ApiError(body.error ?? SUBMISSION_ERROR, body.fields);
  return body.order;
}
