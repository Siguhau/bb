import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "../infrastructure/prisma.js";

export const customerOrderSelection = {
  id: true,
  reference: true,
  customerName: true,
  phoneNumber: true,
  emailAddress: true,
  bikeBrand: true,
  expectedDueDate: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  serviceTypes: {
    select: {
      serviceType: {
        select: {
          code: true,
          displayName: true,
        },
      },
    },
  },
} as const;

type OrderLookupClient = Pick<PrismaClient, "order">;
type CustomerOrderRecord = Prisma.OrderGetPayload<{
  select: typeof customerOrderSelection;
}>;

export type CustomerOrder = Omit<CustomerOrderRecord, "serviceTypes"> & {
  serviceTypes: CustomerOrderRecord["serviceTypes"][number]["serviceType"][];
};

export async function lookupOrders(
  value: string,
  client: OrderLookupClient = prisma,
) {
  const orders = await client.order.findMany({
    where: {
      OR: [
        { reference: value },
        { emailAddress: value },
        { phoneNumber: value },
      ],
    },
    select: customerOrderSelection,
    orderBy: { createdAt: "desc" },
  });

  return orders.map(toCustomerOrder);
}

export function toCustomerOrder({
  serviceTypes,
  ...order
}: CustomerOrderRecord): CustomerOrder {
  return {
    ...order,
    serviceTypes: serviceTypes.map(({ serviceType }) => serviceType),
  };
}
