import express, {
  type Express,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { requireAdministrator } from "./middleware/admin-auth.js";
import { createAdminRouter } from "./routes/admin.js";
import customerRouter from "./routes/customer.js";

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDistDirectory = path.resolve(
  sourceDirectory,
  "../../frontend/dist",
);

type AppDependencies = {
  authorizeAdmin?: RequestHandler;
};

export function createApp({
  authorizeAdmin = requireAdministrator,
}: AppDependencies = {}): Express {
  const app = express();

  app.disable("x-powered-by");
  const trustedProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
  if (Number.isInteger(trustedProxyHops) && trustedProxyHops > 0) {
    app.set("trust proxy", trustedProxyHops);
  }
  app.use(express.json());

  app.get("/api/health", (_request: Request, response: Response) => {
    response.status(200).json({ status: "ok" });
  });

  app.use("/api/customer", customerRouter);
  app.use("/api/admin", createAdminRouter({ authorize: authorizeAdmin }));
  app.use("/api", (_request: Request, response: Response) => {
    response.status(404).json({ error: "Not found" });
  });

  if (existsSync(frontendDistDirectory)) {
    app.use(express.static(frontendDistDirectory));
    app.get("/{*splat}", (_request: Request, response: Response) => {
      response.sendFile(path.join(frontendDistDirectory, "index.html"));
    });
  }

  app.use((_request: Request, response: Response) => {
    response.status(404).json({ error: "Not found" });
  });

  return app;
}
