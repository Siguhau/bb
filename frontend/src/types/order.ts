export type OrderStatus =
  | "NEW"
  | "IN_PROGRESS"
  | "WAITING_FOR_CUSTOMER_PICKUP"
  | "COMPLETED"
  | "CANCELLED";

export type ServiceType = {
  code: string;
  displayName: string;
  cost: number;
};

export type Order = {
  id: string;
  reference: string;
  customerName: string;
  phoneNumber: string;
  emailAddress: string;
  bikeBrand: string;
  expectedDueDate: string;
  status: OrderStatus;
  notes: string | null;
  serviceTypes: ServiceType[];
};
