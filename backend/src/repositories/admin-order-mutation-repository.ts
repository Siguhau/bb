import { Prisma, type PrismaClient } from "@prisma/client";

import type { OrderStatus, ServiceTypeCode } from "../domain/order.js";
import { prisma } from "../infrastructure/prisma.js";

export type MutableOrder = {
  id: string;
  expectedDueDate: string;
  status: OrderStatus;
  capacityReservation: { dueDate: string; slot: number } | null;
};

export type AdminOrderMutationData = {
  notes?: string | null;
  serviceTypes?: ServiceTypeCode[];
  expectedDueDate?: string;
  status?: OrderStatus;
};

export type AdminOrderMutationResult = {
  id: string;
  reference: string;
  customerName: string;
  phoneNumber: string;
  emailAddress: string;
  bikeBrand: string;
  expectedDueDate: string;
  status: OrderStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  serviceTypes: Array<{ code: ServiceTypeCode; displayName: string }>;
};

export interface AdminOrderMutationTransaction {
  findOrder(id: string): Promise<MutableOrder | null>;
  findReservedSlots(dueDate: string): Promise<number[]>;
  deleteReservation(orderId: string): Promise<void>;
  createReservation(
    orderId: string,
    dueDate: string,
    slot: number,
  ): Promise<void>;
  updateOrder(
    orderId: string,
    data: AdminOrderMutationData,
  ): Promise<AdminOrderMutationResult>;
  deleteOrder(orderId: string): Promise<void>;
}

export interface AdminOrderMutationRepository {
  transaction<T>(
    operation: (transaction: AdminOrderMutationTransaction) => Promise<T>,
  ): Promise<T>;
}

const orderResultSelect = {
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
      serviceType: { select: { code: true, displayName: true } },
    },
    orderBy: { serviceTypeCode: "asc" as const },
  },
} satisfies Prisma.OrderSelect;

export class PrismaAdminOrderMutationRepository implements AdminOrderMutationRepository {
  constructor(
    private readonly client: Pick<PrismaClient, "$transaction"> = prisma,
  ) {}

  async transaction<T>(
    operation: (transaction: AdminOrderMutationTransaction) => Promise<T>,
  ): Promise<T> {
    return this.client.$transaction(
      async (client) =>
        operation({
          async findOrder(id) {
            const order = await client.order.findUnique({
              where: { id },
              select: {
                id: true,
                expectedDueDate: true,
                status: true,
                capacityReservation: {
                  select: { dueDate: true, slot: true },
                },
              },
            });

            return order as MutableOrder | null;
          },
          async findReservedSlots(dueDate) {
            const reservations = await client.capacityReservation.findMany({
              where: { dueDate },
              select: { slot: true },
            });
            return reservations.map(({ slot }) => slot);
          },
          async deleteReservation(orderId) {
            await client.capacityReservation.deleteMany({ where: { orderId } });
          },
          async createReservation(orderId, dueDate, slot) {
            await client.capacityReservation.create({
              data: { orderId, dueDate, slot },
            });
          },
          async updateOrder(orderId, data) {
            const order = await client.order.update({
              where: { id: orderId },
              data: {
                notes: data.notes,
                expectedDueDate: data.expectedDueDate,
                status: data.status,
                serviceTypes:
                  data.serviceTypes === undefined
                    ? undefined
                    : {
                        deleteMany: {},
                        create: data.serviceTypes.map((code) => ({
                          serviceType: { connect: { code } },
                        })),
                      },
              },
              select: orderResultSelect,
            });

            return {
              ...order,
              status: order.status as OrderStatus,
              serviceTypes: order.serviceTypes.map(({ serviceType }) => ({
                ...serviceType,
                code: serviceType.code as ServiceTypeCode,
              })),
            };
          },
          async deleteOrder(orderId) {
            await client.order.delete({ where: { id: orderId } });
          },
        }),
      { maxWait: 5_000, timeout: 10_000 },
    );
  }
}

export function isRetryableAdminOrderMutationError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    ["P1008", "P2002", "P2024", "P2028", "P2034"].includes(error.code)
  );
}
