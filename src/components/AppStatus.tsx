// Offline notice and the "Install app" button (when the browser offers it).
import { useEffect, useState } from 'react';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
}

let deferred: InstallEvent | undefined;
const waiting = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    waiting.forEach((f) => f());
  });
}

export function OfflineBar() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  if (online) return null;
  return <div className="offline-bar" role="status">You're offline: showing the data saved on this device. Live scores return when you reconnect.</div>;
}

/** Shown only when the browser says the site can be installed. */
export function InstallButton() {
  const [ready, setReady] = useState(!!deferred);
  useEffect(() => {
    const f = () => setReady(true);
    waiting.add(f);
    return () => void waiting.delete(f);
  }, []);
  if (!ready || !deferred) return null;
  return (
    <button
      className="chip"
      onClick={async () => {
        await deferred?.prompt();
        deferred = undefined;
        setReady(false);
      }}
    >
      ⬇ Install app
    </button>
  );
}
