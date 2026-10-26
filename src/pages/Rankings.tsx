import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchLeagueGames, fetchTeamStats, type SeasonType } from '../api/espn';
import { ErrorBox, Loading } from '../components/Status';
import { TeamLogo } from '../components/TeamLogo';
import { useAsync } from '../hooks/useAsync';
import { addStrengthOfSchedule, teamRecords, type TeamRecord } from '../lib/league';
import { useSeason } from '../SeasonContext';
import { SeasonTypeToggle } from '../components/SeasonTypeToggle';
import { FourFactorsTable, GarbageTime, LuckMeter, QuarterSplits } from '../components/TeamAnalytics';

interface Col {
  key: string;
  label: string;
  title: string;
  value: (r: Row) => number | undefined;
  show: (r: Row) => string;
  lowerIsBetter?: boolean;
}

type Row = TeamRecord & { extra: Record<string, number | undefined> };

const per = (n: number, gp: number) => (gp ? n / gp : undefined);
const f1 = (v?: number) => (v == null ? '-' : v.toFixed(1));
const signed = (v?: number) => (v == null ? '-' : `${v > 0 ? '+' : ''}${v.toFixed(1)}`);
const pct3 = (v?: number) => (v == null ? '-' : v.toFixed(3).replace(/^0/, ''));
const wl = (w: number, l: number) => `${w}-${l}`;

const BASE_COLS: Col[] = [
  { key: 'win', label: 'W-L', title: 'Win %', value: (r) => per(r.wins, r.gp), show: (r) => wl(r.wins, r.losses) },
  { key: 'ppg', label: 'PPG', title: 'Points per game', value: (r) => per(r.pf, r.gp), show: (r) => f1(per(r.pf, r.gp)) },
  { key: 'opp', label: 'OPP', title: 'Points allowed per game', value: (r) => per(r.pa, r.gp), show: (r) => f1(per(r.pa, r.gp)), lowerIsBetter: true },
  { key: 'net', label: 'NET', title: 'Average margin', value: (r) => per(r.pf - r.pa, r.gp), show: (r) => signed(per(r.pf - r.pa, r.gp)) },
  { key: 'home', label: 'Home', title: 'Home record', value: (r) => per(r.homeW, r.homeW + r.homeL), show: (r) => wl(r.homeW, r.homeL) },
  { key: 'road', label: 'Road', title: 'Road record', value: (r) => per(r.roadW, r.roadW + r.roadL), show: (r) => wl(r.roadW, r.roadL) },
  { key: 'close', label: 'Close', title: 'Record in games decided by 5 or fewer', value: (r) => per(r.closeW, r.closeW + r.closeL), show: (r) => wl(r.closeW, r.closeL) },
  { key: 'streak', label: 'Best run', title: 'Longest winning streak', value: (r) => r.longestWin, show: (r) => String(r.longestWin) },
  { key: 'sos', label: 'SOS', title: 'Strength of schedule so far: average opponent win %', value: (r) => r.sosPlayed, show: (r) => pct3(r.sosPlayed) },
  { key: 'sosr', label: 'SOS left', title: 'Strength of remaining schedule', value: (r) => r.sosRemaining, show: (r) => pct3(r.sosRemaining) },
];

const LOWER_BETTER_STATS = new Set(['offensive.avgTurnovers']);

const TABS = [
  { id: 'table', label: 'Rankings' },
  { id: 'factors', label: 'Four factors' },
  { id: 'luck', label: 'Luck meter' },
  { id: 'quarters', label: 'Quarter splits' },
  { id: 'garbage', label: 'Garbage time' },
] as const;
type Tab = (typeof TABS)[number]['id'];

export function Rankings() {
  const { season } = useSeason();
  const [type, setType] = useState<SeasonType>(2);
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.find((t) => t.id === params.get('tab'))?.id ?? 'table';
  return (
    <section>
      <div className="page-head">
        <h1>{season.label} team rankings</h1>
        {tab !== 'luck' && <SeasonTypeToggle value={type} onChange={setType} />}
      </div>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setParams(t.id === 'table' ? {} : { tab: t.id }, { replace: true })}>{t.label}</button>
        ))}
      </div>
      {tab === 'table' && <RankingTable season={season.year} type={type} />}
      {tab === 'factors' && <FourFactorsTable season={season.year} type={type} />}
      {tab === 'luck' && <LuckMeter season={season.year} />}
      {tab === 'quarters' && <QuarterSplits season={season.year} type={type} />}
      {tab === 'garbage' && <GarbageTime season={season.year} type={type} />}
    </section>
  );
}

function RankingTable({ season: year, type }: { season: number; type: SeasonType }) {
  const [sort, setSort] = useState('net');
  const [asc, setAsc] = useState(false);

  const { data, error, loading } = useAsync(async () => {
    const [league, stats] = await Promise.all([
      fetchLeagueGames(year, type),
      fetchTeamStats(year, type).catch(() => undefined),
    ]);
    const records = addStrengthOfSchedule(teamRecords(league.teams, league.games), league.games).filter((r) => r.gp + r.remaining > 0);
    const statsById = new Map(stats?.rows.map((r) => [r.teamId, r.values]));
    return { rows: records.map((r) => ({ ...r, extra: statsById.get(r.team.id) ?? {} })), statCols: stats?.columns ?? [] };
  }, [year, type]);

  const statCols: Col[] = (data?.statCols ?? []).map((c) => {
    return {
      key: c.key,
      label: c.label,
      title: c.label,
      value: (r) => r.extra[c.key],
      show: (r) => (r.extra[c.key] == null ? '-' : r.extra[c.key]!.toFixed(1)),
      lowerIsBetter: LOWER_BETTER_STATS.has(c.key),
    };
  });
  const hasRemaining = data?.rows.some((r) => r.remaining > 0);
  const cols = [...BASE_COLS.filter((c) => c.key !== 'sosr' || hasRemaining), ...statCols];
  const active = cols.find((c) => c.key === sort) ?? cols[0];
  const rows = [...(data?.rows ?? [])].sort((a, b) => {
    const va = active.value(a) ?? -Infinity;
    const vb = active.value(b) ?? -Infinity;
    return asc ? va - vb : vb - va;
  });

  const choose = (c: Col) => {
    if (c.key === sort) setAsc(!asc);
    else {
      setSort(c.key);
      setAsc(!!c.lowerIsBetter);
    }
  };

  return (
    <>
      <p className="muted">Click a column to rank by it. Click again to reverse the order.</p>
      {loading && <Loading label="Loading every team's games…" />}
      {error && <ErrorBox error={error} />}
      {data && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th className="left">Team</th>
                {cols.map((c) => (
                  <th key={c.key} title={c.title} className={c.key === active.key ? 'sorted sortable' : 'sortable'} onClick={() => choose(c)}>
                    {c.label}
                    {c.key === active.key ? (asc ? ' ↑' : ' ↓') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.team.id}>
                  <td>{i + 1}</td>
                  <td className="left">
                    <Link to={`/team/${r.team.id}`} className="team-cell">
                      <TeamLogo team={r.team} size={20} />
                      {r.team.shortName}
                    </Link>
                  </td>
                  {cols.map((c) => (
                    <td key={c.key} className={c.key === active.key ? 'sorted' : undefined}>{c.show(r)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">
        SOS = average win % of the opponents a team has played (and, while the season is on, still has to play).
        Higher means a harder schedule.
      </p>
    </>
  );
}
