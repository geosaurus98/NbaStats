import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchLeaders, type SeasonType } from '../api/espn';
import { MilestoneWatch } from '../components/MilestoneWatch';
import { AdvancedLeaders, BuildYourOwn, OnOffLeaders, ShotQuality } from '../components/PlayerAnalytics';
import { SeasonHighs } from '../components/SeasonHighs';
import { SeasonTypeToggle } from '../components/SeasonTypeToggle';
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
  const [type, setType] = useState<SeasonType>(2);
  const [params, setParams] = useSearchParams();
  const tab = (['highs', 'milestones', 'advanced', 'build', 'onoff', 'quality'] as const).find((t) => t === params.get('tab')) ?? 'averages';
  const regularOnly = tab === 'milestones' || tab === 'advanced' || tab === 'build';
  const setTab = (t: string) => setParams(t === 'averages' ? {} : { tab: t }, { replace: true });

  return (
    <section>
      <div className="page-head">
        <h1>{season.label} player leaders</h1>
        {!regularOnly && <SeasonTypeToggle value={type} onChange={setType} />}
      </div>
      <div className="tabs">
        <button className={tab === 'averages' ? 'active' : ''} onClick={() => setTab('averages')}>Season averages</button>
        <button className={tab === 'highs' ? 'active' : ''} onClick={() => setTab('highs')}>Season highs</button>
        <button className={tab === 'milestones' ? 'active' : ''} onClick={() => setTab('milestones')}>Milestone watch</button>
        <button className={tab === 'advanced' ? 'active' : ''} onClick={() => setTab('advanced')}>Advanced (PER, WS)</button>
        <button className={tab === 'build' ? 'active' : ''} onClick={() => setTab('build')}>Build your own</button>
        <button className={tab === 'onoff' ? 'active' : ''} onClick={() => setTab('onoff')}>On/off</button>
        <button className={tab === 'quality' ? 'active' : ''} onClick={() => setTab('quality')}>Shot quality</button>
      </div>
      {tab === 'averages' && <Averages season={season.year} type={type} />}
      {tab === 'highs' && <SeasonHighs season={season.year} seasonType={type} />}
      {tab === 'milestones' && <MilestoneWatch season={season.year} />}
      {tab === 'advanced' && <AdvancedLeaders season={season.year} />}
      {tab === 'build' && <BuildYourOwn season={season.year} />}
      {tab === 'onoff' && <OnOffLeaders season={season.year} type={type} />}
      {tab === 'quality' && <ShotQuality season={season.year} type={type} />}
    </section>
  );
}

function Averages({ season, type }: { season: number; type: SeasonType }) {
  const [sort, setSort] = useState(SORTS[0].key);
  const { data, error, loading } = useAsync(() => fetchLeaders(season, type, sort), [season, type, sort]);

  return (
    <>
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
                  <td className="left">{r.athleteId ? <Link to={`/player/${r.athleteId}`}>{r.athlete}</Link> : r.athlete}</td>
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
    </>
  );
}
