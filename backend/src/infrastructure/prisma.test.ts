import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { configureSqlite } from './prisma.js';

describe('configureSqlite', () => {
  it('enables write-ahead logging and a busy timeout', async () => {
    const queryRawUnsafe = vi.fn().mockResolvedValue([]);
    const client = { $queryRawUnsafe: queryRawUnsafe } as unknown as PrismaClient;

    await configureSqlite(client);

    expect(queryRawUnsafe).toHaveBeenNthCalledWith(1, 'PRAGMA journal_mode = WAL');
    expect(queryRawUnsafe).toHaveBeenNthCalledWith(2, 'PRAGMA busy_timeout = 5000');
  });
});
