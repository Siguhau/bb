import type { FormEvent } from "react";
import type { ServiceType } from "../../types/order";
import type { AdminOrderFilters, AdminStatusOption } from "../../types/admin";

type Props = {
  filters: AdminOrderFilters;
  services: ServiceType[];
  statuses: AdminStatusOption[];
  isLoading: boolean;
  onChange: (filters: AdminOrderFilters) => void;
  onSubmit: (filters: AdminOrderFilters) => void;
  onClear: () => void;
};

export default function AdminFilters({
  filters,
  services,
  statuses,
  isLoading,
  onChange,
  onSubmit,
  onClear,
}: Props) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(filters);
  }

  function set(field: keyof AdminOrderFilters, value: string, apply = false) {
    const nextFilters = { ...filters, [field]: value };
    onChange(nextFilters);
    if (apply) onSubmit(nextFilters);
  }

  return (
    <form className="admin-filters" aria-busy={isLoading} onSubmit={submit}>
      <div className="form-field admin-search-field">
        <label htmlFor="admin-search">Search orders</label>
        <input
          id="admin-search"
          placeholder="Reference, customer, contact, or bike"
          value={filters.search}
          onChange={(event) => set("search", event.target.value)}
          onBlur={(event) => set("search", event.target.value, true)}
        />
      </div>
      <div className="admin-filter-fields">
        <div className="form-field">
          <label htmlFor="admin-status-filter">Status</label>
          <select
            id="admin-status-filter"
            value={filters.status}
            onChange={(event) => set("status", event.target.value, true)}
          >
            <option value="">All statuses</option>
            {statuses.map((status) => (
              <option key={status.code} value={status.code}>
                {status.displayName.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="admin-service-filter">Service</label>
          <select
            id="admin-service-filter"
            value={filters.serviceType}
            onChange={(event) => set("serviceType", event.target.value, true)}
          >
            <option value="">All services</option>
            {services.map((service) => (
              <option key={service.code} value={service.code}>
                {service.displayName}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="admin-date-filter">Due date</label>
          <input
            id="admin-date-filter"
            type="date"
            value={filters.dueDate}
            onChange={(event) => set("dueDate", event.target.value, true)}
          />
        </div>
      </div>
      <div className="admin-filter-actions">
        <button
          className="button button-secondary"
          type="button"
          onClick={onClear}
        >
          Clear
        </button>
      </div>
    </form>
  );
}
