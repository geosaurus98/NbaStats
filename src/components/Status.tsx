import type { ReactNode } from 'react';

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <div className="status">{label}</div>;
}

export function ErrorBox({ error }: { error: Error }) {
  return (
    <div className="status error">
      Couldn't load data: {error.message}. ESPN's public API may be unavailable — try again shortly.
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="status">{children}</div>;
}
