import { type FormEvent, useState } from "react";
import { ApiError } from "../../api/client";
import { updateCustomerOrderNotes } from "../../api/customer";
import type { CustomerAccessGrant, CustomerOrder } from "../../types/customer";
import { formatDueDate } from "../../utils/formatDueDate";

const statusLabels: Record<string, string> = {
  NEW: "New",
  IN_PROGRESS: "In progress",
  WAITING_FOR_CUSTOMER_PICKUP: "Waiting for customer pickup",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

type CustomerOrderCardProps = {
  order: CustomerOrder;
  accessGrant: CustomerAccessGrant | null;
  onOrderUpdated: (order: CustomerOrder) => void;
};

export default function CustomerOrderCard({
  accessGrant,
  onOrderUpdated,
  order,
}: CustomerOrderCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState(order.notes ?? "");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function cancelEditing() {
    setNotes(order.notes ?? "");
    setError("");
    setIsEditing(false);
  }

  async function saveNotes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessGrant) return;

    setError("");
    setIsSaving(true);
    try {
      const updatedOrder = await updateCustomerOrderNotes(
        order.id,
        notes,
        accessGrant.token,
      );
      onOrderUpdated(updatedOrder);
      setNotes(updatedOrder.notes ?? "");
      setIsEditing(false);
    } catch (error) {
      setError(
        error instanceof ApiError
          ? error.message
          : "We could not update your notes. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <article className="order-card">
      <div className="order-card-heading">
        <div>
          <p className="step-label">Order {order.reference}</p>
          <h3>{order.bikeBrand}</h3>
        </div>
        <span className="status-badge">
          {statusLabels[order.status] ?? order.status}
        </span>
      </div>
      <dl className="order-details">
        <div>
          <dt>Customer</dt>
          <dd>{order.customerName}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{order.emailAddress}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{order.phoneNumber}</dd>
        </div>
        <div>
          <dt>Expected due date</dt>
          <dd>{formatDueDate(order.expectedDueDate)}</dd>
        </div>
        <div>
          <dt>Services</dt>
          <dd>
            {order.serviceTypes
              .map((service) => service.displayName)
              .join(", ")}
          </dd>
        </div>
        {order.notes && !isEditing && (
          <div>
            <dt>Notes</dt>
            <dd>{order.notes}</dd>
          </div>
        )}
      </dl>
      {order.status === "NEW" && accessGrant && (
        <div className="order-notes-actions">
          {isEditing ? (
            <form className="order-notes-editor" onSubmit={saveNotes}>
              <div className="form-field">
                <label htmlFor={`notes-${order.id}`}>Notes</label>
                <textarea
                  aria-describedby={
                    error ? `notes-error-${order.id}` : undefined
                  }
                  aria-invalid={Boolean(error)}
                  disabled={isSaving}
                  id={`notes-${order.id}`}
                  maxLength={2000}
                  onChange={(event) => setNotes(event.target.value)}
                  value={notes}
                />
              </div>
              {error && (
                <p
                  aria-live="polite"
                  className="field-error"
                  id={`notes-error-${order.id}`}
                >
                  {error}
                </p>
              )}
              <div className="form-actions">
                <button
                  className="button button-primary"
                  disabled={isSaving}
                  type="submit"
                >
                  {isSaving ? "Saving…" : "Save notes"}
                </button>
                <button
                  className="button button-secondary"
                  disabled={isSaving}
                  onClick={cancelEditing}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              className="button button-secondary"
              onClick={() => {
                setNotes(order.notes ?? "");
                setError("");
                setIsEditing(true);
              }}
              type="button"
            >
              {order.notes ? "Edit notes" : "Add notes"}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
