// SRS and title DNA, rest and travel, scoring runs (Rankings tabs), plus the
// team page's style profile, closest past champions and with/without records.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { seasonShots, seasonSnapshot, snapshotPlayers } from '../api/espn';
import { loadLines } from '../api/linesStore';
import type { TeamRef } from '../api/types';
import { useAsync } from '../hooks/useAsync';
import { formatShortDate } from '../lib/dates';
import { loadFranchiseData } from '../lib/franchiseData';
import { zoneTotals } from '../lib/pbpStats';
import { championDna, closestChampions, currentDna, restAndTravel, srs, styleProfile, withWithout, type Record2 } from '../lib/teamExtras';
import { Empty, Loading } from './Status';
import { Tile } from './Tile';
import { useTeamSeasons } from './TeamAnalytics';
import { TeamLogo } from './TeamLogo';
import { NetBar, signed } from './TeamLineups';

function useTeams(season: number): Map<string, TeamRef> {
  const snap = seasonSnapshot(season);
  return useMemo(() => new Map((snap?.teams ?? []).map((t) => [t.id, t])), [snap]);
}

function TeamCell({ team, id }: { team?: TeamRef; id: string }) {
  return (
    <td className="left nowrap">
      <Link to={`/team/${id}`} className="team-cell">{team && <TeamLogo team={team} size={18} />}{team?.abbr ?? id}</Link>
    </td>
  );
}

const wl = (r: Record2) => `${r.w}-${r.l}`;
const winPct = (r: Record2) => (r.w + r.l ? r.w / (r.w + r.l) : undefined);

export function SrsTable({ season }: { season: number }) {
  const data = useTeamSeasons(season, 2);
  const teams = useTeams(season);
  const champs = useAsync(() => loadFranchiseData().then(championDna), []);
  if (data.loading) return <Loading />;
  if (!data.data || data.data.seasons.size < 2) return <Empty>No box scores for this season yet.</Empty>;
  const ratings = srs(data.data.games);
  const dna = currentDna(data.data.seasons);
  const rows = [...ratings].sort((a, b) => b[1].srs - a[1].srs);
  const max = Math.max(5, ...rows.map(([, r]) => Math.abs(r.srs)));
  return (
    <>
      <p className="muted">
        SRS (Simple Rating System, as on Basketball-Reference): average margin adjusted for the strength of the opponents played. 0 is an average team; +5 means five points a game better. "Plays like" finds the champion since 1980 with the most similar profile (net rating, shooting, defence, turnovers, rebounding, free throws, threes and pace, each against its own season's league).
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th className="left">Team</th>
              <th title="Simple Rating System">SRS</th>
              <th />
              <th title="Average margin of victory">MOV</th>
              <th title="Strength of schedule: average opponent SRS">SOS</th>
              <th className="left" title="The most similar champion since 1980">Plays like</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([id, r], i) => {
              const match = champs.data && dna.get(id) ? closestChampions(dna.get(id)!, champs.data.filter((c) => c.season < season), 1)[0] : undefined;
              return (
                <tr key={id}>
                  <td className="muted">{i + 1}</td>
                  <TeamCell id={id} team={teams.get(id)} />
                  <td><b>{signed(r.srs)}</b></td>
                  <td className="net-cell"><NetBar v={r.srs} max={max} /></td>
                  <td>{signed(r.mov)}</td>
                  <td className={r.sos > 0.5 ? 'loss' : r.sos < -0.5 ? 'win' : 'muted'}>{signed(r.sos)}</td>
                  <td className="left nowrap small">{match ? <>{match.season - 1}-{String(match.season).slice(2)} {match.name} <span className="muted">({match.similarity}% match)</span></> : '–'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted small">SOS in red = a harder schedule than average, green = easier.</p>
    </>
  );
}

export function RestTravel({ season }: { season: number }) {
  const data = useTeamSeasons(season, 2);
  const teams = useTeams(season);
  const abbr = useMemo(() => new Map([...teams].map(([id, t]) => [id, t.abbr])), [teams]);
  if (data.loading) return <Loading />;
  if (!data.data || data.data.seasons.size < 2) return <Empty>No box scores for this season yet.</Empty>;
  const rows = restAndTravel(data.data.games, abbr).sort((a, b) => b.miles - a.miles);
  const sum = (f: (t: (typeof rows)[number]) => Record2) => rows.reduce((s, t) => ({ w: s.w + f(t).w, l: s.l + f(t).l, margin: s.margin + f(t).margin }), { w: 0, l: 0, margin: 0 });
  const lg = [0, 1, 2, 3].map((i) => sum((t) => t.byRest[i]));
  const edge = { more: sum((t) => t.restEdge.more), less: sum((t) => t.restEdge.less) };
  const avgMargin = (r: Record2) => (r.w + r.l ? r.margin / (r.w + r.l) : 0);
  const pctCell = (r: Record2) => {
    const p = winPct(r);
    return <td title={`${wl(r)}, ${signed(avgMargin(r))} a game`}>{p == null ? '–' : `${wl(r)}`}</td>;
  };
  return (
    <>
      <p className="muted">How schedule strain shows up in results. Rest = days off before a game (0 = second night of a back-to-back). Miles are flown between arenas (neutral-site games count as the home team's arena).</p>
      <div className="stat-tiles">
        {['back-to-backs', '1 day off', '2 days off', '3+ days off'].map((label, i) => (
          <Tile key={label} label={`League margin on ${label}`} value={signed(avgMargin(lg[i]))} />
        ))}
        <Tile label={`Win rate with more rest than the opponent (${wl(edge.more)})`} value={`${((winPct(edge.more) ?? 0) * 100).toFixed(1)}%`} />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="left">Team</th>
              <th title="Second night of a back-to-back">B2B</th>
              <th>1 day</th>
              <th>2 days</th>
              <th>3+ days</th>
              <th title="Record with more rest than the opponent">Rest edge</th>
              <th title="Record with less rest than the opponent">Rest deficit</th>
              <th title="Miles flown between games">Miles</th>
              <th title="Record after crossing two or more time zones">2+ zones</th>
              <th title="Longest run of consecutive road games">Longest trip</th>
              <th title="Record in the 4th game or later of a road trip">Late in trip</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.teamId}>
                <TeamCell id={t.teamId} team={teams.get(t.teamId)} />
                {t.byRest.map((r, i) => (
                  <td key={i} title={`${signed(avgMargin(r))} a game`} className={i === 0 ? 'strong' : undefined}>{wl(r)}</td>
                ))}
                {pctCell(t.restEdge.more)}
                {pctCell(t.restEdge.less)}
                <td>{Math.round(t.miles).toLocaleString()}</td>
                <td>{wl(t.zoneJump)}</td>
                <td>{t.longestTrip}</td>
                <td>{wl(t.lateTrip)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">Hover a record for the average margin. Sorted by miles travelled.</p>
    </>
  );
}

export function ScoringRuns({ season, type }: { season: number; type: 2 | 3 }) {
  const snap = seasonSnapshot(season);
  const teams = useTeams(season);
  const runs = snap?.runs?.[String(type)];
  if (!runs) return <Empty>Scoring runs start with the next daily data update.</Empty>;
  const dates = new Map((snap?.games[String(type)] ?? []).map((g) => [g[0], g[1]]));
  const rows = [...runs.teams].sort((a, b) => b[2] - b[3] - (a[2] - a[3]));
  const max = Math.max(1, ...rows.map((r) => Math.abs(r[2] - r[3])));
  return (
    <>
      <p className="muted">Runs are stretches where one team scores and the other doesn't. A 10-0 run (or bigger) is the classic momentum swing.</p>
      <div className="two-col">
        <div className="table-wrap">
          <h3 className="table-title">10+ point runs, made and allowed</h3>
          <table>
            <thead>
              <tr>
                <th className="left">Team</th>
                <th title="10-0 runs or bigger">Made</th>
                <th>Allowed</th>
                <th>Diff</th>
                <th />
                <th title="Biggest run made / allowed">Biggest</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r[0]}>
                  <TeamCell id={r[0]} team={teams.get(r[0])} />
                  <td>{r[2]}</td>
                  <td>{r[3]}</td>
                  <td className={r[2] >= r[3] ? 'win' : 'loss'}><b>{r[2] - r[3] > 0 ? '+' : ''}{r[2] - r[3]}</b></td>
                  <td className="net-cell"><NetBar v={r[2] - r[3]} max={max} /></td>
                  <td className="muted">{r[4]}-0 / 0-{r[5]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-wrap">
          <h3 className="table-title">The season's biggest runs</h3>
          <table>
            <tbody>
              {runs.biggest.slice(0, 20).map(([gameId, t, opp, pts, period]) => (
                <tr key={gameId + t + pts + period}>
                  <td className="left nowrap"><b>{pts}-0</b></td>
                  <td className="left nowrap"><Link to={`/game/${gameId}`}>{teams.get(t)?.abbr} vs {teams.get(opp)?.abbr}</Link></td>
                  <td className="muted">{period <= 4 ? `Q${period}` : 'OT'}</td>
                  <td className="muted">{dates.get(gameId) ? formatShortDate(dates.get(gameId)!) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/** Team page: style against the league, closest past champions. */
export function TeamStyleCard({ season, teamId }: { season: number; teamId: string }) {
  const data = useTeamSeasons(season, 2);
  const shots = seasonShots(season, 2);
  const champs = useAsync(() => loadFranchiseData().then(championDna), []);
  const rim = useMemo(() => {
    if (!shots) return undefined;
    return new Map(Object.entries(shots.teams).map(([id, bins]) => {
      const z = zoneTotals(bins, shots.teamSize);
      const all = Object.values(z).reduce((s, v) => s + v.att, 0);
      return [id, all ? z.rim.att / all : 0];
    }));
  }, [shots]);
  if (!data.data || !data.data.seasons.has(teamId)) return null;
  const rows = styleProfile(teamId, data.data.seasons, rim);
  const dna = currentDna(data.data.seasons).get(teamId);
  const matches = champs.data && dna ? closestChampions(dna, champs.data.filter((c) => c.season < season), 3) : [];
  return (
    <div className="card">
      <h3>Style profile</h3>
      <div className="style-rows">
        {rows.map((r) => (
          <div key={r.id} className="style-row" title={`${r.title}. League average ${r.fmt(r.league)}.`}>
            <span>{r.label}</span>
            <span className="style-track">
              <span className="style-mid" />
              <span className="style-dot" style={{ left: `${r.pct}%` }} />
            </span>
            <b>{r.fmt(r.value)}</b>
            <span className="muted small">lg {r.fmt(r.league)}</span>
          </div>
        ))}
      </div>
      <p className="muted small">Each dot is where the team ranks among all 30, from lowest (left) to highest (right); the middle line is the league median.</p>
      {matches.length > 0 && (
        <>
          <h4>Plays most like these champions</h4>
          <ol className="small">
            {matches.map((m) => (
              <li key={m.season}>
                <b>{m.season - 1}-{String(m.season).slice(2)} {m.name}</b> <span className="muted">({m.record}, {m.similarity}% match)</span>
              </li>
            ))}
          </ol>
          <p className="muted small">Compared on net rating, shooting, opponents' shooting, turnovers, rebounding, free throws, threes and pace, each against its own season's league.</p>
        </>
      )}
    </div>
  );
}

/** Team page: record and margin with and without each regular. */
export function WithWithoutCard({ season, teamId }: { season: number; teamId: string }) {
  const names = snapshotPlayers(season);
  const { data } = useAsync(async () => {
    const lines = await loadLines(season);
    return lines ? withWithout(lines, teamId) : undefined;
  }, [season, teamId]);
  if (!data) return null;
  const rows = data.filter((p) => p.missed.w + p.missed.l >= 2).slice(0, 10);
  if (!rows.length) return null;
  const margin = (r: Record2) => (r.w + r.l ? r.margin / (r.w + r.l) : 0);
  const max = Math.max(5, ...rows.map((p) => Math.abs(margin(p.played) - margin(p.missed))));
  return (
    <div className="card">
      <h3>With and without</h3>
      <div className="table-wrap flush">
      <table>
        <thead>
          <tr>
            <th className="left">Player</th>
            <th title="Team record when they played">With</th>
            <th title="Team record when they missed (while on the team)">Without</th>
            <th title="Average margin with minus without">Margin swing</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const swing = margin(p.played) - margin(p.missed);
            return (
              <tr key={p.id}>
                <td className="left nowrap"><Link to={`/player/${p.id}`}>{names[p.id] ?? p.id}</Link></td>
                <td title={`${signed(margin(p.played))} a game`}>{wl(p.played)}</td>
                <td title={`${signed(margin(p.missed))} a game`}>{wl(p.missed)}</td>
                <td className={swing >= 0 ? 'win' : 'loss'}><b>{signed(swing)}</b></td>
                <td className="net-cell"><NetBar v={swing} max={max} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      <p className="muted small">Regular-season games while each player was on the team; players who missed at least two. Small samples swing a lot, and a missed game often means other players missed too.</p>
    </div>
  );
}
