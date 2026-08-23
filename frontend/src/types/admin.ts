import type { ServiceType } from "./customer";

export type AdminOrderStatus =
  | "NEW"
  | "IN_PROGRESS"
  | "WAITING_FOR_CUSTOMER_PICKUP"
  | "COMPLETED"
  | "CANCELLED";
export type AdminStatusOption = {
  code: AdminOrderStatus;
  displayName: string;
};
export type Administrator = { id: string; email: string };

export type AdminOrder = {
  id: string;
  reference: string;
  customerName: string;
  phoneNumber: string;
  emailAddress: string;
  bikeBrand: string;
  expectedDueDate: string;
  status: AdminOrderStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  serviceTypes: ServiceType[];
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
  status: AdminOrderStatus;
}>;

export type CapacityDay = {
  date: string;
  used: number;
  capacity: number;
  display: string;
};
