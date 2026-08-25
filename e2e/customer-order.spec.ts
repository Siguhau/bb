import { expect, test } from "@playwright/test";

test("a customer can submit an order and find it by reference", async ({
  page,
}) => {
  const customerEmail = `playwright-${Date.now()}@example.com`;

  await page.goto("/customer/orders/new");

  await page.getByLabel("Customer name").fill("Playwright Customer");
  await page.getByLabel("Phone number").fill("+47 999 99 999");
  await page.getByLabel("Email address").fill(customerEmail);
  await page.getByLabel("Bike brand").fill("Playwright Bike");
  await page.getByLabel("Wheel adjustment").check();
  await page.getByRole("button", { name: "Place order" }).click();

  await expect(
    page.getByRole("heading", { name: "Your order is booked" }),
  ).toBeVisible();

  const reference = await page.getByText(/^[A-Z0-9]{8}$/).textContent();
  expect(reference).toMatch(/^[A-Z0-9]{8}$/);

  await page.getByRole("link", { name: "Back to customer home" }).click();
  await page.getByLabel("Order details").fill(reference!);
  await page.getByRole("button", { name: "Find order" }).click();

  const order = page.getByRole("article").filter({
    hasText: `Order ${reference}`,
  });
  await expect(order).toContainText("Playwright Bike");
  await expect(order).toContainText("Playwright Customer");
  await expect(order).toContainText(customerEmail);
});
