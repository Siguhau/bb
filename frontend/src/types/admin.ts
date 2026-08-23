import type { Order, OrderStatus } from "./order";

export type AdminStatusOption = {
  code: OrderStatus;
  displayName: string;
};
export type Administrator = { id: string; email: string };

export type AdminOrder = Order & {
  createdAt: string;
  updatedAt: string;
  totalCost: number;
};

export type AdminOrderFilters = {
  search: string;
  status: string;
  serviceType: string;
  dueDate: string;
};

export type AdminOrderPatch = Partial<{
  notes: string | null;
  serviceTypes: string[];
  expectedDueDate: string;
  status: OrderStatus;
}>;

export type CapacityDay = {
  date: string;
  used: number;
  capacity: number;
  display: string;
};
