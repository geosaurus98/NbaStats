import { Link, useSearchParams } from 'react-router-dom';
import { fetchTeams, fetchTeamSchedule } from '../api/espn';
import type { Game, TeamRef } from '../api/types';
import { Empty, ErrorBox, Loading } from '../components/Status';
import { TeamLogo } from '../components/TeamLogo';
import { useAsync } from '../hooks/useAsync';
import { formatShortDate, formatTime } from '../lib/dates';
import { involves, isFinal, sides, teamRecords, won } from '../lib/league';
import { useSeason } from '../SeasonContext';

export function HeadToHead() {
  const { season } = useSeason();
  const [params, setParams] = useSearchParams();
  const a = params.get('a') ?? '';
  const b = params.get('b') ?? '';
  const teams = useAsync(() => fetchTeams(season.year), [season.year]);

  const set = (key: 'a' | 'b', v: string) => {
    const next = new URLSearchParams(params);
    next.set(key, v);
    setParams(next);
  };

  const h2h = useAsync(async () => {
    if (!a || !b || a === b) return undefined;
    const [reg, post, regB] = await Promise.all([
      fetchTeamSchedule(a, season.year, 2),
      fetchTeamSchedule(a, season.year, 3).catch(() => ({ games: [] as Game[] })),
      fetchTeamSchedule(b, season.year, 2),
    ]);
    const meetings = [...reg.games, ...post.games]
      .filter((g) => involves(g, b))
      .sort((x, y) => x.date.localeCompare(y.date));
    return { meetings, seasonA: reg.games, seasonB: regB.games };
  }, [a, b, season.year]);

  const teamA = teams.data?.find((t) => t.id === a);
  const teamB = teams.data?.find((t) => t.id === b);

  return (
    <section>
      <h1>{season.label} head-to-head</h1>
      {teams.error && <ErrorBox error={teams.error} />}
      <div className="h2h-pickers">
        <TeamSelect teams={teams.data ?? []} value={a} onChange={(v) => set('a', v)} />
        <span className="muted">vs</span>
        <TeamSelect teams={teams.data ?? []} value={b} onChange={(v) => set('b', v)} />
      </div>

      {(!a || !b) && <Empty>Pick two teams to compare.</Empty>}
      {a && a === b && <Empty>Pick two different teams.</Empty>}
      {h2h.loading && a && b && a !== b && <Loading />}
      {h2h.error && <ErrorBox error={h2h.error} />}
      {h2h.data && teamA && teamB && <Comparison a={teamA} b={teamB} {...h2h.data} />}
    </section>
  );
}

function TeamSelect({ teams, value, onChange }: { teams: TeamRef[]; value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Choose a team…</option>
      {teams.map((t) => (
        <option key={t.id} value={t.id}>{t.name}</option>
      ))}
    </select>
  );
}

function Comparison({ a, b, meetings, seasonA, seasonB }: { a: TeamRef; b: TeamRef; meetings: Game[]; seasonA: Game[]; seasonB: Game[] }) {
  const played = meetings.filter(isFinal);
  const winsA = played.filter((g) => won(g, a.id)).length;
  const ptsA = played.reduce((s, g) => s + (sides(g, a.id)[0].score ?? 0), 0);
  const ptsB = played.reduce((s, g) => s + (sides(g, b.id)[0].score ?? 0), 0);
  const [recA] = teamRecords([a], seasonA);
  const [recB] = teamRecords([b], seasonB);
  const avg = (n: number, d: number) => (d ? (n / d).toFixed(1) : '-');

  const rows: [string, string, string][] = [
    ['Head-to-head wins', String(winsA), String(played.length - winsA)],
    ['Avg points in meetings', avg(ptsA, played.length), avg(ptsB, played.length)],
    ['Season record', `${recA.wins}-${recA.losses}`, `${recB.wins}-${recB.losses}`],
    ['Season PPG', avg(recA.pf, recA.gp), avg(recB.pf, recB.gp)],
    ['Season points allowed', avg(recA.pa, recA.gp), avg(recB.pa, recB.gp)],
    ['Season last 10', recA.last10, recB.last10],
  ];

  return (
    <>
      <div className="scorebug">
        <Link to={`/team/${a.id}`} className="bug-team">
          <TeamLogo team={a} size={56} />
          <div className="bug-name">{a.shortName}</div>
          <div className="bug-score">{winsA}</div>
        </Link>
        <div className="bug-status">
          {played.length ? `Wins in ${played.length} meeting${played.length === 1 ? '' : 's'}` : 'No meetings yet'}
        </div>
        <Link to={`/team/${b.id}`} className="bug-team">
          <TeamLogo team={b} size={56} />
          <div className="bug-name">{b.shortName}</div>
          <div className="bug-score">{played.length - winsA}</div>
        </Link>
      </div>

      <div className="table-wrap narrow">
        <table>
          <thead>
            <tr>
              <th>{a.abbr}</th>
              <th />
              <th>{b.abbr}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, va, vb]) => (
              <tr key={label}>
                <td>{va}</td>
                <td className="muted">{label}</td>
                <td>{vb}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Meetings ({meetings.length})</h2>
      {meetings.length === 0 && <Empty>These teams don't play each other this season.</Empty>}
      {meetings.length > 0 && (
        <div className="table-wrap">
          <table>
            <tbody>
              {meetings.map((g) => (
                <tr key={g.id}>
                  <td className="left nowrap">{formatShortDate(g.date)}</td>
                  <td className="left">
                    {g.away.team.abbr} @ {g.home.team.abbr}
                    {g.note && <span className="muted small"> · {g.note}</span>}
                  </td>
                  <td className="left">
                    <Link to={`/game/${g.id}`}>
                      {isFinal(g) ? (
                        <>
                          <b>{won(g, a.id) ? a.abbr : b.abbr}</b> {Math.max(g.home.score!, g.away.score!)}-{Math.min(g.home.score!, g.away.score!)}
                        </>
                      ) : (
                        formatTime(g.date)
                      )}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
