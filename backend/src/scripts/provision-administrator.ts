import "dotenv/config";

import { prisma } from "../infrastructure/prisma.js";
import { provisionAdministrator } from "../services/admin-auth.js";

const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
if (!email || !password) {
  throw new Error(
    "Set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD before provisioning.",
  );
}

try {
  const result = await provisionAdministrator({ email, password });
  console.info(
    result.created
      ? `Administrator ${result.administrator.email} created.`
      : `Administrator ${result.administrator.email} already exists; password unchanged.`,
  );
} finally {
  await prisma.$disconnect();
}
