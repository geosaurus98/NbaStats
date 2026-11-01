// Standings → NBA Cup: the six group tables (worked out from the group-play
// games), the wildcard race and the knockout rounds.
import { Link } from 'react-router-dom';
import { fetchLeagueGames } from '../api/espn';
import { compactGame } from '../api/snapshot';
import type { Conference, TeamRef } from '../api/types';
import { useAsync } from '../hooks/useAsync';
import { formatShortDate } from '../lib/dates';
import { cupGames, cupGroups, wildcards } from '../lib/nbaCup';
import { Empty, ErrorBox, Loading } from './Status';
import { TeamLogo } from './TeamLogo';

export function CupTable({ season, conferences }: { season: number; conferences: Conference[] }) {
  const { data, error, loading } = useAsync(() => fetchLeagueGames(season, 2), [season]);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const teams = new Map<string, TeamRef>(conferences.flatMap((c) => c.rows.map((r) => [r.team.id, r.team] as [string, TeamRef])));
  const conf = new Map(conferences.flatMap((c) => c.rows.map((r) => [r.team.id, /east/i.test(c.name) ? 'East' : 'West'] as [string, string])));
  const { group, knockout } = cupGames((data?.games ?? []).map(compactGame));
  if (!group.length) return <Empty>No NBA Cup games in this season's schedule.</Empty>;
  const groups = cupGroups(group, conf);
  const wild = wildcards(groups);
  const played = group.filter((g) => g[4] != null).length;
  const done = played === group.length;
  const rounds = (['Quarterfinals', 'Semifinals', 'Championship'] as const).map((r) => ({ round: r, games: knockout.filter((k) => k.round === r) }));
  const team = (id: string) => teams.get(id);
  return (
    <>
      <p className="muted">
        Six groups of five, each team playing the other four once. Group winners and the best second-placed team in each conference (the wildcard) reach the quarterfinals. Ties: head-to-head (two teams), then point differential, then points scored. ESPN doesn't publish the group names, so they're numbered here. {done ? 'Group play is finished.' : `${played} of ${group.length} group games played.`}
      </p>
      <div className="cup-groups">
        {groups.map((g) => (
          <div key={`${g.conference}${g.index}`} className="table-wrap">
            <h3 className="table-title">{g.conference} · Group {g.index}</h3>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th className="left">Team</th>
                  <th>W-L</th>
                  <th title="Point differential">+/-</th>
                  <th title="Points scored">PF</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r, i) => {
                  const t = team(r.teamId);
                  const through = i === 0 ? 'Group winner' : wild.get(g.conference) === r.teamId ? 'Wildcard' : '';
                  return (
                    <tr key={r.teamId} className={i === 0 ? 'cup-lead' : undefined}>
                      <td>{i + 1}</td>
                      <td className="left nowrap">
                        <Link to={`/team/${r.teamId}`} className="team-cell">{t && <TeamLogo team={t} size={18} />}{t?.shortName ?? r.teamId}</Link>{' '}
                        {through && <span className={`small ${i === 0 ? 'win' : 'muted'}`} title={done ? 'Through to the quarterfinals' : 'In position to qualify'}>{through === 'Wildcard' ? 'WC' : '★'}</span>}
                      </td>
                      <td>{r.w}-{r.l}</td>
                      <td className={r.pf - r.pa > 0 ? 'win' : r.pf - r.pa < 0 ? 'loss' : undefined}>{r.pf - r.pa > 0 ? '+' : ''}{r.pf - r.pa}</td>
                      <td className="muted">{r.pf}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      <p className="muted small">★ group leader · WC best second-placed team in the conference{done ? '' : ' (positions while group play is on)'}.</p>
      {knockout.length > 0 && (
        <div className="cup-bracket">
          {rounds.filter((r) => r.games.length).map((r) => (
            <div key={r.round} className="card">
              <h3>{r.round}</h3>
              {r.games.map((k) => {
                const final = k.homeScore != null && k.awayScore != null;
                const homeWon = final && k.homeScore! > k.awayScore!;
                return (
                  <Link key={k.gameId} to={`/game/${k.gameId}`} className="cup-game">
                    <span className={final && !homeWon ? 'strong' : undefined}>{team(k.awayId)?.abbr ?? k.awayId} {final ? k.awayScore : ''}</span>
                    <span className="muted small">@</span>
                    <span className={homeWon ? 'strong' : undefined}>{team(k.homeId)?.abbr ?? k.homeId} {final ? k.homeScore : ''}</span>
                    <span className="muted small">{formatShortDate(k.date)}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
