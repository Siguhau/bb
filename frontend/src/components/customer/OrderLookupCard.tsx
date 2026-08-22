import type { SubmitEvent } from "react";

type OrderLookupCardProps = {
  isSearching: boolean;
  lookupValue: string;
  onLookupValueChange: (value: string) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
};

export default function OrderLookupCard({
  isSearching,
  lookupValue,
  onLookupValueChange,
  onSubmit,
}: OrderLookupCardProps) {
  return (
    <section className="action-card" aria-labelledby="lookup-heading">
      <div>
        <p className="step-label">Already booked?</p>
        <h2 id="lookup-heading">Find your order</h2>
        <p>Enter one reference, email address, or phone number.</p>
      </div>
      <form className="lookup-form" onSubmit={onSubmit}>
        <label htmlFor="order-lookup">Order details</label>
        <input
          id="order-lookup"
          name="value"
          onChange={(event) => onLookupValueChange(event.target.value)}
          placeholder="Reference, email, or phone"
          required
          type="text"
          value={lookupValue}
        />
        <button
          className="button button-primary"
          disabled={isSearching}
          type="submit"
        >
          {isSearching ? "Searching…" : "Find order"}
        </button>
      </form>
    </section>
  );
}
