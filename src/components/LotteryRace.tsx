// Draft hub → Lottery race: how each team's No. 1 pick odds have moved week by
// week, and (in the 3-2-1 lottery) who is in or near the relegation places.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { fetchLeagueGames, fetchStandings } from '../api/espn';
import type { Game } from '../api/types';
import { useAsync } from '../hooks/useAsync';
import { addDays, formatShortDate, usDate } from '../lib/dates';
import { loadFranchiseData } from '../lib/franchiseData';
import { FRANCHISES } from '../lib/franchises';
import { countsInStandings, isFinal } from '../lib/league';
import { lotteryField, lotteryFormat, type LotterySlot } from '../lib/lottery';
import { repeatLimits } from '../lib/lotteryHistory';
import { weekStart } from '../lib/recap';
import { LineChart } from './Charts';
import { ErrorBox, Loading } from './Status';
import { TeamLogo } from './TeamLogo';

/** Win/loss records from the games finished before `day` (US date, exclusive). */
function recordsBefore(games: Game[], day: string): Map<string, [number, number]> {
  const out = new Map<string, [number, number]>();
  for (const g of games) {
    if (!isFinal(g) || !countsInStandings(g) || usDate(new Date(g.date)) >= day) continue;
    const homeWon = (g.home.score ?? 0) > (g.away.score ?? 0);
    for (const [id, won] of [[g.home.team.id, homeWon], [g.away.team.id, !homeWon]] as const) {
      const r = out.get(id) ?? [0, 0];
      r[won ? 0 : 1]++;
      out.set(id, r);
    }
  }
  return out;
}

/** No. 1 pick chance for each lottery team: its share of the balls among teams allowed to win it. */
function firstPickOdds(slots: LotterySlot[]): Map<string, number> {
  const pool = slots.filter((s) => !s.noFirst).reduce((n, s) => n + s.weight, 0);
  return new Map(slots.map((s) => [s.id, s.noFirst || !pool ? 0 : s.weight / pool]));
}

export function LotteryRace({ season }: { season: number }) {
  const format = lotteryFormat(season);
  const data = useAsync(async () => {
    const [league, standings, fr] = await Promise.all([fetchLeagueGames(season, 2), fetchStandings(season), loadFranchiseData()]);
    return { league, standings, fr };
  }, [season]);
  const model = useMemo(() => {
    if (!data.data) return undefined;
    const { league, standings, fr } = data.data;
    const conf = new Map(standings.flatMap((c) => c.rows.map((r) => [r.team.id, c.name] as [string, string])));
    const limits = format === '321' ? repeatLimits(fr, season) : undefined;
    const code = (id: string) => FRANCHISES.find((f) => f.espnId === id)?.id ?? '';
    const finals = league.games.filter((g) => isFinal(g) && countsInStandings(g));
    if (!finals.length) return { weeks: [] as string[], series: new Map<string, number[]>(), latest: [] as LotterySlot[], recs: new Map<string, [number, number]>() };
    const first = weekStart(usDate(new Date(finals.map((g) => g.date).sort()[0])));
    const last = usDate(new Date(finals.map((g) => g.date).sort().pop()!));
    const weeks: string[] = [];
    for (let w = addDays(first, 7); w <= addDays(last, 7); w = addDays(w, 7)) weeks.push(w);
    const series = new Map<string, number[]>();
    let latest: LotterySlot[] = [];
    let recs = new Map<string, [number, number]>();
    weeks.forEach((w, k) => {
      recs = recordsBefore(league.games, w);
      const field = lotteryField(
        [...conf.keys()].map((id) => {
          const [wins, losses] = recs.get(id) ?? [0, 0];
          return { id, conference: conf.get(id)!, key: wins + losses ? wins / (wins + losses) : 0.5 };
        }),
        format,
      );
      latest = field.lottery.map((s) => (limits ? { ...s, noFirst: limits.noFirst.has(code(s.id)), noTop5: limits.noTop5.has(code(s.id)) } : s));
      const odds = firstPickOdds(latest);
      for (const id of conf.keys()) {
        const row = series.get(id) ?? new Array(weeks.length).fill(0);
        row[k] = odds.get(id) ?? 0;
        series.set(id, row);
      }
    });
    return { weeks, series, latest, recs };
  }, [data.data, format, season]);

  if (data.error) return <ErrorBox error={data.error} />;
  if (!model) return <Loading label="Replaying the standings week by week…" />;
  if (!model.weeks.length) return <p className="muted">No games yet this season.</p>;
  const teams = new Map(data.data!.league.teams.map((t) => [t.id, t]));
  const now = firstPickOdds(model.latest);
  const shown = [...now.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id]) => id);
  const rec = (id: string) => model.recs.get(id) ?? [0, 0];
  const pct = (id: string) => {
    const [w, l] = rec(id);
    return w + l ? w / (w + l) : 0.5;
  };
  // Relegation watch: the worst non-play-in records, and how far the next teams are from the bottom three.
  const outside = model.latest.filter((s) => s.relegated || s.group === 'Outside the play-in').sort((a, b) => pct(a.id) - pct(b.id));
  const third = outside[2];
  const gamesBehind = (id: string) => {
    if (!third) return 0;
    const [w1, l1] = rec(third.id);
    const [w2, l2] = rec(id);
    return (w2 - w1 + (l1 - l2)) / 2;
  };
  return (
    <>
      <p className="muted">
        Each team's chance of the No. 1 pick if the season had ended that week, from the standings at the time
        {format === '321' ? ' (3-2-1 lottery: 37 balls, repeat limits applied)' : ''}. The eight teams with the best odds now are shown.
      </p>
      <div className="card">
        <LineChart
          ariaLabel="No. 1 pick odds by week"
          series={shown.map((id, i) => ({ id, label: teams.get(id)?.abbr ?? id, values: model.series.get(id)!.map((v) => Math.round(v * 1000) / 10), color: `var(--series-${i + 1})` }))}
          xLabel={(i) => `Week of ${formatShortDate(`${addDays(model.weeks[i], -7)}T12:00:00Z`)}`}
          xTick={(i) => formatShortDate(`${addDays(model.weeks[i], -7)}T12:00:00Z`)}
          yFormat={(v) => `${v}%`}
          step
        />
      </div>
      {format === '321' && (
        <div className="card">
          <h3>Relegation watch</h3>
          <p className="muted small">The three worst records drop from 3 balls to 2 (5.4% for No. 1 instead of 8.1%), so the bottom of the table is now a place to avoid.</p>
          <div className="table-wrap flush">
            <table>
              <thead>
                <tr>
                  <th className="left">Team</th>
                  <th>W-L</th>
                  <th>Balls</th>
                  <th title="Games ahead of the third-worst record">Games clear</th>
                </tr>
              </thead>
              <tbody>
                {outside.slice(0, 6).map((s, i) => {
                  const t = teams.get(s.id);
                  const [w, l] = rec(s.id);
                  return (
                    <tr key={s.id} className={i === 2 ? 'cut' : undefined}>
                      <td className="left">{t && <Link to={`/team/${s.id}`} className="team-cell"><TeamLogo team={t} size={18} />{t.abbr}</Link>}</td>
                      <td>{w}-{l}</td>
                      <td>{s.weight}{s.relegated ? ' (relegated)' : ''}</td>
                      <td className="muted">{i < 3 ? '–' : gamesBehind(s.id).toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
