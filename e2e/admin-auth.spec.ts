import { expect, test } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test("admin pages require authentication and permit a seeded administrator", async ({
  page,
}) => {
  test.skip(
    !adminEmail || !adminPassword,
    "E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD must be set for this test.",
  );

  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Sign in to the workshop" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Workshop orders" }),
  ).toHaveCount(0);

  await page.getByLabel("Email address").fill(adminEmail);
  await page.getByLabel("Password").fill(adminPassword);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(
    page.getByRole("heading", { name: "Workshop orders" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
});
