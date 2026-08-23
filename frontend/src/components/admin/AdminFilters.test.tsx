import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AdminFilters from "./AdminFilters";

const filters = {
  search: "",
  status: "",
  serviceType: "",
  dueDate: "",
};

const onSubmit = vi.fn();

function TestFilters() {
  const [currentFilters, setFilters] = useState(filters);

  return (
    <AdminFilters
      {...props}
      filters={currentFilters}
      onChange={setFilters}
      onSubmit={onSubmit}
    />
  );
}

const props = {
  services: [{ code: "BRAKE", displayName: "Brake maintenance", cost: 300 }],
  statuses: [{ code: "IN_PROGRESS" as const, displayName: "In progress" }],
  isLoading: false,
  onChange: vi.fn(),
  onSubmit,
  onClear: vi.fn(),
};

describe("AdminFilters", () => {
  it("applies selects immediately and search when it loses focus", async () => {
    onSubmit.mockReset();
    const user = userEvent.setup();
    render(<TestFilters />);

    await user.selectOptions(screen.getByLabelText("Status"), "IN_PROGRESS");
    expect(onSubmit).toHaveBeenLastCalledWith({
      ...filters,
      status: "IN_PROGRESS",
    });
    expect(
      screen.getByRole("option", { name: "IN PROGRESS" }),
    ).toBeInTheDocument();

    const search = screen.getByLabelText("Search orders");
    await user.type(search, "Ada");
    await user.tab();
    expect(onSubmit).toHaveBeenLastCalledWith({
      ...filters,
      search: "Ada",
      status: "IN_PROGRESS",
    });
  });

  it("does not swallow Clear when search blur applies first", async () => {
    onSubmit.mockReset();
    props.onClear.mockReset();
    const user = userEvent.setup();
    render(<TestFilters />);

    await user.type(screen.getByLabelText("Search orders"), "Ada");
    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(onSubmit).toHaveBeenCalledWith({ ...filters, search: "Ada" });
    expect(props.onClear).toHaveBeenCalledOnce();
  });
});
