import type { Order } from "./order";
import type { ServiceType as OrderServiceType } from "./order";

export type ServiceType = Pick<OrderServiceType, "code" | "displayName">;

export type CustomerOrder = Omit<Order, "serviceTypes"> & {
  serviceTypes: ServiceType[];
};

export type CustomerAccessGrant = {
  token: string;
  expiresAt: string;
};

export type CustomerOrderLookup = {
  orders: CustomerOrder[];
  accessGrant: CustomerAccessGrant;
};

export type SubmittedOrder = {
  reference: string;
  expectedDueDate: string;
  status: "NEW";
};
