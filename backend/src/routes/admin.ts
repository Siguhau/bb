import { Router, type CookieOptions, type RequestHandler } from "express";

import {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_COOKIE_PATH,
  getAdminAuthConfig,
  type AdminAuthConfig,
} from "../config/admin-auth.js";
import { ORDER_STATUSES, SERVICE_TYPES } from "../domain/order.js";
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
import {
  AdminOrderCapacityUnavailableError,
  AdminOrderDeletionNotAllowedError,
  AdminOrderMutationValidationError,
  AdminOrderNotFoundError,
  deleteCancelledAdminOrder,
  updateAdminOrder,
} from "../services/admin-order-mutations.js";
import {
  AdminReadValidationError,
  adminReadService,
} from "../services/admin-read.js";
import { shopLocalCalendarDate } from "../services/submit-order.js";

type CreatedSession = Awaited<ReturnType<typeof createAdministratorSession>>;
type AdminRouterDependencies = {
  authorize?: RequestHandler;
  config?: AdminAuthConfig;
  createSession?: (input: {
    email: string;
    password: string;
  }) => Promise<CreatedSession>;
  revokeSession?: (token: string) => Promise<void>;
  loginRateLimiter?: AdminLoginRateLimiter;
  listOrders?: typeof adminReadService.listOrders;
  getOrder?: typeof adminReadService.getOrder;
  getCapacity?: typeof adminReadService.getCapacity;
  updateOrder?: typeof updateAdminOrder;
  deleteOrder?: typeof deleteCancelledAdminOrder;
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
  authorize = requireAdministrator,
  config = getAdminAuthConfig(),
  createSession = (input) =>
    createAdministratorSession(input, { sessionTtlMs: config.sessionTtlMs }),
  revokeSession = revokeAdministratorSession,
  loginRateLimiter = createAdminLoginRateLimiter({
    attemptLimit: config.loginAttemptLimit,
    blockDurationMs: config.loginBlockDurationMs,
  }),
  listOrders = adminReadService.listOrders,
  getOrder = adminReadService.getOrder,
  getCapacity = adminReadService.getCapacity,
  updateOrder = updateAdminOrder,
  deleteOrder = deleteCancelledAdminOrder,
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

  router.use(authorize);

  router.get("/options", (_request, response) => {
    const labels: Record<(typeof ORDER_STATUSES)[number], string> = {
      NEW: "New",
      IN_PROGRESS: "In progress",
      WAITING_FOR_CUSTOMER_PICKUP: "Waiting for customer pickup",
      COMPLETED: "Completed",
      CANCELLED: "Cancelled",
    };
    response.status(200).json({
      serviceTypes: SERVICE_TYPES,
      statuses: ORDER_STATUSES.map((code) => ({
        code,
        displayName: labels[code],
      })),
      today: shopLocalCalendarDate(
        new Date(),
        process.env.SHOP_TIME_ZONE ?? "Europe/Oslo",
      ),
    });
  });

  router.get("/orders", async (request, response) => {
    try {
      response.status(200).json({ orders: await listOrders(request.query) });
    } catch (error) {
      if (error instanceof AdminReadValidationError) {
        response
          .status(400)
          .json({ error: error.message, fields: error.fields });
        return;
      }
      response
        .status(500)
        .json({ error: "We could not load orders. Please try again." });
    }
  });

  router.get("/orders/:id", async (request, response) => {
    try {
      const order = await getOrder(request.params.id);
      if (!order) {
        response.status(404).json({ error: "Order not found." });
        return;
      }
      response.status(200).json({ order });
    } catch {
      response
        .status(500)
        .json({ error: "We could not load the order. Please try again." });
    }
  });

  router.get("/capacity", async (request, response) => {
    try {
      response.status(200).json({ days: await getCapacity(request.query) });
    } catch (error) {
      if (error instanceof AdminReadValidationError) {
        response
          .status(400)
          .json({ error: error.message, fields: error.fields });
        return;
      }
      response
        .status(500)
        .json({ error: "We could not load capacity. Please try again." });
    }
  });

  router.patch("/orders/:id", async (request, response) => {
    try {
      response.status(200).json({
        order: await updateOrder(request.params.id, request.body),
      });
    } catch (error) {
      if (error instanceof AdminOrderMutationValidationError) {
        response
          .status(400)
          .json({ error: error.message, fields: error.fields });
        return;
      }
      if (error instanceof AdminOrderNotFoundError) {
        response.status(404).json({ error: error.message });
        return;
      }
      if (error instanceof AdminOrderCapacityUnavailableError) {
        response.status(409).json({ error: error.message });
        return;
      }
      response
        .status(500)
        .json({ error: "We could not update the order. Please try again." });
    }
  });

  router.delete("/orders/:id", async (request, response) => {
    try {
      await deleteOrder(request.params.id);
      response.status(204).send();
    } catch (error) {
      if (error instanceof AdminOrderNotFoundError) {
        response.status(404).json({ error: error.message });
        return;
      }
      if (error instanceof AdminOrderDeletionNotAllowedError) {
        response.status(409).json({ error: error.message });
        return;
      }
      response
        .status(500)
        .json({ error: "We could not delete the order. Please try again." });
    }
  });

  return router;
}

export default createAdminRouter();
