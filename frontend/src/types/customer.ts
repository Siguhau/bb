import type { Order } from "./order";

export type { ServiceType } from "./order";

export type CustomerOrder = Order;

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
