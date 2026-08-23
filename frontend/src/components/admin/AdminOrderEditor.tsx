import { type FormEvent, useEffect, useState } from "react";
import type { ServiceType } from "../../types/customer";
import type {
  AdminOrder,
  AdminOrderPatch,
  AdminStatusOption,
} from "../../types/admin";
import { formatDueDate } from "../../utils/formatDueDate";

type Props = {
  order: AdminOrder;
  services: ServiceType[];
  statuses: AdminStatusOption[];
  isSaving: boolean;
  error: string;
  fields: Record<string, string>;
  onSave: (patch: AdminOrderPatch) => Promise<void>;
  onDelete: () => Promise<void>;
};

export default function AdminOrderEditor({
  order,
  services,
  statuses,
  isSaving,
  error,
  fields,
  onSave,
  onDelete,
}: Props) {
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
    const patch: AdminOrderPatch = {};
    const normalizedNotes = notes.trim() || null;
    if (normalizedNotes !== order.notes) patch.notes = normalizedNotes;
    if (status !== order.status) patch.status = status;
    if (dueDate !== order.expectedDueDate) patch.expectedDueDate = dueDate;
    const originalServices = order.serviceTypes
      .map((service) => service.code)
      .sort();
    const nextServices = [...selectedServices].sort();
    if (originalServices.join("\0") !== nextServices.join("\0"))
      patch.serviceTypes = selectedServices;
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
    <section
      className="admin-panel admin-order-detail"
      aria-labelledby="order-detail-heading"
    >
      <div className="admin-panel-heading">
        <div>
          <p className="eyebrow">Order {order.reference}</p>
          <h2 id="order-detail-heading">{order.customerName}</h2>
        </div>
        <span className="status-badge">
          {statuses.find((item) => item.code === order.status)?.displayName}
        </span>
      </div>
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
      </dl>
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
                  {item.displayName}
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
                {service.displayName}
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
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
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
    </section>
  );
}
