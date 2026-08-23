import { type FormEvent, useState } from "react";
import Alert from "../Alert";

type Props = {
  error: string;
  isSubmitting: boolean;
  onSubmit: (email: string, password: string) => Promise<void>;
};

export default function AdminSignIn({ error, isSubmitting, onSubmit }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(email, password);
  }

  return (
    <section className="page-card admin-login-card">
      <p className="eyebrow">Administration</p>
      <h1>Sign in to the workshop</h1>
      <p className="page-intro">
        Manage orders, due dates, and daily capacity.
      </p>
      <form className="order-form" onSubmit={submit}>
        <div className="form-field">
          <label htmlFor="admin-email">Email address</label>
          <input
            id="admin-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {error && <Alert>{error}</Alert>}
        <button
          className="button button-primary"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </section>
  );
}
