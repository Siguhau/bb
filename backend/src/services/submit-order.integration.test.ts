import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { configureSqlite } from '../infrastructure/prisma.js';
import { submitOrder } from './submit-order.js';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(
  testDirectory,
  '../../prisma/migrations/20260822170000_create_orders_model/migration.sql',
);

let temporaryDirectory: string;
let client: PrismaClient;
let referenceSequence = 0;

function nextReference(): string {
  referenceSequence += 1;
  return referenceSequence.toString(36).toUpperCase().padStart(8, '0');
}

function input(index: number, serviceTypes = ['BRAKE_MAINTENANCE']) {
  return {
    customerName: `Customer ${index}`,
    phoneNumber: `+47 123 45 ${String(index).padStart(3, '0')}`,
    emailAddress: `customer-${index}@example.com`,
    bikeBrand: 'Trek',
    serviceTypes,
  };
}

beforeAll(async () => {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'bouvet-bike-submission-'));
  client = new PrismaClient({
    datasourceUrl: `file:${path.join(temporaryDirectory, 'test.db')}`,
  });
  const migration = await readFile(migrationPath, 'utf8');

  for (const statement of migration.split(/;\s*(?:\r?\n|$)/)) {
    if (statement.trim()) await client.$executeRawUnsafe(statement);
  }

  await configureSqlite(client);
});

afterAll(async () => {
  await client.$disconnect();
  await rm(temporaryDirectory, { recursive: true, force: true });
});

describe('submitOrder with SQLite', () => {
  it('keeps six concurrent submissions within weekday capacity', async () => {
    const orders = await Promise.all(Array.from({ length: 6 }, (_, index) => submitOrder(
      input(index),
      {
        client,
        generateReference: nextReference,
        now: () => new Date('2026-08-21T10:00:00Z'),
      },
    )));

    expect(orders.filter(({ expectedDueDate }) => expectedDueDate === '2026-08-24')).toHaveLength(5);
    expect(orders.filter(({ expectedDueDate }) => expectedDueDate === '2026-08-25')).toHaveLength(1);

    const reservations = await client.capacityReservation.groupBy({
      by: ['dueDate'],
      _count: true,
      orderBy: { dueDate: 'asc' },
    });
    expect(reservations).toEqual([
      { dueDate: '2026-08-24', _count: 5 },
      { dueDate: '2026-08-25', _count: 1 },
    ]);
  }, 20_000);

  it('generates another reference when the first one already exists', async () => {
    const existingOrder = await client.order.findFirstOrThrow();
    const references = [existingOrder.reference, 'COLLIDE2'];

    const order = await submitOrder(input(7), {
      client,
      generateReference: () => references.shift()!,
      now: () => new Date('2026-08-21T10:00:00Z'),
    });

    expect(order.reference).toBe('COLLIDE2');
  });

  it('rolls back the order when a nested service write fails', async () => {
    await client.serviceType.delete({ where: { code: 'CHAIN_REPLACEMENT' } });
    const countBefore = await client.order.count();

    await expect(submitOrder(input(8, ['CHAIN_REPLACEMENT']), {
      client,
      generateReference: () => 'ROLLBACK',
      now: () => new Date('2026-08-21T10:00:00Z'),
    })).rejects.toThrow();

    await expect(client.order.count()).resolves.toBe(countBefore);
    await expect(client.order.findUnique({ where: { reference: 'ROLLBACK' } })).resolves.toBeNull();
  });
});
