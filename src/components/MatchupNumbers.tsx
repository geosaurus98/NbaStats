// Game preview: the two teams side by side by the numbers, a projected score
// from their offensive and defensive ratings and pace, and how rested each is.
import { useAsync } from '../hooks/useAsync';
import type { Game } from '../api/types';
import { loadLines } from '../api/linesStore';
import { fourFactors, possessions, teamGames, teamSeasons, type TeamSeason } from '../lib/advanced';
import { usDay } from '../lib/gameLines';

const pct1 = (v: number) => `${(v * 100).toFixed(1)}%`;

/** Home court is worth about 3 points: half added to the home side, half taken from the road side. */
const HOME_EDGE = 1.5;

export function MatchupNumbers({ game, season }: { game: Game; season: number }) {
  const { data } = useAsync(async () => {
    const lines = await loadLines(season);
    if (!lines) return undefined;
    const games = teamGames(lines, 2);
    return { games, seasons: teamSeasons(games) };
  }, [season]);
  if (!data) return null;
  const h = data.seasons.get(game.home.team.id);
  const a = data.seasons.get(game.away.team.id);
  if (!h || !a || h.own.g < 2 || a.own.g < 2) return null;
  const all = [...data.seasons.values()];
  const rate = (t: TeamSeason) => {
    const poss = possessions(t.own, t.opp);
    return { ortg: (100 * t.own.pts) / poss, drtg: (100 * t.opp.pts) / poss, pace: (48 * poss) / (t.own.min / 5) };
  };
  const lg = all.map(rate);
  const lgOrtg = lg.reduce((s, r) => s + r.ortg, 0) / lg.length;
  const lgPace = lg.reduce((s, r) => s + r.pace, 0) / lg.length;
  const rh = rate(h);
  const ra = rate(a);
  const pace = (rh.pace * ra.pace) / lgPace;
  const homePts = (pace * ((rh.ortg * ra.drtg) / lgOrtg)) / 100 + HOME_EDGE;
  const awayPts = (pace * ((ra.ortg * rh.drtg) / lgOrtg)) / 100 - HOME_EDGE;
  const day = usDay(game.date);
  const rest = (teamId: string) => {
    const before = data.games.filter((g) => g.teamId === teamId && usDay(g.date) < day).map((g) => usDay(g.date)).sort();
    const last = before[before.length - 1];
    if (!last) return undefined;
    return Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${last}T00:00:00Z`)) / 864e5) - 1;
  };
  const restLabel = (r?: number) => (r == null ? '–' : r === 0 ? 'Back-to-back' : `${r} day${r === 1 ? '' : 's'} off`);
  const fh = fourFactors(h.own, h.opp);
  const fa = fourFactors(a.own, a.opp);
  const dh = fourFactors(h.opp, h.own);
  const da = fourFactors(a.opp, a.own);
  const rows: { label: string; away: number; home: number; fmt: (v: number) => string; higher: boolean }[] = [
    { label: 'Offensive rating', away: ra.ortg, home: rh.ortg, fmt: (v) => v.toFixed(1), higher: true },
    { label: 'Defensive rating', away: ra.drtg, home: rh.drtg, fmt: (v) => v.toFixed(1), higher: false },
    { label: 'Pace', away: ra.pace, home: rh.pace, fmt: (v) => v.toFixed(1), higher: true },
    { label: 'eFG%', away: fa.efg, home: fh.efg, fmt: pct1, higher: true },
    { label: 'Turnover %', away: fa.tov, home: fh.tov, fmt: pct1, higher: false },
    { label: 'Offensive rebound %', away: fa.orb, home: fh.orb, fmt: pct1, higher: true },
    { label: 'Opponent eFG%', away: da.efg, home: dh.efg, fmt: pct1, higher: false },
    { label: 'Record', away: a.wins / (a.wins + a.losses), home: h.wins / (h.wins + h.losses), fmt: (v) => v.toFixed(3).replace(/^0/, ''), higher: true },
  ];
  const restA = rest(game.away.team.id);
  const restH = rest(game.home.team.id);
  return (
    <div className="card">
      <h3>By the numbers</h3>
      <p className="small">
        Projected score: <b>{game.away.team.abbr} {Math.round(awayPts)}</b>, <b>{game.home.team.abbr} {Math.round(homePts)}</b> at about {Math.round(pace)} possessions.{' '}
        Rest: {game.away.team.abbr} {restLabel(restA).toLowerCase()}, {game.home.team.abbr} {restLabel(restH).toLowerCase()}
        {restA != null && restH != null && restA !== restH ? ` (${restA > restH ? game.away.team.abbr : game.home.team.abbr} more rested)` : ''}.
      </p>
      <table className="matchup-table">
        <thead>
          <tr>
            <th>{game.away.team.abbr}</th>
            <th className="center" />
            <th>{game.home.team.abbr}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const awayBetter = r.higher ? r.away > r.home : r.away < r.home;
            return (
              <tr key={r.label}>
                <td className={awayBetter ? 'strong' : 'muted'}>{r.fmt(r.away)}</td>
                <td className="center small">{r.label}</td>
                <td className={!awayBetter ? 'strong' : 'muted'}>{r.fmt(r.home)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted small">Season to date. The projection multiplies each offence by the other's defence against the league average, plus home court; it isn't the Elo pick above, so the two can differ.</p>
    </div>
  );
}
