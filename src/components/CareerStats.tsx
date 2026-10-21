// All-time career views: season-by-season table, career-arc chart by age and
// honours, from careers.json (loaded on demand).
import { useState } from 'react';
import { useAsync } from '../hooks/useAsync';
import { allStarCounts, arcByAge, AWARD_NAMES, awardsOf, COL, LEAGUE_NAMES, loadCareers, pct, perGame, totals, type CareerData, type StatKey } from '../lib/careers';
import type { Graph } from '../lib/teammates';
import { seasonLabel } from '../lib/teammates';
import { LineChart } from './Charts';
import { ErrorBox, Loading } from './Status';

export function useCareers() {
  return useAsync(() => loadCareers(), []);
}

const f1 = (v: number | undefined) => (v == null ? '–' : v.toFixed(1));
const fp = (v: number | undefined) => (v == null ? '–' : `${(v * 100).toFixed(1)}`);

/** Team codes a player was with in a season, in order. */
function teamsIn(graph: Graph, player: number, season: number): string {
  return (graph.data.stints[player] ?? [])
    .map((r) => graph.data.rosters[r])
    .filter((r) => r[0] === season)
    .map((r) => r[2])
    .join('/');
}

export function CareerStatsTable({ graph, player }: { graph: Graph; player: number }) {
  const careers = useCareers();
  if (careers.loading) return <Loading label="Loading career stats…" />;
  if (careers.error) return <ErrorBox error={careers.error} />;
  const data = careers.data!;
  const rows = data.seasons[player] ?? [];
  if (!rows.length) return null;
  const t = totals(rows);
  const honours = awardsOf(data, player);
  const allStars = allStarCounts(data).get(player) ?? 0;
  const pg = (r: number[], c: number) => (r[c] < 0 || r[COL.g] <= 0 ? '–' : (r[c] / r[COL.g]).toFixed(1));

  return (
    <>
      {(honours.length > 0 || allStars > 0) && (
        <div className="chips tight">
          {allStars > 0 && <span className="chip static">⭐ {allStars}× All-Star</span>}
          {Object.entries(
            honours.reduce<Record<string, number[]>>((m, h) => ({ ...m, [h.award]: [...(m[h.award] ?? []), h.season] }), {}),
          ).map(([award, seasons]) => (
            <span key={award} className="chip static" title={seasons.map(seasonLabel).join(', ')}>
              🏆 {seasons.length > 1 ? `${seasons.length}× ` : ''}{AWARD_NAMES[award] ?? award}
            </span>
          ))}
        </div>
      )}
      <div className="table-wrap">
        <table className="box">
          <thead>
            <tr>
              <th className="left">Season</th>
              <th className="left">Team</th>
              <th>Age</th>
              <th>G</th>
              <th>MIN</th>
              <th>PTS</th>
              <th>REB</th>
              <th>AST</th>
              <th>STL</th>
              <th>BLK</th>
              <th>FG%</th>
              <th>3P%</th>
              <th>FT%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r[COL.season]}${r[COL.lg]}`}>
                <td className="left nowrap">{seasonLabel(r[COL.season])}{r[COL.lg] ? <span className="muted small"> {LEAGUE_NAMES[r[COL.lg]]}</span> : null}</td>
                <td className="left">{teamsIn(graph, player, r[COL.season])}</td>
                <td>{r[COL.age] >= 0 ? r[COL.age] : '–'}</td>
                <td>{r[COL.g]}</td>
                <td>{pg(r, COL.mp)}</td>
                <td>{pg(r, COL.pts)}</td>
                <td>{pg(r, COL.trb)}</td>
                <td>{pg(r, COL.ast)}</td>
                <td>{pg(r, COL.stl)}</td>
                <td>{pg(r, COL.blk)}</td>
                <td>{fp(pct(Math.max(0, r[COL.fg]), Math.max(0, r[COL.fga])))}</td>
                <td>{r[COL.tpa] > 0 ? fp(r[COL.tp] / r[COL.tpa]) : '–'}</td>
                <td>{fp(pct(Math.max(0, r[COL.ft]), Math.max(0, r[COL.fta])))}</td>
              </tr>
            ))}
            <tr className="totals">
              <td className="left">Career</td>
              <td className="left">{t.seasons} seasons</td>
              <td />
              <td>{t.g}</td>
              <td>{f1(perGame(t, 'mp'))}</td>
              <td>{f1(perGame(t, 'pts'))}</td>
              <td>{f1(perGame(t, 'trb'))}</td>
              <td>{f1(perGame(t, 'ast'))}</td>
              <td>{f1(perGame(t, 'stl'))}</td>
              <td>{f1(perGame(t, 'blk'))}</td>
              <td>{fp(pct(t.fg, t.fga))}</td>
              <td>{fp(pct(t.tp, t.tpa))}</td>
              <td>{fp(pct(t.ft, t.fta))}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="muted small">
        Per-game averages. Career totals: {t.values.pts.toLocaleString()} points, {t.values.trb.toLocaleString()} rebounds, {t.values.ast.toLocaleString()} assists.
        "–" = not recorded in that era.
      </p>
    </>
  );
}

const ARC_STATS: StatKey[] = ['pts', 'trb', 'ast', 'mp'];
const COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)'];

/** Per-game stat by age for one to three players, on one chart. */
export function CareerArc({ graph, players }: { graph: Graph; players: number[] }) {
  const careers = useCareers();
  const [stat, setStat] = useState<StatKey>('pts');
  if (!careers.data) return careers.error ? <ErrorBox error={careers.error} /> : <Loading label="Loading career stats…" />;
  const data: CareerData = careers.data;
  const arcs = players.map((p) => arcByAge(data.seasons[p] ?? [], stat));
  const ages = [...new Set(arcs.flatMap((a) => a.map((x) => x.age)))].sort((a, b) => a - b);
  if (ages.length < 2) return null;
  const labels: Record<StatKey, string> = { pts: 'Points', trb: 'Rebounds', ast: 'Assists', mp: 'Minutes', stl: 'Steals', blk: 'Blocks', tp: 'Threes', g: 'Games' };

  return (
    <div className="card">
      <div className="page-head">
        <h3>Career arc: {labels[stat].toLowerCase()} per game by age</h3>
        <div className="chips tight">
          {ARC_STATS.map((k) => (
            <button key={k} className={k === stat ? 'chip active' : 'chip'} onClick={() => setStat(k)}>{labels[k]}</button>
          ))}
        </div>
      </div>
      <LineChart
        ariaLabel={`${labels[stat]} per game at each age`}
        series={players.map((p, i) => ({
          id: String(p),
          label: graph.data.players[p][0],
          color: COLORS[i],
          values: ages.map((age) => {
            const hit = arcs[i].find((x) => x.age === age);
            return hit ? Math.round(hit.value * 10) / 10 : null;
          }),
        }))}
        xs={ages}
        xTickValues={ages.filter((a) => a % 2 === 0).map((a) => ({ at: a, label: String(a) }))}
        xLabel={(i) => `Age ${ages[i]}`}
        yFormat={(v) => v.toFixed(1)}
      />
      <p className="muted small">Age as of 1 February of each season. Gaps are seasons missed.</p>
    </div>
  );
}
