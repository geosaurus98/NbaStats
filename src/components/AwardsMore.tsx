// Awards page: the Sixth Man, Most Improved, Clutch Player and Coach of the
// Year races, and your own ballot for every award (saved in this browser).
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchLeagueGames, seasonSnapshot } from '../api/espn';
import { loadSnapshot } from '../api/snapshotStore';
import { useAsync } from '../hooks/useAsync';
import { candidates, rankAward, type Ranked } from '../lib/awards';
import { MORE_METHOD, rankClutch, rankCoaches, rankMostImproved, rankSixthMan, type CoachRanked, type MoreAwardId } from '../lib/awardsMore';
import { C } from '../lib/clutch';
import { FRANCHISES } from '../lib/franchises';
import type { StaffData } from '../lib/staff';
import { Empty, Loading } from './Status';
import { useStaff } from './Staff';
import { TeamLogo } from './TeamLogo';
import { useCareers } from './CareerStats';
import { nameKey } from '../lib/boxTotals';
import { useTeammateGraph } from '../lib/teammateStore';

/** Award keys in careers.json (Basketball-Reference's), for the real winner of a finished season. */
const REAL_KEY: Partial<Record<MoreAwardId, string>> = { sixth: 'nba smoy', mip: 'nba mip', clutch: 'nba clutch_poy' };

/** "Real winner: X (the model's No. 3)", once a finished season's award is in the history data. */
function RealWinner({ award, season, ranked }: { award: MoreAwardId; season: number; ranked: Ranked[] }) {
  const careers = useCareers();
  const graph = useTeammateGraph();
  const key = REAL_KEY[award];
  const row = key ? careers.data?.awards[key]?.find((r) => r[0] === season && r[3]) : undefined;
  const name = row && graph?.data.players[row[1]]?.[0];
  if (!name) return null;
  const at = ranked.findIndex((r) => nameKey(r.c.name) === nameKey(name));
  return <p className="small"><b>Real winner:</b> {name}{at >= 0 ? ` (the model’s No. ${at + 1})` : ' (outside the model’s list)'}.</p>;
}

const SHOW = 15;
type TeamLite = { id: string; abbr: string; name: string; shortName: string; logo?: string };

/** Everything the extra races need: this season's and last season's candidates and games. */
function useRaces(season: number) {
  const snap = seasonSnapshot(season);
  const data = useAsync(async () => {
    const [prev, games, prevGames] = await Promise.all([
      loadSnapshot(season - 1).catch(() => undefined),
      fetchLeagueGames(season, 2).then((r) => r.games),
      fetchLeagueGames(season - 1, 2).then((r) => r.games).catch(() => undefined),
    ]);
    return { prev, games, prevGames };
  }, [season]);
  return useMemo(() => {
    if (!snap || !data.data) return undefined;
    const { list, leagueDrtg } = candidates(snap);
    const prevList = data.data.prev ? candidates(data.data.prev).list : [];
    const clutch = snap.clutch?.['2'];
    return {
      list,
      leagueDrtg,
      sixth: rankSixthMan(list),
      mip: rankMostImproved(list, prevList),
      clutch: clutch ? rankClutch(list, clutch.players, clutch.teams) : [],
      coy: rankCoaches(data.data.games, data.data.prevGames),
      hasPrev: prevList.length > 0,
      teams: new Map(snap.teams.map((t) => [t.id, t as TeamLite])),
    };
  }, [snap, data.data]);
}

/** The head coach of a team in a season, from the staff data. */
function coachOf(staff: StaffData | undefined, teamId: string, season: number): string | undefined {
  const f = FRANCHISES.find((x) => x.espnId === teamId);
  if (!f || !staff) return undefined;
  for (const code of [...f.codes].reverse()) {
    const now = staff.coaches.find((c) => c.team === code);
    if (now && season === Math.max(...Object.values(staff.coachHistory).flat().map((c) => c.to), season)) return now.name;
    const hist = (staff.coachHistory[code] ?? []).filter((c) => c.from <= season && c.to >= season);
    if (hist.length) return hist[hist.length - 1].name;
  }
  return undefined;
}

const why = (parts: { label: string; value: number }[]) =>
  parts.filter((p) => Math.abs(p.value) >= 0.5).sort((a, b) => b.value - a.value).map((p) => `${p.label} ${p.value > 0 ? '+' : ''}${p.value.toFixed(1)}`).join(' · ');

function ScoreCell({ score, best, parts }: { score: number; best: number; parts: { label: string; value: number }[] }) {
  return (
    <td className="left award-score" title={why(parts)}>
      <span className="pbar-track"><span className="pbar-fill" style={{ width: `${Math.max(0, score / (best || 1)) * 100}%`, background: 'var(--series-1)' }} /></span>
      <b>{score.toFixed(1)}</b>
    </td>
  );
}

function TeamCell({ team }: { team?: TeamLite }) {
  return team ? <Link to={`/team/${team.id}`} className="team-cell"><TeamLogo team={team} size={18} />{team.abbr}</Link> : null;
}

const f1 = (v: number) => v.toFixed(1);
const sgn = (v: number) => { const r = Math.round(v * 10) / 10; return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r).toFixed(1)}`; };

export function MoreAwardRace({ award, season, done }: { award: MoreAwardId; season: number; done: boolean }) {
  const races = useRaces(season);
  const staff = useStaff();
  if (!seasonSnapshot(season)?.box) return <Empty>No box-score totals for this season yet.</Empty>;
  if (!races) return <Loading />;
  const { teams } = races;
  const intro = done ? 'The model’s final ladder for the season.' : 'The model’s ladder so far. Early on, a hot week moves it a lot.';
  let table: React.ReactNode;
  if (award === 'coy') {
    const rows = races.coy.slice(0, SHOW);
    const best = rows[0]?.score ?? 1;
    table = (
      <table className="awards-table">
        <thead>
          <tr>
            <th>#</th>
            <th className="left">Coach</th>
            <th className="left">Team</th>
            <th>W-L</th>
            <th title="Wins the team’s preseason rating predicted for the games played">Expected W</th>
            <th>Above</th>
            <th className="hide-sm">Last season</th>
            <th className="left">Model score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: CoachRanked, i) => (
            <tr key={r.teamId}>
              <td>{i + 1}</td>
              <td className="left nowrap">{coachOf(staff.data, r.teamId, season) ?? <span className="muted">–</span>}</td>
              <td className="left"><TeamCell team={teams.get(r.teamId)} /></td>
              <td>{r.wins}-{r.losses}</td>
              <td className="muted">{f1(r.expected)}</td>
              <td className={r.wins - r.expected >= 0 ? 'win' : 'loss'}>{sgn(r.wins - r.expected)}</td>
              <td className="hide-sm muted">{r.prevPct === undefined ? '–' : r.prevPct.toFixed(3).replace(/^0/, '')}</td>
              <ScoreCell score={r.score} best={best} parts={r.parts} />
            </tr>
          ))}
        </tbody>
      </table>
    );
  } else {
    const ranked: Ranked[] = (award === 'sixth' ? races.sixth : award === 'mip' ? races.mip : races.clutch).filter((r) => r.eligible).slice(0, SHOW);
    if (award === 'mip' && !races.hasPrev) return <Empty>Most Improved needs last season’s box scores, which we don’t have for this season.</Empty>;
    if (!ranked.length) return <Empty>Not enough games yet.</Empty>;
    const best = ranked[0].score;
    table = (
      <table className="awards-table">
        <thead>
          <tr>
            <th>#</th>
            <th className="left">Player</th>
            <th className="hide-sm">Team</th>
            {award === 'sixth' && (
              <>
                <th title="Games played (started)">G (GS)</th>
                <th>MIN</th>
                <th>PTS</th>
                <th className="hide-sm">REB</th>
                <th className="hide-sm">AST</th>
                <th title="Plus-minus per game">+/-</th>
              </>
            )}
            {award === 'mip' && (
              <>
                <th title="Points per game, last season → this season">PTS</th>
                <th title="Minutes per game, last season → this season">MIN</th>
                <th className="hide-sm" title="Game Score per game, last season → this season">Game Score</th>
              </>
            )}
            {award === 'clutch' && (
              <>
                <th title="Games with clutch minutes">G</th>
                <th>PTS</th>
                <th>FG</th>
                <th className="hide-sm">3P</th>
                <th className="hide-sm">FT</th>
                <th title="Team record in clutch games">Team</th>
              </>
            )}
            <th className="left">Model score</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((r, i) => {
            const c = r.c;
            const before = 'before' in r ? (r as Ranked & { before: typeof c }).before : undefined;
            const row = 'row' in r ? (r as ReturnType<typeof rankClutch>[number]) : undefined;
            return (
              <tr key={c.id}>
                <td>{i + 1}</td>
                <td className="left nowrap"><Link to={`/player/${c.id}`}>{c.name}</Link></td>
                <td className="hide-sm"><TeamCell team={teams.get(c.teamId)} /></td>
                {award === 'sixth' && (
                  <>
                    <td>{c.gp} <span className="muted small">({c.gs})</span></td>
                    <td>{f1(c.mpg)}</td>
                    <td>{f1(c.ppg)}</td>
                    <td className="hide-sm">{f1(c.rpg)}</td>
                    <td className="hide-sm">{f1(c.apg)}</td>
                    <td>{sgn(c.pm)}</td>
                  </>
                )}
                {award === 'mip' && before && (
                  <>
                    <td className="nowrap"><span className="muted small">{f1(before.ppg)} →</span> {f1(c.ppg)}</td>
                    <td className="nowrap"><span className="muted small">{f1(before.mpg)} →</span> {f1(c.mpg)}</td>
                    <td className="hide-sm nowrap"><span className="muted small">{f1(before.gmsc)} →</span> {f1(c.gmsc)}</td>
                  </>
                )}
                {award === 'clutch' && row && (
                  <>
                    <td>{row.row[C.games]}</td>
                    <td>{row.row[C.pts]}</td>
                    <td>{row.row[C.fgm]}-{row.row[C.fga]}</td>
                    <td className="hide-sm">{row.row[C.tpm]}-{row.row[C.tpa]}</td>
                    <td className="hide-sm">{row.row[C.ftm]}-{row.row[C.fta]}</td>
                    <td className="muted">{row.team ? `${row.team[2]}-${row.team[3]}` : '–'}</td>
                  </>
                )}
                <ScoreCell score={r.score} best={best} parts={r.parts} />
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }
  const all = award === 'sixth' ? races.sixth : award === 'mip' ? races.mip : award === 'clutch' ? races.clutch : [];
  return (
    <>
      <p className="muted">{intro} Hover a score to see where it comes from.</p>
      {done && <RealWinner award={award} season={season} ranked={all.filter((r) => r.eligible)} />}
      <div className="table-wrap">{table}</div>
      <div className="card">
        <h3>How the model works</h3>
        <p className="small">{MORE_METHOD[award]}</p>
        {award === 'coy' && <p className="muted small">The coach is whoever is in charge now (or, for a past season, was in charge at the end of it), from Basketball-Reference.</p>}
        {award === 'sixth' && <p className="muted small">On 2024-25 it ranked Payton Pritchard first, with De’Andre Hunter, Naz Reid and Malik Beasley (the next three in the real vote) in its top five.</p>}
        {award === 'clutch' && <p className="muted small">On 2024-25 it ranked Jalen Brunson, the real winner, first.</p>}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Your ballot

type BallotKey = 'mvp' | 'dpoy' | 'roy' | MoreAwardId;
const BALLOT: { key: BallotKey; name: string; places: number }[] = [
  { key: 'mvp', name: 'Most Valuable Player', places: 5 },
  { key: 'dpoy', name: 'Defensive Player of the Year', places: 3 },
  { key: 'roy', name: 'Rookie of the Year', places: 3 },
  { key: 'sixth', name: 'Sixth Man', places: 3 },
  { key: 'mip', name: 'Most Improved', places: 3 },
  { key: 'clutch', name: 'Clutch Player', places: 3 },
  { key: 'coy', name: 'Coach of the Year', places: 3 },
];

type Ballot = Partial<Record<BallotKey, string[]>>;

const read = (key: string): Ballot => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '{}') as Ballot;
  } catch {
    return {};
  }
};

export function YourBallot({ season }: { season: number }) {
  const races = useRaces(season);
  const staff = useStaff();
  const key = `nba-awards-ballot-${season}`;
  const [ballot, setBallot] = useState<Ballot>(() => read(key));
  const save = (b: Ballot) => {
    setBallot(b);
    try {
      localStorage.setItem(key, JSON.stringify(b));
    } catch {
      // Private browsing: the ballot lasts until the page closes.
    }
  };
  if (!seasonSnapshot(season)?.box) return <Empty>No box-score totals for this season yet.</Empty>;
  if (!races) return <Loading />;
  // The model's order and the names to pick from, for each award.
  const options = (k: BallotKey): { id: string; label: string }[] => {
    if (k === 'coy') return races.coy.map((r) => ({ id: r.teamId, label: `${coachOf(staff.data, r.teamId, season) ?? 'Coach'} (${races.teams.get(r.teamId)?.abbr ?? ''})` }));
    const ranked = k === 'mvp' || k === 'dpoy' || k === 'roy' ? rankAward(k, races.list, races.leagueDrtg) : k === 'sixth' ? races.sixth : k === 'mip' ? races.mip : races.clutch;
    return ranked.filter((r) => r.eligible).slice(0, 25).map((r) => ({ id: r.c.id, label: `${r.c.name} (${races.teams.get(r.c.teamId)?.abbr ?? ''})` }));
  };
  const filled = BALLOT.filter((b) => (ballot[b.key] ?? []).some(Boolean)).length;
  return (
    <>
      <p className="muted">Fill in your own ballot. Pick from each award’s top 25 in the model; it’s saved in this browser, and the model’s picks are alongside. {filled ? `${filled} of ${BALLOT.length} awards filled in.` : ''}</p>
      <div className="ballot">
        {BALLOT.map((b) => {
          const opts = options(b.key);
          const model = opts.slice(0, b.places);
          const mine = ballot[b.key] ?? [];
          const label = new Map(opts.map((o) => [o.id, o.label]));
          const agree = mine.slice(0, b.places).filter((id, i) => id && model[i]?.id === id).length;
          return (
            <div key={b.key} className="card">
              <h3>{b.name}</h3>
              <ol className="ballot-list">
                {Array.from({ length: b.places }, (_, i) => (
                  <li key={i}>
                    <select
                      aria-label={`${b.name}, place ${i + 1}`}
                      value={mine[i] ?? ''}
                      onChange={(e) => {
                        const next = [...mine];
                        next[i] = e.target.value;
                        // One player per ballot: picking someone moves them from their old place.
                        for (let j = 0; j < next.length; j++) if (j !== i && next[j] === e.target.value) next[j] = '';
                        save({ ...ballot, [b.key]: next });
                      }}
                    >
                      <option value="">–</option>
                      {opts.map((o) => (
                        <option key={o.id} value={o.id}>{o.label}</option>
                      ))}
                    </select>
                    <span className="muted small ballot-model">model: {model[i] ? label.get(model[i].id) : '–'}</span>
                  </li>
                ))}
              </ol>
              {mine.some(Boolean) && <p className="small muted">{agree === b.places ? 'Same as the model, place for place.' : `${agree} of ${b.places} places match the model.`}</p>}
            </div>
          );
        })}
      </div>
      {filled > 0 && (
        <p className="small"><button className="link" onClick={() => save({})}>Clear my ballot</button></p>
      )}
    </>
  );
}
