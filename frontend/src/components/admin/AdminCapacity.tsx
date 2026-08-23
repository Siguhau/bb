import type { CapacityDay } from "../../types/admin";
import { formatDueDate } from "../../utils/formatDueDate";
import Alert from "../Alert";

type Props = {
  days: CapacityDay[];
  isLoading: boolean;
  error: string;
  onRefresh: () => void;
};

function CapacityDayCard({ day }: { day: CapacityDay }) {
  const isFull = day.used >= day.capacity;

  return (
    <div className={`capacity-day${isFull ? " is-full" : ""}`}>
      <span className="capacity-weekday">
        {new Intl.DateTimeFormat(undefined, {
          weekday: "long",
          timeZone: "UTC",
        }).format(new Date(`${day.date}T00:00:00Z`))}
      </span>
      <span>{formatDueDate(day.date)}</span>
      <strong>{day.display}</strong>
    </div>
  );
}

function CapacityGrid({ days }: { days: CapacityDay[] }) {
  if (days.length === 0)
    return <p className="admin-empty">No capacity dates are available.</p>;

  return (
    <div className="capacity-grid">
      {days.map((day) => (
        <CapacityDayCard day={day} key={day.date} />
      ))}
    </div>
  );
}

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
      {error && <Alert>{error}</Alert>}
      <CapacityGrid days={days} />
    </section>
  );
}
