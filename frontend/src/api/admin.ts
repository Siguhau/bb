import { ApiError, requestEmpty, requestJson } from "./client";
import type {
  Administrator,
  AdminOrder,
  AdminOrderFilters,
  AdminOrderPatch,
  AdminStatusOption,
  CapacityDay,
} from "../types/admin";
import type { ServiceType } from "../types/order";

const ADMIN_ERROR = "We could not complete the administrator request.";

export async function signInAdministrator(email: string, password: string) {
  const body = await requestJson<{ administrator?: Administrator }>(
    "/api/admin/session",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    },
    "We could not sign you in. Please try again.",
  );
  if (!body.administrator) throw new ApiError(ADMIN_ERROR);
  return body.administrator;
}

export function signOutAdministrator() {
  return requestEmpty(
    "/api/admin/session",
    { method: "DELETE" },
    "We could not sign you out. Please try again.",
  );
}

export async function getAdminOptions() {
  const body = await requestJson<{
    serviceTypes?: ServiceType[];
    statuses?: AdminStatusOption[];
    today?: string;
  }>(
    "/api/admin/options",
    undefined,
    "We could not load administrator options. Please try again.",
  );
  if (
    !Array.isArray(body.serviceTypes) ||
    !Array.isArray(body.statuses) ||
    typeof body.today !== "string"
  ) {
    throw new ApiError(ADMIN_ERROR);
  }
  return {
    serviceTypes: body.serviceTypes,
    statuses: body.statuses,
    today: body.today,
  };
}

function queryString(values: Record<string, string>) {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export async function getAdminOrders(filters: AdminOrderFilters) {
  const body = await requestJson<{ orders?: AdminOrder[] }>(
    `/api/admin/orders${queryString(filters)}`,
    undefined,
    "We could not load orders. Please try again.",
  );
  if (!Array.isArray(body.orders)) throw new ApiError(ADMIN_ERROR);
  return body.orders;
}

export async function getAdminCapacity(from: string, to: string) {
  const body = await requestJson<{ days?: CapacityDay[] }>(
    `/api/admin/capacity${queryString({ from, to })}`,
    undefined,
    "We could not load capacity. Please try again.",
  );
  if (!Array.isArray(body.days)) throw new ApiError(ADMIN_ERROR);
  return body.days;
}

export async function updateAdminOrder(id: string, patch: AdminOrderPatch) {
  const body = await requestJson<{ order?: AdminOrder }>(
    `/api/admin/orders/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
    "We could not update the order. Please try again.",
  );
  if (!body.order) throw new ApiError(ADMIN_ERROR);
  return body.order;
}

export function deleteAdminOrder(id: string) {
  return requestEmpty(
    `/api/admin/orders/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    "We could not delete the order. Please try again.",
  );
}
