import { useState } from 'react';
import { fetchLeaders, type SeasonType } from '../api/espn';
import { Empty, ErrorBox, Loading } from '../components/Status';
import { useAsync } from '../hooks/useAsync';
import { useSeason } from '../SeasonContext';

const SORTS = [
  { key: 'offensive.avgPoints', label: 'Points' },
  { key: 'general.avgRebounds', label: 'Rebounds' },
  { key: 'offensive.avgAssists', label: 'Assists' },
  { key: 'defensive.avgSteals', label: 'Steals' },
  { key: 'defensive.avgBlocks', label: 'Blocks' },
  { key: 'offensive.threePointFieldGoalPct', label: '3P%' },
];

export function Leaders() {
  const { season } = useSeason();
  const [sort, setSort] = useState(SORTS[0].key);
  const [type, setType] = useState<SeasonType>(2);
  const { data, error, loading } = useAsync(() => fetchLeaders(season.year, type, sort), [season.year, type, sort]);

  return (
    <section>
      <div className="page-head">
        <h1>{season.label} player leaders</h1>
        <SeasonTypeToggle value={type} onChange={setType} />
      </div>
      <div className="chips">
        {SORTS.map((s) => (
          <button key={s.key} className={s.key === sort ? 'chip active' : 'chip'} onClick={() => setSort(s.key)}>
            {s.label}
          </button>
        ))}
      </div>
      {loading && <Loading />}
      {error && <ErrorBox error={error} />}
      {data && data.rows.length === 0 && <Empty>No qualified players yet.</Empty>}
      {data && data.rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th className="left">Player</th>
                <th className="left">Team</th>
                {data.columns.map((c) => (
                  <th key={c.key} className={c.key === sort ? 'sorted' : undefined}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={r.athleteId || i}>
                  <td>{i + 1}</td>
                  <td className="left">{r.athlete}</td>
                  <td className="left">{r.team}</td>
                  {data.columns.map((c) => (
                    <td key={c.key} className={c.key === sort ? 'sorted' : undefined}>{r.values[c.key]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">Per-game averages, qualified players only.</p>
    </section>
  );
}

export function SeasonTypeToggle({ value, onChange }: { value: SeasonType; onChange: (v: SeasonType) => void }) {
  return (
    <div className="segmented">
      <button className={value === 2 ? 'active' : ''} onClick={() => onChange(2)}>Regular season</button>
      <button className={value === 3 ? 'active' : ''} onClick={() => onChange(3)}>Playoffs</button>
    </div>
  );
}
