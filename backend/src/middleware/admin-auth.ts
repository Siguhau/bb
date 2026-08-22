import type { NextFunction, Request, Response } from "express";

import { ADMIN_SESSION_COOKIE_NAME } from "../config/admin-auth.js";
import {
  findAdministratorForSession,
  type AuthenticatedAdministrator,
} from "../services/admin-auth.js";

export type AdminResponseLocals = {
  administrator: AuthenticatedAdministrator;
};

export function readAdminSessionCookie(request: Request): string | null {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return null;

  for (const cookie of cookieHeader.split(";")) {
    const separator = cookie.indexOf("=");
    if (separator < 0) continue;
    const name = cookie.slice(0, separator).trim();
    if (name !== ADMIN_SESSION_COOKIE_NAME) continue;
    const value = cookie.slice(separator + 1).trim();
    return value.length >= 32 && value.length <= 256 ? value : null;
  }
  return null;
}

export function createRequireAdministrator(
  findAdministrator: (
    token: string,
  ) => Promise<AuthenticatedAdministrator | null> = findAdministratorForSession,
) {
  return async (
    request: Request,
    response: Response<unknown, AdminResponseLocals>,
    next: NextFunction,
  ): Promise<void> => {
    const token = readAdminSessionCookie(request);
    if (!token) {
      response
        .status(401)
        .json({ error: "Administrator authentication is required." });
      return;
    }

    try {
      const administrator = await findAdministrator(token);
      if (!administrator) {
        response
          .status(401)
          .json({ error: "Administrator authentication is required." });
        return;
      }
      response.locals.administrator = administrator;
      next();
    } catch {
      response
        .status(500)
        .json({ error: "We could not verify administrator access." });
    }
  };
}

export const requireAdministrator = createRequireAdministrator();
