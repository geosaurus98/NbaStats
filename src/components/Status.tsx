import type { ReactNode } from 'react';

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <div className="status">{label}</div>;
}

export function ErrorBox({ error }: { error: Error }) {
  return (
    <div className="status error">
      <div>Couldn't load data: {error.message}.</div>
      <button className="chip retry" onClick={() => window.location.reload()}>Try again</button>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="status">{children}</div>;
}
