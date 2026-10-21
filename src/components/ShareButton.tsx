// Share via the phone's share sheet when available, otherwise copy to the
// clipboard. Links always point at the hosted site (the standalone file runs
// from file://, which nobody else can open).
import { useState } from 'react';

const SITE = 'https://geosaurus98.github.io/NbaStats/';

/** Link to the current page on the hosted site. */
export function pageUrl(): string {
  const base = location.protocol === 'https:' ? location.origin + location.pathname : SITE;
  return base + location.hash;
}

async function share(text: string | undefined, url: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ text, url });
      return 'shared';
    }
  } catch {
    // Cancelled or unsupported: fall back to copying.
  }
  try {
    await navigator.clipboard.writeText(text ? `${text}\n${url}` : url);
    return 'copied';
  } catch {
    return 'failed';
  }
}

export function ShareButton({ text, label = 'Share', compact = false }: { text?: string; label?: string; compact?: boolean }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const go = async () => {
    const r = await share(text, pageUrl());
    if (r === 'shared') return;
    setState(r);
    setTimeout(() => setState('idle'), 2000);
  };
  const shown = state === 'copied' ? '✓ Copied' : state === 'failed' ? 'Copy failed' : label;
  return (
    <button className={compact ? 'share-button compact' : 'chip'} onClick={go} title={text ? 'Share your result' : 'Copy a link to this page'}>
      🔗{compact && state === 'idle' ? '' : ` ${shown}`}
    </button>
  );
}
