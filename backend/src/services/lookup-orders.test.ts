import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { lookupOrders } from './lookup-orders.js';

describe('lookupOrders', () => {
  it.each([
    'A1B2C3D4',
    'ada@example.com',
    '+47 123 45 678',
  ])('queries reference, email, and phone using the exact value %s', async (value) => {
    const findMany = vi.fn().mockResolvedValue([]);
    const client = { order: { findMany } } as unknown as Pick<PrismaClient, 'order'>;

    await lookupOrders(value, client);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        OR: [
          { reference: value },
          { emailAddress: value },
          { phoneNumber: value },
        ],
      },
    }));
  });
});
