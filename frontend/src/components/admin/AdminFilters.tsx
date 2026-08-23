import type { FormEvent } from "react";
import type { ServiceType } from "../../types/customer";
import type { AdminOrderFilters, AdminStatusOption } from "../../types/admin";

type Props = {
  filters: AdminOrderFilters;
  services: ServiceType[];
  statuses: AdminStatusOption[];
  isLoading: boolean;
  onChange: (filters: AdminOrderFilters) => void;
  onSubmit: () => void;
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
    onSubmit();
  }
  function set(field: keyof AdminOrderFilters, value: string) {
    onChange({ ...filters, [field]: value });
  }

  return (
    <form className="admin-filters" onSubmit={submit}>
      <div className="form-field admin-search-field">
        <label htmlFor="admin-search">Search orders</label>
        <input
          id="admin-search"
          placeholder="Reference, customer, contact, or bike"
          value={filters.search}
          onChange={(event) => set("search", event.target.value)}
        />
      </div>
      <div className="form-field">
        <label htmlFor="admin-status-filter">Status</label>
        <select
          id="admin-status-filter"
          value={filters.status}
          onChange={(event) => set("status", event.target.value)}
        >
          <option value="">All statuses</option>
          {statuses.map((status) => (
            <option key={status.code} value={status.code}>
              {status.displayName}
            </option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <label htmlFor="admin-service-filter">Service</label>
        <select
          id="admin-service-filter"
          value={filters.serviceType}
          onChange={(event) => set("serviceType", event.target.value)}
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
          onChange={(event) => set("dueDate", event.target.value)}
        />
      </div>
      <div className="admin-filter-actions">
        <button
          className="button button-primary"
          disabled={isLoading}
          type="submit"
        >
          Apply filters
        </button>
        <button
          className="button button-secondary"
          disabled={isLoading}
          type="button"
          onClick={onClear}
        >
          Clear
        </button>
      </div>
    </form>
  );
}
