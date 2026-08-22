import type { CustomerAccessGrant, CustomerOrder } from "../../types/customer";
import CustomerOrderCard from "./CustomerOrderCard";

type CustomerOrderResultsProps = {
  error: string;
  orders: CustomerOrder[];
  accessGrant: CustomerAccessGrant | null;
  onOrderUpdated: (order: CustomerOrder) => void;
};

export default function CustomerOrderResults({
  accessGrant,
  error,
  onOrderUpdated,
  orders,
}: CustomerOrderResultsProps) {
  return (
    <div className="lookup-feedback" aria-live="polite">
      {error && <p className="error-message">{error}</p>}
      {orders.length > 0 && (
        <section aria-labelledby="results-heading">
          <h2 id="results-heading">Your orders</h2>
          <div className="order-results">
            {orders.map((order) => (
              <CustomerOrderCard
                accessGrant={accessGrant}
                key={order.id}
                onOrderUpdated={onOrderUpdated}
                order={order}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
