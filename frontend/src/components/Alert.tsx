import type { ReactNode } from "react";

export default function Alert({ children }: { children: ReactNode }) {
  return (
    <p className="error-message" role="alert">
      {children}
    </p>
  );
}
