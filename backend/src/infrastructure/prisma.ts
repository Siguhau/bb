import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export async function configureSqlite(
  client: PrismaClient = prisma,
): Promise<void> {
  await client.$queryRawUnsafe("PRAGMA journal_mode = WAL");
  await client.$queryRawUnsafe("PRAGMA busy_timeout = 5000");
}
