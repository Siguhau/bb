import { type FormEvent, useEffect, useRef, useState } from "react";
import Alert from "../Alert";
import type { ServiceType } from "../../types/order";
import type {
  AdminOrder,
  AdminOrderPatch,
  AdminStatusOption,
} from "../../types/admin";
import { formatDueDate } from "../../utils/formatDueDate";
import { formatCost } from "../../utils/formatCost";
import { createAdminOrderPatch } from "../../utils/createAdminOrderPatch";

type Props = {
  order: AdminOrder;
  services: ServiceType[];
  statuses: AdminStatusOption[];
  isSaving: boolean;
  error: string;
  fields: Record<string, string>;
  onClose: () => void;
  onSave: (patch: AdminOrderPatch) => Promise<void>;
  onDelete: () => Promise<void>;
};

type FormProps = Omit<Props, "onClose">;

function OrderDetails({ order }: Pick<Props, "order">) {
  return (
    <dl className="order-details admin-customer-details">
      <div>
        <dt>Email</dt>
        <dd>{order.emailAddress}</dd>
      </div>
      <div>
        <dt>Phone</dt>
        <dd>{order.phoneNumber}</dd>
      </div>
      <div>
        <dt>Bike</dt>
        <dd>{order.bikeBrand}</dd>
      </div>
      <div>
        <dt>Created</dt>
        <dd>{new Date(order.createdAt).toLocaleString()}</dd>
      </div>
      <div>
        <dt>Current due date</dt>
        <dd>{formatDueDate(order.expectedDueDate)}</dd>
      </div>
      <div>
        <dt>Last updated</dt>
        <dd>{new Date(order.updatedAt).toLocaleString()}</dd>
      </div>
      {order.discountCode && (
        <>
          <div>
            <dt>Subtotal</dt>
            <dd>{formatCost(order.subtotalCost)}</dd>
          </div>
          <div>
            <dt>Discount code</dt>
            <dd>{order.discountCode}</dd>
          </div>
          <div>
            <dt>Discount</dt>
            <dd>−{formatCost(order.discountAmount)}</dd>
          </div>
          <div>
            <dt>Total cost</dt>
            <dd>{formatCost(order.totalCost)}</dd>
          </div>
        </>
      )}
      {!order.discountCode && (
        <div>
          <dt>Total cost</dt>
          <dd>{formatCost(order.totalCost)}</dd>
        </div>
      )}
    </dl>
  );
}

function OrderEditForm({
  order,
  services,
  statuses,
  isSaving,
  error,
  fields,
  onSave,
  onDelete,
}: FormProps) {
  const [notes, setNotes] = useState(order.notes ?? "");
  const [status, setStatus] = useState(order.status);
  const [dueDate, setDueDate] = useState(order.expectedDueDate);
  const [selectedServices, setSelectedServices] = useState(
    order.serviceTypes.map((service) => service.code),
  );

  useEffect(() => {
    setNotes(order.notes ?? "");
    setStatus(order.status);
    setDueDate(order.expectedDueDate);
    setSelectedServices(order.serviceTypes.map((service) => service.code));
  }, [order]);

  function toggleService(code: string) {
    setSelectedServices((current) =>
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code],
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const patch = createAdminOrderPatch(order, {
      notes,
      status,
      expectedDueDate: dueDate,
      serviceTypes: selectedServices,
    });
    if (Object.keys(patch).length > 0) await onSave(patch);
  }

  async function confirmDelete() {
    if (
      window.confirm(
        `Permanently delete order ${order.reference}? This cannot be undone.`,
      )
    )
      await onDelete();
  }

  return (
    <form className="order-form admin-edit-form" onSubmit={submit}>
      <div className="admin-edit-grid">
        <div className="form-field">
          <label htmlFor="admin-order-status">Status</label>
          <select
            id="admin-order-status"
            disabled={isSaving}
            aria-invalid={Boolean(fields.status)}
            aria-describedby={
              fields.status ? "admin-order-status-error" : undefined
            }
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as AdminOrder["status"])
            }
          >
            {statuses.map((item) => (
              <option key={item.code} value={item.code}>
                {item.displayName.toUpperCase()}
              </option>
            ))}
          </select>
          {fields.status && (
            <p className="field-error" id="admin-order-status-error">
              {fields.status}
            </p>
          )}
        </div>
        <div className="form-field">
          <label htmlFor="admin-order-due-date">Expected due date</label>
          <input
            id="admin-order-due-date"
            type="date"
            disabled={isSaving}
            aria-invalid={Boolean(fields.expectedDueDate)}
            aria-describedby={
              fields.expectedDueDate ? "admin-order-date-error" : undefined
            }
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
          {fields.expectedDueDate && (
            <p className="field-error" id="admin-order-date-error">
              {fields.expectedDueDate}
            </p>
          )}
        </div>
      </div>
      <fieldset className="service-fieldset">
        <legend>Services</legend>
        <div className="service-options admin-service-options">
          {services.map((service) => (
            <label className="service-option" key={service.code}>
              <input
                type="checkbox"
                disabled={isSaving}
                checked={selectedServices.includes(service.code)}
                onChange={() => toggleService(service.code)}
              />
              <span>{service.displayName}</span>
              <span className="service-option-cost">
                {formatCost(service.cost)}
              </span>
            </label>
          ))}
        </div>
        {fields.serviceTypes && (
          <p className="field-error" role="alert">
            {fields.serviceTypes}
          </p>
        )}
      </fieldset>
      <div className="form-field">
        <label htmlFor="admin-order-notes">
          Notes <span className="optional-label">optional</span>
        </label>
        <textarea
          id="admin-order-notes"
          maxLength={2000}
          disabled={isSaving}
          aria-invalid={Boolean(fields.notes)}
          aria-describedby={
            fields.notes ? "admin-order-notes-error" : undefined
          }
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
        <p className="field-help">{notes.length} of 2000 characters</p>
        {fields.notes && (
          <p className="field-error" id="admin-order-notes-error">
            {fields.notes}
          </p>
        )}
      </div>
      {error && <Alert>{error}</Alert>}
      <div className="admin-editor-actions">
        <button
          className="button button-primary"
          disabled={isSaving || selectedServices.length === 0}
          type="submit"
        >
          {isSaving ? "Saving…" : "Save changes"}
        </button>
        {order.status === "CANCELLED" && (
          <button
            className="button button-danger"
            disabled={isSaving}
            type="button"
            onClick={confirmDelete}
          >
            Permanently delete
          </button>
        )}
      </div>
    </form>
  );
}

export default function AdminOrderEditor({ onClose, ...formProps }: Props) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const modal = useRef<HTMLElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = modal.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="admin-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={modal}
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-detail-heading"
      >
        <div className="admin-panel-heading">
          <div>
            <p className="eyebrow">Order {formProps.order.reference}</p>
            <h2 id="order-detail-heading">{formProps.order.customerName}</h2>
          </div>
          <div className="admin-modal-actions">
            <span className="status-badge">
              {formProps.statuses
                .find((item) => item.code === formProps.order.status)
                ?.displayName.toUpperCase()}
            </span>
            <button
              ref={closeButton}
              className="button button-secondary button-compact"
              type="button"
              onClick={onClose}
              aria-label="Close order editor"
            >
              Close
            </button>
          </div>
        </div>
        <OrderDetails order={formProps.order} />
        <OrderEditForm {...formProps} />
      </section>
    </div>
  );
}
