// A two-level tab bar for pages with many views: section buttons, then the
// views in the chosen section. On narrow screens it becomes one grouped
// dropdown so nothing hides off the edge.
import { useEffect, useState } from 'react';

export interface TabGroup<T extends string> {
  label: string;
  tabs: { id: T; label: string }[];
}

function useNarrow(px = 640) {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth <= px);
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth <= px);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [px]);
  return narrow;
}

export function GroupedTabs<T extends string>({ groups, active, onChange }: { groups: TabGroup<T>[]; active: T; onChange: (id: T) => void }) {
  const narrow = useNarrow();
  const current = groups.find((g) => g.tabs.some((t) => t.id === active)) ?? groups[0];
  if (narrow) {
    return (
      <label className="tab-select">
        <span className="muted small">View</span>
        <select value={active} onChange={(e) => onChange(e.target.value as T)}>
          {groups.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.tabs.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
    );
  }
  return (
    <div className="grouped-tabs">
      <div className="tab-groups" role="tablist" aria-label="Sections">
        {groups.map((g) => (
          <button key={g.label} className={g === current ? 'active' : ''} onClick={() => g !== current && onChange(g.tabs[0].id)}>{g.label}</button>
        ))}
      </div>
      <div className="tabs">
        {current.tabs.map((t) => (
          <button key={t.id} className={t.id === active ? 'active' : ''} onClick={() => onChange(t.id)}>{t.label}</button>
        ))}
      </div>
    </div>
  );
}
