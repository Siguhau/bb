import { expect, test, type Page } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL!;
const adminPassword = process.env.E2E_ADMIN_PASSWORD!;

type NewOrder = {
  customerName: string;
  emailAddress: string;
  bikeBrand: string;
  reference: string;
};

async function submitOrder(
  page: Page,
  options: { discountCode?: string; notes?: string; service?: string } = {},
): Promise<NewOrder> {
  const identifier = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const order = {
    customerName: `Playwright ${identifier}`,
    emailAddress: `playwright-${identifier}@example.com`,
    bikeBrand: `Bike ${identifier}`,
  };

  await page.goto("/customer/orders/new");
  await page.getByLabel("Customer name").fill(order.customerName);
  await page.getByLabel("Phone number").fill("+47 999 99 999");
  await page.getByLabel("Email address").fill(order.emailAddress);
  await page.getByLabel("Bike brand").fill(order.bikeBrand);
  await page.getByLabel(options.service ?? "Wheel adjustment").check();

  if (options.discountCode) {
    await page.getByLabel(/Discount code/).fill(options.discountCode);
    await page.getByRole("button", { name: "Verify code" }).click();
    await expect(page.getByRole("status")).toContainText("applied");
  }
  if (options.notes) await page.getByLabel(/Notes/).fill(options.notes);

  await page.getByRole("button", { name: "Place order" }).click();
  await expect(
    page.getByRole("heading", { name: "Your order is booked" }),
  ).toBeVisible();

  const reference = await page.getByText(/^[A-Z0-9]{8}$/).textContent();
  expect(reference).toMatch(/^[A-Z0-9]{8}$/);
  return { ...order, reference: reference! };
}

async function lookUpOrder(page: Page, lookupValue: string) {
  await page.goto("/customer");
  await page.getByLabel("Order details").fill(lookupValue);
  await page.getByRole("button", { name: "Find order" }).click();
}

async function signIn(page: Page) {
  await page.goto("/admin");
  await page.getByLabel("Email address").fill(adminEmail);
  await page.getByLabel("Password").fill(adminPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Workshop orders" }),
  ).toBeVisible();
}

test("a verified discount reduces the submitted order total", async ({
  page,
}) => {
  const order = await submitOrder(page, { discountCode: " bb50 " });

  await signIn(page);
  await page.getByLabel("Search orders").fill(order.reference);
  await page.getByLabel("Search orders").press("Enter");
  const orderRow = page.getByRole("button", {
    name: new RegExp(order.reference),
  });
  await expect(orderRow).toBeEnabled();
  await expect(orderRow).toContainText("50 kr");
});

test("a customer must verify a discount before submitting it", async ({
  page,
}) => {
  await page.goto("/customer/orders/new");
  await page.getByLabel("Customer name").fill("Unverified discount customer");
  await page.getByLabel("Phone number").fill("+47 999 99 999");
  await page.getByLabel("Email address").fill("unverified@example.com");
  await page.getByLabel("Bike brand").fill("Unverified Bike");
  await page.getByLabel("Wheel adjustment").check();
  await page.getByLabel(/Discount code/).fill("BB50");
  await page.getByRole("button", { name: "Place order" }).click();

  await expect(
    page.getByText("Verify this discount code before placing your order."),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Book a service" }),
  ).toBeVisible();
});

test("a customer can add notes to their newly created order", async ({
  page,
}) => {
  const order = await submitOrder(page);

  await lookUpOrder(page, order.reference);
  const card = page.getByRole("article").filter({
    hasText: `Order ${order.reference}`,
  });
  await card.getByRole("button", { name: "Add notes" }).click();
  await card.getByLabel("Notes").fill("Please call before starting work.");
  await card.getByRole("button", { name: "Save notes" }).click();

  await expect(card).toContainText("Please call before starting work.");
  await expect(card.getByRole("button", { name: "Edit notes" })).toBeVisible();
});

test("an administrator can filter the queue by service", async ({ page }) => {
  const order = await submitOrder(page, { service: "Chain replacement" });

  await signIn(page);
  await page.getByLabel("Service").selectOption("CHAIN_REPLACEMENT");

  const orderRow = page.getByRole("button", {
    name: new RegExp(order.reference),
  });
  await expect(page.getByLabel("Service")).toHaveValue("CHAIN_REPLACEMENT");
  await expect(orderRow).toBeEnabled();
  await expect(orderRow).toContainText("550 kr");
});
