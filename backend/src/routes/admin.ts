import { Router, type CookieOptions } from "express";

import {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_COOKIE_PATH,
  getAdminAuthConfig,
  type AdminAuthConfig,
} from "../config/admin-auth.js";
import {
  readAdminSessionCookie,
  requireAdministrator,
} from "../middleware/admin-auth.js";
import {
  createAdminLoginRateLimiter,
  type AdminLoginRateLimiter,
} from "../middleware/admin-login-rate-limit.js";
import {
  createAdministratorSession,
  InvalidAdministratorCredentialsError,
  revokeAdministratorSession,
} from "../services/admin-auth.js";

type CreatedSession = Awaited<ReturnType<typeof createAdministratorSession>>;
type AdminRouterDependencies = {
  config?: AdminAuthConfig;
  createSession?: (input: {
    email: string;
    password: string;
  }) => Promise<CreatedSession>;
  revokeSession?: (token: string) => Promise<void>;
  loginRateLimiter?: AdminLoginRateLimiter;
};

function baseCookieOptions(config: AdminAuthConfig): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "strict",
    secure: config.secureCookie,
    path: ADMIN_SESSION_COOKIE_PATH,
  };
}

export function createAdminRouter({
  config = getAdminAuthConfig(),
  createSession = (input) =>
    createAdministratorSession(input, { sessionTtlMs: config.sessionTtlMs }),
  revokeSession = revokeAdministratorSession,
  loginRateLimiter = createAdminLoginRateLimiter({
    attemptLimit: config.loginAttemptLimit,
    blockDurationMs: config.loginBlockDurationMs,
  }),
}: AdminRouterDependencies = {}) {
  const router = Router();

  router.post("/session", async (request, response) => {
    const { email, password } = request.body ?? {};
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      email.length === 0 ||
      email.length > 254 ||
      password.length === 0 ||
      password.length > 1_024
    ) {
      response
        .status(400)
        .json({ error: "Enter an email address and password." });
      return;
    }

    const clientId = request.ip ?? request.socket.remoteAddress ?? "unknown";
    if (loginRateLimiter.isBlocked(clientId)) {
      response.status(429).json({
        error: "Sign-in is temporarily unavailable. Please try again later.",
      });
      return;
    }

    try {
      const session = await createSession({ email, password });
      loginRateLimiter.reset(clientId);
      response.cookie(ADMIN_SESSION_COOKIE_NAME, session.token, {
        ...baseCookieOptions(config),
        maxAge: config.sessionTtlMs,
        expires: session.expiresAt,
      });
      response.status(200).json({ administrator: session.administrator });
    } catch (error) {
      if (error instanceof InvalidAdministratorCredentialsError) {
        loginRateLimiter.recordFailure(clientId);
        response
          .status(401)
          .json({ error: "Invalid email address or password." });
        return;
      }
      response
        .status(500)
        .json({ error: "We could not sign you in. Please try again." });
    }
  });

  router.delete("/session", async (request, response) => {
    const token = readAdminSessionCookie(request);
    try {
      if (token) await revokeSession(token);
      response.clearCookie(
        ADMIN_SESSION_COOKIE_NAME,
        baseCookieOptions(config),
      );
      response.status(204).send();
    } catch {
      response
        .status(500)
        .json({ error: "We could not sign you out. Please try again." });
    }
  });

  // Mount all future administrator data routes after this boundary.
  router.use(requireAdministrator);
  return router;
}

export default createAdminRouter();
