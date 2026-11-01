// Tabs for a long page, kept in the address (?tab=…) so a view can be linked
// and the back button works; the first tab is the default and has no param.
import { useSearchParams } from 'react-router-dom';

export interface PageTab<T extends string> {
  id: T;
  label: string;
}

export function usePageTab<T extends string>(tabs: readonly PageTab<T>[]): [T, (id: T) => void] {
  const [params, setParams] = useSearchParams();
  const tab = tabs.find((t) => t.id === params.get('tab'))?.id ?? tabs[0].id;
  const set = (id: T) => {
    const next = new URLSearchParams(params);
    if (id === tabs[0].id) next.delete('tab');
    else next.set('tab', id);
    setParams(next, { replace: true });
  };
  return [tab, set];
}

export function PageTabs<T extends string>({ tabs, active, onChange, label }: { tabs: readonly PageTab<T>[]; active: T; onChange: (id: T) => void; label: string }) {
  return (
    <div className="tabs page-tabs" role="group" aria-label={label}>
      {tabs.map((t) => (
        <button key={t.id} className={t.id === active ? 'active' : ''} aria-pressed={t.id === active} onClick={() => onChange(t.id)}>{t.label}</button>
      ))}
    </div>
  );
}
