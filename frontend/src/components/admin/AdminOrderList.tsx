import type { AdminOrder, AdminStatusOption } from "../../types/admin";
import { formatDueDate } from "../../utils/formatDueDate";

type Props = {
  orders: AdminOrder[];
  statuses: AdminStatusOption[];
  selectedId?: string;
  disabled: boolean;
  onSelect: (order: AdminOrder) => void;
};

function statusLabel(code: string, statuses: AdminStatusOption[]) {
  return (
    statuses.find((status) => status.code === code)?.displayName ?? code
  ).toUpperCase();
}

type OrderSectionProps = Omit<Props, "orders"> & {
  title: string;
  orders: AdminOrder[];
};

function OrderSection({
  title,
  orders,
  statuses,
  selectedId,
  disabled,
  onSelect,
}: OrderSectionProps) {
  if (orders.length === 0) return null;

  return (
    <section className="admin-order-section" aria-label={`${title} orders`}>
      <h3>{title}</h3>
      <div className="admin-order-list">
        {orders.map((order) => (
          <button
            className={`admin-order-row${selectedId === order.id ? " is-selected" : ""}`}
            key={order.id}
            aria-pressed={selectedId === order.id}
            disabled={disabled}
            type="button"
            onClick={() => onSelect(order)}
          >
            <span>
              <strong>{order.reference}</strong>
              <small>
                {order.customerName} · {order.bikeBrand}
              </small>
            </span>
            <span>
              <small>Due {formatDueDate(order.expectedDueDate)}</small>
              <span className="status-badge">
                {statusLabel(order.status, statuses)}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default function AdminOrderList({
  orders,
  statuses,
  selectedId,
  disabled,
  onSelect,
}: Props) {
  if (orders.length === 0)
    return <p className="admin-empty">No orders match these filters.</p>;
  const activeOrders = orders.filter(
    (order) => order.status !== "COMPLETED" && order.status !== "CANCELLED",
  );
  const sections = [
    { title: "Active", orders: activeOrders },
    {
      title: "Completed",
      orders: orders.filter((order) => order.status === "COMPLETED"),
    },
    {
      title: "Cancelled",
      orders: orders.filter((order) => order.status === "CANCELLED"),
    },
  ];

  return (
    <div className="admin-order-sections">
      {sections.map((section) => (
        <OrderSection
          {...{ statuses, selectedId, disabled, onSelect }}
          key={section.title}
          {...section}
        />
      ))}
    </div>
  );
}
