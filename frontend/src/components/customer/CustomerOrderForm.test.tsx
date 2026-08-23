import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/customer", () => ({
  getCustomerOrderOptions: vi.fn(),
  submitCustomerOrder: vi.fn(),
  verifyDiscountCode: vi.fn(),
}));

import {
  getCustomerOrderOptions,
  submitCustomerOrder,
  verifyDiscountCode,
} from "../../api/customer";
import CustomerOrderForm from "./CustomerOrderForm";

const serviceTypes = [
  { code: "BRAKE_MAINTENANCE", displayName: "Brake maintenance" },
];

describe("CustomerOrderForm discount codes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCustomerOrderOptions).mockResolvedValue(serviceTypes);
  });

  it("verifies a code and clears its verification when it is edited", async () => {
    vi.mocked(verifyDiscountCode).mockResolvedValue({
      valid: true,
      discountCode: "BB50",
      discountPercentage: 50,
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CustomerOrderForm onSubmitted={vi.fn()} />
      </MemoryRouter>,
    );

    const input = screen.getByLabelText(/Discount code/);
    await user.type(input, " bb50 ");
    await user.click(screen.getByRole("button", { name: "Verify code" }));

    await waitFor(() =>
      expect(verifyDiscountCode).toHaveBeenCalledWith("bb50"),
    );
    expect(input).toHaveValue("BB50");
    expect(screen.getByText("BB50 applied: 50% off.")).toBeInTheDocument();

    await user.type(input, "X");

    expect(
      screen.queryByText("BB50 applied: 50% off."),
    ).not.toBeInTheDocument();
  });

  it("requires a non-empty code to be verified before submission", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CustomerOrderForm onSubmitted={vi.fn()} />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Customer name"), "Ada Lovelace");
    await user.type(screen.getByLabelText("Phone number"), "+4712345678");
    await user.type(screen.getByLabelText("Email address"), "ada@example.com");
    await user.type(screen.getByLabelText("Bike brand"), "Trek");
    await user.click(
      await screen.findByRole("checkbox", { name: "Brake maintenance" }),
    );
    await user.type(screen.getByLabelText(/Discount code/), "BB50");
    await user.click(screen.getByRole("button", { name: "Place order" }));

    expect(
      screen.getByText("Verify this discount code before placing your order."),
    ).toBeInTheDocument();
    expect(submitCustomerOrder).not.toHaveBeenCalled();
  });

  it("submits the canonical code after it has been verified", async () => {
    vi.mocked(verifyDiscountCode).mockResolvedValue({
      valid: true,
      discountCode: "BB50",
      discountPercentage: 50,
    });
    vi.mocked(submitCustomerOrder).mockResolvedValue({
      reference: "A1B2C3D4",
      expectedDueDate: "2026-08-24",
      status: "NEW",
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CustomerOrderForm onSubmitted={vi.fn()} />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Customer name"), "Ada Lovelace");
    await user.type(screen.getByLabelText("Phone number"), "+4712345678");
    await user.type(screen.getByLabelText("Email address"), "ada@example.com");
    await user.type(screen.getByLabelText("Bike brand"), "Trek");
    await user.click(
      await screen.findByRole("checkbox", { name: "Brake maintenance" }),
    );
    await user.type(screen.getByLabelText(/Discount code/), "bb50");
    await user.click(screen.getByRole("button", { name: "Verify code" }));
    await screen.findByText("BB50 applied: 50% off.");
    await user.click(screen.getByRole("button", { name: "Place order" }));

    await waitFor(() => expect(submitCustomerOrder).toHaveBeenCalled());
    expect(submitCustomerOrder).toHaveBeenCalledWith(
      expect.objectContaining({ discountCode: "BB50" }),
    );
  });

  it("prevents submission while discount verification is pending", async () => {
    let resolveVerification!: (result: {
      valid: true;
      discountCode: string;
      discountPercentage: number;
    }) => void;
    vi.mocked(verifyDiscountCode).mockReturnValue(
      new Promise((resolve) => {
        resolveVerification = resolve;
      }),
    );
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CustomerOrderForm onSubmitted={vi.fn()} />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/Discount code/), "BB50");
    await user.click(screen.getByRole("button", { name: "Verify code" }));

    expect(screen.getByRole("button", { name: "Place order" })).toBeDisabled();
    resolveVerification({
      valid: true,
      discountCode: "BB50",
      discountPercentage: 50,
    });

    await screen.findByText("BB50 applied: 50% off.");
    expect(
      screen.queryByText(
        "Verify this discount code before placing your order.",
      ),
    ).not.toBeInTheDocument();
  });
});
