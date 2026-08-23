import type { CapacityDay } from "../../types/admin";
import { formatDueDate } from "../../utils/formatDueDate";

type Props = {
  days: CapacityDay[];
  isLoading: boolean;
  error: string;
  onRefresh: () => void;
};

export default function AdminCapacity({
  days,
  isLoading,
  error,
  onRefresh,
}: Props) {
  return (
    <section
      className="admin-panel admin-capacity"
      aria-labelledby="capacity-heading"
    >
      <div className="admin-panel-heading">
        <div>
          <p className="eyebrow">Next two weeks</p>
          <h2 id="capacity-heading">Weekday capacity</h2>
        </div>
        <button
          className="button button-secondary button-compact"
          disabled={isLoading}
          onClick={onRefresh}
          type="button"
        >
          Refresh
        </button>
      </div>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <div className="capacity-grid">
        {days.map((day) => (
          <div
            className={`capacity-day${day.used >= day.capacity ? " is-full" : ""}`}
            key={day.date}
          >
            <span>{formatDueDate(day.date)}</span>
            <strong>{day.display}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
