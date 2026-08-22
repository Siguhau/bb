import { Router, type Request } from "express";

import { SERVICE_TYPES } from "../domain/order.js";
import {
  createConfiguredLookupRateLimiter,
  type LookupRateLimiter,
} from "../middleware/lookup-rate-limit.js";
import { lookupOrders, type CustomerOrder } from "../services/lookup-orders.js";
import {
  issueCustomerAccessGrant,
  type CustomerAccessGrant,
} from "../services/customer-access-grants.js";
import {
  OrderSubmissionValidationError,
  submitOrder,
  type SubmittedOrder,
} from "../services/submit-order.js";

const LOOKUP_FAILURE_MESSAGE = "No matching orders were found.";
const LOOKUP_BLOCKED_MESSAGE =
  "Order lookup is temporarily unavailable. Please try again later.";

type CustomerRouterDependencies = {
  createOrder?: (value: unknown) => Promise<SubmittedOrder>;
  findOrders?: (value: string) => Promise<CustomerOrder[]>;
  issueAccessGrant?: (orderIds: string[]) => CustomerAccessGrant;
  rateLimiter?: LookupRateLimiter;
};

function clientId(request: Request): string {
  return request.ip ?? request.socket.remoteAddress ?? "unknown";
}

export function createCustomerRouter({
  createOrder = submitOrder,
  findOrders = lookupOrders,
  issueAccessGrant = issueCustomerAccessGrant,
  rateLimiter = createConfiguredLookupRateLimiter(),
}: CustomerRouterDependencies = {}) {
  const router = Router();

  router.get("/order-options", (_request, response) => {
    response.status(200).json({ serviceTypes: SERVICE_TYPES });
  });

  router.post("/orders", async (request, response) => {
    try {
      const order = await createOrder(request.body);
      response.status(201).json({ order });
    } catch (error) {
      if (error instanceof OrderSubmissionValidationError) {
        response
          .status(400)
          .json({ error: error.message, fields: error.fields });
        return;
      }

      response
        .status(500)
        .json({ error: "We could not place your order. Please try again." });
    }
  });

  router.post("/order-lookups", async (request, response) => {
    const id = clientId(request);

    if (rateLimiter.isBlocked(id)) {
      response.status(429).json({ error: LOOKUP_BLOCKED_MESSAGE });
      return;
    }

    rateLimiter.recordAttempt(id);
    const value = request.body?.value;

    if (typeof value !== "string" || value.length === 0 || value.length > 254) {
      response.status(400).json({
        error: "Enter one order reference, email address, or phone number.",
      });
      return;
    }

    try {
      const orders = await findOrders(value);

      if (orders.length === 0) {
        rateLimiter.recordFailure(id);
        response.status(404).json({ error: LOOKUP_FAILURE_MESSAGE });
        return;
      }

      const accessGrant = issueAccessGrant(orders.map((order) => order.id));
      response.status(200).json({ orders, accessGrant });
    } catch {
      response
        .status(500)
        .json({ error: "We could not search for orders. Please try again." });
    }
  });

  return router;
}

export default createCustomerRouter();
