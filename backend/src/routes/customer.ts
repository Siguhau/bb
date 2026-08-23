import { Router, type Request } from "express";

import {
  SERVICE_TYPES,
  getDiscount,
  normalizeDiscountCode,
} from "../domain/order.js";
import {
  createConfiguredLookupRateLimiter,
  type LookupRateLimiter,
} from "../middleware/lookup-rate-limit.js";
import { lookupOrders, type CustomerOrder } from "../services/lookup-orders.js";
import {
  grantAllowsOrder,
  issueCustomerAccessGrant,
  type CustomerAccessGrant,
} from "../services/customer-access-grants.js";
import {
  CustomerNotesValidationError,
  CustomerOrderNotEditableError,
  CustomerOrderNotFoundError,
  updateCustomerNotes,
} from "../services/update-customer-notes.js";
import {
  OrderSubmissionValidationError,
  MAX_DISCOUNT_CODE_LENGTH,
  submitOrder,
  type SubmittedOrder,
} from "../services/submit-order.js";

const LOOKUP_FAILURE_MESSAGE = "No matching orders were found.";
const LOOKUP_BLOCKED_MESSAGE =
  "Order lookup is temporarily unavailable. Please try again later.";
const INVALID_GRANT_MESSAGE =
  "Your order access has expired or is not valid for this order. Look up the order again.";

type CustomerRouterDependencies = {
  createOrder?: (value: unknown) => Promise<SubmittedOrder>;
  findOrders?: (value: string) => Promise<CustomerOrder[]>;
  issueAccessGrant?: (orderIds: string[]) => CustomerAccessGrant;
  accessGrantAllowsOrder?: (token: string, orderId: string) => boolean;
  updateNotes?: (orderId: string, value: unknown) => Promise<CustomerOrder>;
  rateLimiter?: LookupRateLimiter;
};

function clientId(request: Request): string {
  return request.ip ?? request.socket.remoteAddress ?? "unknown";
}

export function createCustomerRouter({
  createOrder = submitOrder,
  findOrders = lookupOrders,
  issueAccessGrant = issueCustomerAccessGrant,
  accessGrantAllowsOrder = grantAllowsOrder,
  updateNotes = updateCustomerNotes,
  rateLimiter = createConfiguredLookupRateLimiter(),
}: CustomerRouterDependencies = {}) {
  const router = Router();

  router.get("/order-options", (_request, response) => {
    response.status(200).json({
      serviceTypes: SERVICE_TYPES.map(({ code, displayName }) => ({
        code,
        displayName,
      })),
    });
  });

  router.post("/discount-codes/verify", (request, response) => {
    const discountCode = request.body?.discountCode;
    if (
      typeof discountCode !== "string" ||
      discountCode.length > MAX_DISCOUNT_CODE_LENGTH
    ) {
      response.status(400).json({ error: "Enter a discount code." });
      return;
    }

    const canonicalCode = normalizeDiscountCode(discountCode);
    const discount = getDiscount(canonicalCode);
    if (!discount) {
      response.status(200).json({ valid: false });
      return;
    }

    response.status(200).json({
      valid: true,
      discountCode: discount.code,
      discountPercentage: discount.percentage,
    });
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

  router.patch("/orders/:id/notes", async (request, response) => {
    const orderId = request.params.id;
    const authorization = request.get("authorization");
    const match = authorization?.match(/^Bearer ([A-Za-z0-9_-]+)$/);
    const token = match?.[1];

    if (!orderId || !token || !accessGrantAllowsOrder(token, orderId)) {
      response.status(403).json({ error: INVALID_GRANT_MESSAGE });
      return;
    }

    try {
      const order = await updateNotes(orderId, request.body);
      response.status(200).json({ order });
    } catch (error) {
      if (error instanceof CustomerNotesValidationError) {
        response
          .status(400)
          .json({ error: error.message, fields: error.fields });
        return;
      }
      if (error instanceof CustomerOrderNotFoundError) {
        response.status(404).json({ error: "Order not found." });
        return;
      }
      if (error instanceof CustomerOrderNotEditableError) {
        response.status(409).json({
          error: "Notes can only be changed while the order is New.",
        });
        return;
      }

      response.status(500).json({
        error: "We could not update your notes. Please try again.",
      });
    }
  });

  return router;
}

export default createCustomerRouter();
