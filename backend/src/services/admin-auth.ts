import type { PrismaClient } from "@prisma/client";
import {
  createHash,
  randomBytes,
  scrypt as nodeScrypt,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

import { prisma } from "../infrastructure/prisma.js";

const SCRYPT_COST = 16_384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_MAX_MEMORY = 32 * 1024 * 1024;
const DUMMY_PASSWORD_HASH = encodePasswordHash(
  Buffer.from("bouvet-bike-auth", "utf8"),
  scryptSync("not-a-real-password", "bouvet-bike-auth", SCRYPT_KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
    maxmem: SCRYPT_MAX_MEMORY,
  }),
);

type AdminAuthClient = Pick<PrismaClient, "administrator" | "adminSession">;

export type AuthenticatedAdministrator = { id: string; email: string };

export class InvalidAdministratorCredentialsError extends Error {}
export class AdministratorProvisioningError extends Error {}

function derivePasswordKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(
      password,
      salt,
      SCRYPT_KEY_LENGTH,
      {
        N: SCRYPT_COST,
        r: SCRYPT_BLOCK_SIZE,
        p: SCRYPT_PARALLELIZATION,
        maxmem: SCRYPT_MAX_MEMORY,
      },
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      },
    );
  });
}

function encodePasswordHash(salt: Buffer, derivedKey: Buffer): string {
  return [
    "scrypt",
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELIZATION,
    salt.toString("base64url"),
    derivedKey.toString("base64url"),
  ].join("$");
}

export async function hashAdministratorPassword(
  password: string,
): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = await derivePasswordKey(password, salt);
  return encodePasswordHash(salt, derivedKey);
}

export async function verifyAdministratorPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  const [algorithm, cost, blockSize, parallelization, saltValue, keyValue] =
    encodedHash.split("$");
  if (
    algorithm !== "scrypt" ||
    Number(cost) !== SCRYPT_COST ||
    Number(blockSize) !== SCRYPT_BLOCK_SIZE ||
    Number(parallelization) !== SCRYPT_PARALLELIZATION ||
    !saltValue ||
    !keyValue
  ) {
    return false;
  }

  const expectedKey = Buffer.from(keyValue, "base64url");
  if (expectedKey.length !== SCRYPT_KEY_LENGTH) return false;

  const actualKey = await derivePasswordKey(
    password,
    Buffer.from(saltValue, "base64url"),
  );
  return timingSafeEqual(actualKey, expectedKey);
}

export function normalizeAdministratorEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

export async function provisionAdministrator(
  input: { email: string; password: string },
  client: AdminAuthClient = prisma,
): Promise<{ administrator: AuthenticatedAdministrator; created: boolean }> {
  const email = normalizeAdministratorEmail(input.email);
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
    throw new AdministratorProvisioningError(
      "Enter a valid administrator email address.",
    );
  }
  if (input.password.length < 12 || input.password.length > 1_024) {
    throw new AdministratorProvisioningError(
      "Administrator passwords must contain between 12 and 1024 characters.",
    );
  }

  const existing = await client.administrator.findUnique({ where: { email } });
  if (existing) {
    return {
      administrator: { id: existing.id, email: existing.email },
      created: false,
    };
  }

  const passwordHash = await hashAdministratorPassword(input.password);
  const administrator = await client.administrator.create({
    data: { email, passwordHash },
    select: { id: true, email: true },
  });
  return { administrator, created: true };
}

export async function createAdministratorSession(
  input: { email: string; password: string },
  options: {
    client?: AdminAuthClient;
    now?: () => Date;
    sessionTtlMs: number;
    createToken?: () => string;
  },
): Promise<{
  administrator: AuthenticatedAdministrator;
  token: string;
  expiresAt: Date;
}> {
  const client = options.client ?? prisma;
  const email = normalizeAdministratorEmail(input.email);
  const administrator = await client.administrator.findUnique({
    where: { email },
  });
  const passwordMatches = await verifyAdministratorPassword(
    input.password,
    administrator?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );
  if (!administrator || !passwordMatches) {
    throw new InvalidAdministratorCredentialsError(
      "Invalid administrator credentials.",
    );
  }

  const token =
    options.createToken?.() ?? randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    (options.now?.() ?? new Date()).getTime() + options.sessionTtlMs,
  );
  await client.adminSession.create({
    data: {
      administratorId: administrator.id,
      tokenHash: hashSessionToken(token),
      expiresAt,
    },
  });

  return {
    administrator: { id: administrator.id, email: administrator.email },
    token,
    expiresAt,
  };
}

export async function findAdministratorForSession(
  token: string,
  options: { client?: AdminAuthClient; now?: () => Date } = {},
): Promise<AuthenticatedAdministrator | null> {
  const session = await (options.client ?? prisma).adminSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { administrator: { select: { id: true, email: true } } },
  });
  if (
    !session ||
    session.expiresAt.getTime() <= (options.now?.() ?? new Date()).getTime()
  ) {
    return null;
  }
  return session.administrator;
}

export async function revokeAdministratorSession(
  token: string,
  client: AdminAuthClient = prisma,
): Promise<void> {
  await client.adminSession.deleteMany({
    where: { tokenHash: hashSessionToken(token) },
  });
}
