// Renders its children once the selected season's bundled snapshot (if any)
// has loaded, so pages can read it synchronously.
import { useEffect, useState, type ReactNode } from 'react';
import { loadSnapshot } from '../api/espn';
import { Loading } from './Status';

export function SnapshotGate({ season, children }: { season: number; children: ReactNode }) {
  const [ready, setReady] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    loadSnapshot(season)
      .catch(() => undefined)
      .then(() => live && setReady(season));
    return () => {
      live = false;
    };
  }, [season]);
  return ready === season ? <>{children}</> : <Loading label="Loading season…" />;
}
