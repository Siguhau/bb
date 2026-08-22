import type { PrismaClient } from "@prisma/client";

import { prisma } from "../infrastructure/prisma.js";

const orderSelection = {
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
    select: orderSelection,
    orderBy: { createdAt: "desc" },
  });

  return orders.map(({ serviceTypes, ...order }) => ({
    ...order,
    serviceTypes: serviceTypes.map(({ serviceType }) => serviceType),
  }));
}

export type CustomerOrder = Awaited<ReturnType<typeof lookupOrders>>[number];
