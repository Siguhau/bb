import { Prisma, type PrismaClient } from "@prisma/client";

import {
  calculateDiscountedTotal,
  calculateTotalCost,
  getServiceType,
  type ServiceTypeCode,
} from "../domain/order.js";
import { prisma } from "../infrastructure/prisma.js";

export const completeOrderSelection = {
  id: true,
  reference: true,
  customerName: true,
  phoneNumber: true,
  emailAddress: true,
  bikeBrand: true,
  expectedDueDate: true,
  status: true,
  notes: true,
  discountCode: true,
  createdAt: true,
  updatedAt: true,
  serviceTypes: {
    select: {
      serviceType: {
        select: { code: true, displayName: true },
      },
    },
    orderBy: { serviceTypeCode: "asc" },
  },
} as const satisfies Prisma.OrderSelect;

type StoredOrder = Prisma.OrderGetPayload<{
  select: typeof completeOrderSelection;
}>;

export type CompleteOrder = Omit<StoredOrder, "serviceTypes"> & {
  serviceTypes: Array<{
    code: ServiceTypeCode;
    displayName: string;
    cost: number;
  }>;
  subtotalCost: number;
  discountAmount: number;
  totalCost: number;
};

export type AdminOrderFilters = {
  search?: string;
  status?: string;
  serviceType?: string;
  dueDate?: string;
};

export type CapacityUsage = { dueDate: string; used: number };

export interface AdminOrderRepository {
  listOrders(filters: AdminOrderFilters): Promise<CompleteOrder[]>;
  findOrder(id: string): Promise<CompleteOrder | null>;
  listCapacityUsage(from: string, to: string): Promise<CapacityUsage[]>;
}

type AdminReadClient = Pick<PrismaClient, "order" | "capacityReservation">;

function toCompleteOrder({
  serviceTypes,
  ...order
}: StoredOrder): CompleteOrder {
  const pricedServiceTypes = serviceTypes.map(({ serviceType }) =>
    getServiceType(serviceType.code as ServiceTypeCode),
  );
  const subtotalCost = calculateTotalCost(
    pricedServiceTypes.map(({ code }) => code),
  );
  const totalCost = calculateDiscountedTotal(subtotalCost, order.discountCode);

  return {
    ...order,
    serviceTypes: pricedServiceTypes,
    subtotalCost,
    discountAmount: subtotalCost - totalCost,
    totalCost,
  };
}

export function createPrismaAdminOrderRepository(
  client: AdminReadClient = prisma,
): AdminOrderRepository {
  return {
    async listOrders({ search, status, serviceType, dueDate }) {
      const orders = await client.order.findMany({
        where: {
          ...(search
            ? {
                OR: [
                  { reference: { contains: search } },
                  { customerName: { contains: search } },
                  { emailAddress: { contains: search } },
                  { phoneNumber: { contains: search } },
                  { bikeBrand: { contains: search } },
                ],
              }
            : {}),
          ...(status ? { status } : {}),
          ...(dueDate ? { expectedDueDate: dueDate } : {}),
          ...(serviceType
            ? { serviceTypes: { some: { serviceTypeCode: serviceType } } }
            : {}),
        },
        select: completeOrderSelection,
        orderBy: [
          { expectedDueDate: "asc" },
          { createdAt: "desc" },
          { id: "asc" },
        ],
      });

      return orders.map(toCompleteOrder);
    },

    async findOrder(id) {
      const order = await client.order.findUnique({
        where: { id },
        select: completeOrderSelection,
      });
      return order ? toCompleteOrder(order) : null;
    },

    async listCapacityUsage(from, to) {
      const usage = await client.capacityReservation.groupBy({
        by: ["dueDate"],
        where: { dueDate: { gte: from, lte: to } },
        _count: { _all: true },
        orderBy: { dueDate: "asc" },
      });

      return usage.map(({ dueDate, _count }) => ({
        dueDate,
        used: _count._all,
      }));
    },
  };
}

export const prismaAdminOrderRepository = createPrismaAdminOrderRepository();
