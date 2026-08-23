import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import AdminPage from "./AdminPage";

vi.mock("../api/admin", () => ({
  deleteAdminOrder: vi.fn(),
  getAdminCapacity: vi.fn(),
  getAdminOptions: vi.fn(),
  getAdminOrders: vi.fn(),
  signInAdministrator: vi.fn(),
  signOutAdministrator: vi.fn(),
  updateAdminOrder: vi.fn(),
}));
import {
  getAdminCapacity,
  getAdminOptions,
  getAdminOrders,
  signInAdministrator,
  updateAdminOrder,
} from "../api/admin";

const order = {
  id: "order-1",
  reference: "A1B2C3D4",
  customerName: "Ada Lovelace",
  phoneNumber: "+47 12345678",
  emailAddress: "ada@example.com",
  bikeBrand: "Trek",
  expectedDueDate: "2026-08-24",
  status: "NEW" as const,
  notes: "Brake rubs",
  totalCost: 300,
  createdAt: "2026-08-22T08:00:00.000Z",
  updatedAt: "2026-08-22T09:00:00.000Z",
  serviceTypes: [
    { code: "BRAKE_MAINTENANCE", displayName: "Brake maintenance", cost: 300 },
  ],
};

describe("AdminPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getAdminOptions).mockResolvedValue({
      serviceTypes: order.serviceTypes,
      statuses: [
        { code: "NEW", displayName: "New" },
        { code: "IN_PROGRESS", displayName: "In progress" },
      ],
      today: "2026-08-23",
    });
    vi.mocked(getAdminCapacity).mockResolvedValue([
      { date: "2026-08-24", used: 1, capacity: 5, display: "1 of 5" },
    ]);
  });

  it("recovers from an unauthenticated request and signs in", async () => {
    vi.mocked(getAdminOrders)
      .mockRejectedValueOnce(
        new ApiError("Administrator authentication is required.", {}, 401),
      )
      .mockResolvedValue([order]);
    vi.mocked(signInAdministrator).mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
    });
    const user = userEvent.setup();
    render(<AdminPage />);

    expect(
      await screen.findByRole("heading", { name: "Sign in to the workshop" }),
    ).toBeInTheDocument();
    await user.type(
      screen.getByLabelText("Email address"),
      "admin@example.com",
    );
    await user.type(
      screen.getByLabelText("Password"),
      "correct horse battery staple",
    );
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByRole("heading", { name: "Workshop orders" }),
    ).toBeInTheDocument();
    expect(screen.getByText("A1B2C3D4")).toBeInTheDocument();
    expect(signInAdministrator).toHaveBeenCalledWith(
      "admin@example.com",
      "correct horse battery staple",
    );
  });

  it("shows an operational load failure without falsely expiring the session", async () => {
    vi.mocked(getAdminOrders).mockRejectedValue(
      new ApiError("We could not load orders. Please try again.", {}, 500),
    );
    render(<AdminPage />);

    expect(
      await screen.findByRole("heading", { name: "Workshop orders" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("We could not load orders. Please try again."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Sign in to the workshop" }),
    ).not.toBeInTheDocument();
  });

  it("refreshes capacity using the shop-local date range", async () => {
    vi.mocked(getAdminOrders).mockResolvedValue([order]);
    const user = userEvent.setup();
    render(<AdminPage />);

    await screen.findByRole("heading", { name: "Weekday capacity" });
    await user.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() =>
      expect(getAdminCapacity).toHaveBeenLastCalledWith(
        "2026-08-23",
        "2026-09-05",
      ),
    );
  });

  it("saves editable order fields and keeps customer data read-only", async () => {
    vi.mocked(getAdminOrders).mockResolvedValue([order]);
    vi.mocked(updateAdminOrder).mockResolvedValue({
      ...order,
      status: "IN_PROGRESS",
      notes: "Work started",
    });
    const user = userEvent.setup();
    render(<AdminPage />);

    await user.click(await screen.findByRole("button", { name: /A1B2C3D4/ }));
    expect(
      await screen.findByRole("heading", { name: "Ada Lovelace" }),
    ).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    await user.selectOptions(
      screen.getByLabelText("Status", { selector: "#admin-order-status" }),
      "IN_PROGRESS",
    );
    await user.clear(screen.getByLabelText(/Notes/));
    await user.type(screen.getByLabelText(/Notes/), "Work started");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(updateAdminOrder).toHaveBeenCalledWith("order-1", {
        status: "IN_PROGRESS",
        notes: "Work started",
      }),
    );
  });

  it("shows the total cost to the administrator", async () => {
    vi.mocked(getAdminOrders).mockResolvedValue([order]);
    const user = userEvent.setup();
    render(<AdminPage />);

    await user.click(await screen.findByRole("button", { name: /A1B2C3D4/ }));
    expect(screen.getByText("Total cost")).toBeInTheDocument();
    expect(screen.getAllByText(/300/).length).toBeGreaterThan(0);
  });

  it("opens the selected order in a modal and closes it", async () => {
    vi.mocked(getAdminOrders).mockResolvedValue([order]);
    const user = userEvent.setup();
    render(<AdminPage />);

    const orderButton = await screen.findByRole("button", { name: /A1B2C3D4/ });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(orderButton);

    expect(
      screen.getByRole("dialog", { name: "Ada Lovelace" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Close order editor" }),
    ).toHaveFocus();
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(screen.getByRole("button", { name: "Save changes" })).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Close order editor" }),
    ).toHaveFocus();
    await user.click(
      screen.getByRole("button", { name: "Close order editor" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the order editor with Escape", async () => {
    vi.mocked(getAdminOrders).mockResolvedValue([order]);
    const user = userEvent.setup();
    render(<AdminPage />);

    await user.click(await screen.findByRole("button", { name: /A1B2C3D4/ }));
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
