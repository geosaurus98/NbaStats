import { useState } from 'react';
import { GroupedTabs, type TabGroup } from '../components/GroupedTabs';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchLeaders, type SeasonType } from '../api/espn';
import { MilestoneWatch } from '../components/MilestoneWatch';
import { AdvancedLeaders, BuildYourOwn, OnOffLeaders, ShotQuality } from '../components/PlayerAnalytics';
import { StreaksView, WpaLeaders } from '../components/PlayerExtras';
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

const LEADER_GROUPS: TabGroup<LeaderTab>[] = [
  { label: 'Season', tabs: [{ id: 'averages', label: 'Season averages' }, { id: 'highs', label: 'Season highs' }, { id: 'streaks', label: 'Streaks' }, { id: 'milestones', label: 'Milestone watch' }] },
  { label: 'Advanced', tabs: [{ id: 'advanced', label: 'Advanced (PER, WS)' }, { id: 'wpa', label: 'Win prob. added' }, { id: 'onoff', label: 'On/off' }, { id: 'quality', label: 'Shot quality' }, { id: 'build', label: 'Build your own' }] },
];
type LeaderTab = 'averages' | 'highs' | 'milestones' | 'advanced' | 'build' | 'onoff' | 'quality' | 'wpa' | 'streaks';

export function Leaders() {
  const { season } = useSeason();
  const [type, setType] = useState<SeasonType>(2);
  const [params, setParams] = useSearchParams();
  const tab = (['highs', 'milestones', 'advanced', 'build', 'onoff', 'quality', 'wpa', 'streaks'] as const).find((t) => t === params.get('tab')) ?? 'averages';
  const regularOnly = tab === 'milestones' || tab === 'advanced' || tab === 'build' || tab === 'streaks';
  const setTab = (t: LeaderTab) => setParams(t === 'averages' ? {} : { tab: t }, { replace: true });

  return (
    <section>
      <div className="page-head">
        <h1>{season.label} player leaders</h1>
        {!regularOnly && <SeasonTypeToggle value={type} onChange={setType} />}
      </div>
      <GroupedTabs groups={LEADER_GROUPS} active={tab} onChange={setTab} />
      {tab === 'averages' && <Averages season={season.year} type={type} />}
      {tab === 'highs' && <SeasonHighs season={season.year} seasonType={type} />}
      {tab === 'milestones' && <MilestoneWatch season={season.year} />}
      {tab === 'advanced' && <AdvancedLeaders season={season.year} />}
      {tab === 'build' && <BuildYourOwn season={season.year} />}
      {tab === 'onoff' && <OnOffLeaders season={season.year} type={type} />}
      {tab === 'quality' && <ShotQuality season={season.year} type={type} />}
      {tab === 'wpa' && <WpaLeaders season={season.year} type={type} />}
      {tab === 'streaks' && <StreaksView season={season.year} />}
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
          <button key={s.key} className={s.key === sort ? 'chip active' : 'chip'} aria-pressed={s.key === sort} onClick={() => setSort(s.key)}>
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
