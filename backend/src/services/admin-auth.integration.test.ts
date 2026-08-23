import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createAdministratorSession,
  findAdministratorForSession,
  hashSessionToken,
  provisionAdministrator,
  revokeAdministratorSession,
} from "./admin-auth.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationPaths = [
  "../../prisma/migrations/20260822170000_create_orders_model/migration.sql",
  "../../prisma/migrations/20260822200000_create_admin_identity/migration.sql",
].map((value) => path.resolve(testDirectory, value));

let temporaryDirectory: string;
let client: PrismaClient;

async function applyMigration(migrationPath: string): Promise<void> {
  const migration = await readFile(migrationPath, "utf8");
  for (const statement of migration.split(/;\s*(?:\r?\n|$)/)) {
    if (statement.trim()) await client.$executeRawUnsafe(statement);
  }
}

beforeAll(async () => {
  temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), "bouvet-bike-admin-auth-"),
  );
  client = new PrismaClient({
    datasourceUrl: `file:${path.join(temporaryDirectory, "test.db")}`,
  });
  for (const migrationPath of migrationPaths)
    await applyMigration(migrationPath);
});

afterAll(async () => {
  await client.$disconnect();
  await rm(temporaryDirectory, { recursive: true, force: true });
});

describe("administrator authentication with SQLite", () => {
  it("persists a provisioned account and a hashed expiring session", async () => {
    const provisioned = await provisionAdministrator(
      {
        email: " ADMIN@example.com ",
        password: "correct horse battery staple",
      },
      client,
    );
    expect(provisioned).toMatchObject({
      administrator: { email: "admin@example.com" },
      created: true,
    });

    const session = await createAdministratorSession(
      { email: "admin@example.com", password: "correct horse battery staple" },
      {
        client,
        now: () => new Date("2026-08-22T08:00:00Z"),
        sessionTtlMs: 60_000,
        createToken: () => "persistent-opaque-session-token-value",
      },
    );
    const stored = await client.adminSession.findFirstOrThrow();
    expect(stored.tokenHash).toBe(hashSessionToken(session.token));
    expect(stored.tokenHash).not.toBe(session.token);
    expect(stored.expiresAt).toEqual(new Date("2026-08-22T08:01:00Z"));

    const reconnectedClient = new PrismaClient({
      datasourceUrl: `file:${path.join(temporaryDirectory, "test.db")}`,
    });
    await expect(
      findAdministratorForSession(session.token, {
        client: reconnectedClient,
        now: () => new Date("2026-08-22T08:00:59Z"),
      }),
    ).resolves.toEqual(provisioned.administrator);
    await reconnectedClient.$disconnect();

    await revokeAdministratorSession(session.token, client);
    await expect(client.adminSession.count()).resolves.toBe(0);
  });

  it("keeps provisioning idempotent without changing the password", async () => {
    const result = await provisionAdministrator(
      { email: "ADMIN@example.com", password: "a different long password" },
      client,
    );

    expect(result.created).toBe(false);
    await expect(client.administrator.count()).resolves.toBe(1);
    await expect(
      createAdministratorSession(
        { email: "admin@example.com", password: "a different long password" },
        { client, sessionTtlMs: 60_000 },
      ),
    ).rejects.toThrow("Invalid administrator credentials");
  });

  it("cascades sessions when an administrator is deleted", async () => {
    const session = await createAdministratorSession(
      { email: "admin@example.com", password: "correct horse battery staple" },
      { client, sessionTtlMs: 60_000 },
    );
    expect(session.token).toBeTruthy();

    await client.administrator.delete({
      where: { email: "admin@example.com" },
    });
    await expect(client.adminSession.count()).resolves.toBe(0);
  });
});
