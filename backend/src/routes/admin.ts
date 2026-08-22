import { Router, type RequestHandler } from "express";

import {
  AdminReadValidationError,
  adminReadService,
} from "../services/admin-read.js";

type AdminRouterDependencies = {
  authorize: RequestHandler;
  listOrders?: typeof adminReadService.listOrders;
  getOrder?: typeof adminReadService.getOrder;
  getCapacity?: typeof adminReadService.getCapacity;
};

export function createAdminRouter({
  authorize,
  listOrders = adminReadService.listOrders,
  getOrder = adminReadService.getOrder,
  getCapacity = adminReadService.getCapacity,
}: AdminRouterDependencies) {
  const router = Router();
  router.use(authorize);

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

  return router;
}
