export type ServiceType = {
  code: string;
  displayName: string;
};

export type CustomerOrder = {
  id: string;
  reference: string;
  customerName: string;
  phoneNumber: string;
  emailAddress: string;
  bikeBrand: string;
  expectedDueDate: string;
  status: string;
  notes: string | null;
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
