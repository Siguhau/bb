import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  createAdministratorSession,
  findAdministratorForSession,
  hashAdministratorPassword,
  hashSessionToken,
  InvalidAdministratorCredentialsError,
  provisionAdministrator,
  revokeAdministratorSession,
  verifyAdministratorPassword,
} from "./admin-auth.js";

describe("administrator passwords", () => {
  it("uses salted scrypt hashes and verifies only the correct password", async () => {
    const first = await hashAdministratorPassword(
      "correct horse battery staple",
    );
    const second = await hashAdministratorPassword(
      "correct horse battery staple",
    );

    expect(first).toMatch(/^scrypt\$/);
    expect(first).not.toBe(second);
    await expect(
      verifyAdministratorPassword("correct horse battery staple", first),
    ).resolves.toBe(true);
    await expect(
      verifyAdministratorPassword("wrong password", first),
    ).resolves.toBe(false);
  });
});

describe("administrator provisioning", () => {
  it("normalizes email and never stores the plaintext password", async () => {
    const create = vi
      .fn()
      .mockImplementation(({ data }) => ({ id: "admin-1", email: data.email }));
    const client = {
      administrator: { findUnique: vi.fn().mockResolvedValue(null), create },
    } as unknown as PrismaClient;

    const result = await provisionAdministrator(
      {
        email: "  ADMIN@Example.com ",
        password: "a sufficiently long password",
      },
      client,
    );

    expect(result).toEqual({
      administrator: { id: "admin-1", email: "admin@example.com" },
      created: true,
    });
    expect(create.mock.calls[0]![0].data.passwordHash).not.toContain(
      "a sufficiently long password",
    );
  });

  it("does not silently reset an existing account password", async () => {
    const create = vi.fn();
    const client = {
      administrator: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: "admin-1", email: "admin@example.com" }),
        create,
      },
    } as unknown as PrismaClient;

    await expect(
      provisionAdministrator(
        {
          email: "ADMIN@example.com",
          password: "a sufficiently long password",
        },
        client,
      ),
    ).resolves.toMatchObject({ created: false });
    expect(create).not.toHaveBeenCalled();
  });
});

describe("administrator sessions", () => {
  it("stores only a digest of the opaque token with an exact expiry", async () => {
    const passwordHash = await hashAdministratorPassword("correct password");
    const create = vi.fn().mockResolvedValue({});
    const client = {
      administrator: {
        findUnique: vi.fn().mockResolvedValue({
          id: "admin-1",
          email: "admin@example.com",
          passwordHash,
        }),
      },
      adminSession: { create },
    } as unknown as PrismaClient;

    const result = await createAdministratorSession(
      { email: "ADMIN@example.com", password: "correct password" },
      {
        client,
        now: () => new Date("2026-08-22T08:00:00Z"),
        sessionTtlMs: 60_000,
        createToken: () => "raw-secret-token".repeat(3),
      },
    );

    expect(result.expiresAt).toEqual(new Date("2026-08-22T08:01:00Z"));
    expect(create.mock.calls[0]![0].data).toMatchObject({
      administratorId: "admin-1",
      tokenHash: hashSessionToken(result.token),
      expiresAt: result.expiresAt,
    });
    expect(JSON.stringify(create.mock.calls[0]![0])).not.toContain(
      `"${result.token}"`,
    );
  });

  it("uses a generic credential error for missing accounts", async () => {
    const client = {
      administrator: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaClient;

    await expect(
      createAdministratorSession(
        { email: "missing@example.com", password: "wrong" },
        { client, sessionTtlMs: 60_000 },
      ),
    ).rejects.toBeInstanceOf(InvalidAdministratorCredentialsError);
  });

  it("rejects a session exactly at its expiry boundary", async () => {
    const client = {
      adminSession: {
        findUnique: vi.fn().mockResolvedValue({
          expiresAt: new Date("2026-08-22T08:00:00Z"),
          administrator: { id: "admin-1", email: "admin@example.com" },
        }),
      },
    } as unknown as PrismaClient;

    await expect(
      findAdministratorForSession("raw-token", {
        client,
        now: () => new Date("2026-08-22T08:00:00Z"),
      }),
    ).resolves.toBeNull();
  });

  it("revokes by token digest rather than raw token", async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const client = { adminSession: { deleteMany } } as unknown as PrismaClient;

    await revokeAdministratorSession("raw-token", client);

    expect(deleteMany).toHaveBeenCalledWith({
      where: { tokenHash: hashSessionToken("raw-token") },
    });
  });
});
