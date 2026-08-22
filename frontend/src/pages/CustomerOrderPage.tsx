import { useState } from "react";
import CustomerOrderForm from "../components/customer/CustomerOrderForm";
import OrderConfirmation from "../components/customer/OrderConfirmation";
import type { SubmittedOrder } from "../types/customer";

export default function CustomerOrderPage() {
  const [submittedOrder, setSubmittedOrder] = useState<SubmittedOrder | null>(
    null,
  );

  return submittedOrder ? (
    <OrderConfirmation order={submittedOrder} />
  ) : (
    <CustomerOrderForm onSubmitted={setSubmittedOrder} />
  );
}
