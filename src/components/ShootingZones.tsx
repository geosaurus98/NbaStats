// Insights → Shooting zones: who shoots best (and most) from each part of
// the floor, from the season's shot locations.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { seasonShots, snapshotTeams, type SeasonType } from '../api/espn';
import { zoneTotals, ZONES, type ZoneId } from '../lib/pbpStats';
import { Empty } from './Status';
import { TeamLogo } from './TeamLogo';

export function ShootingZones({ season, type }: { season: number; type: SeasonType }) {
  const shots = seasonShots(season, type);
  const teams = new Map((snapshotTeams(season) ?? []).map((t) => [t.id, t]));
  const [zone, setZone] = useState<ZoneId>('corner3');
  const [who, setWho] = useState<'players' | 'teams'>('players');
  const [sort, setSort] = useState<'pct' | 'att'>('pct');
  const model = useMemo(() => {
    if (!shots) return undefined;
    const league = zoneTotals(shots.league, shots.teamSize);
    const players = Object.entries(shots.players).map(([id, p]) => ({ id, name: p.name, team: p.team, z: zoneTotals(p.bins, shots.playerSize) }));
    const teamRows = Object.entries(shots.teams).map(([id, bins]) => ({ id, name: teams.get(id)?.name ?? id, team: id, z: zoneTotals(bins, shots.teamSize) }));
    return { league, players, teams: teamRows };
  }, [shots, teams]);
  if (!shots || !model) return <Empty>No shot data for this season yet.</Empty>;
  const lg = model.league[zone];
  const lgPct = lg.att ? lg.made / lg.att : 0;
  const pool = who === 'players' ? model.players : model.teams;
  const maxAtt = Math.max(...pool.map((r) => r.z[zone].att));
  const minAtt = who === 'players' ? Math.max(5, Math.round(maxAtt * 0.2)) : 1;
  const rows = pool
    .filter((r) => r.z[zone].att >= minAtt)
    .map((r) => ({ ...r, att: r.z[zone].att, pct: r.z[zone].made / r.z[zone].att }))
    .sort((a, b) => (sort === 'pct' ? b.pct - a.pct : b.att - a.att))
    .slice(0, 25);
  const info = ZONES.find((z) => z.id === zone)!;
  return (
    <>
      <p className="muted">
        Field-goal percentage by zone, against the league average ({(lgPct * 100).toFixed(1)}% on {lg.att.toLocaleString()} {info.label.toLowerCase()} attempts). {who === 'players' ? `The ${Object.keys(shots.players).length} highest-volume shooters, with at least ${minAtt} attempts from here.` : ''}
      </p>
      <div className="chips tight">
        {ZONES.map((z) => (
          <button key={z.id} title={z.title} className={z.id === zone ? 'chip active' : 'chip'} onClick={() => setZone(z.id)}>{z.label}</button>
        ))}
      </div>
      <div className="actions">
        <button className={who === 'players' ? 'chip active' : 'chip'} onClick={() => setWho('players')}>Players</button>
        <button className={who === 'teams' ? 'chip active' : 'chip'} onClick={() => setWho('teams')}>Teams</button>
        <button className={sort === 'pct' ? 'chip active' : 'chip'} onClick={() => setSort('pct')}>Best %</button>
        <button className={sort === 'att' ? 'chip active' : 'chip'} onClick={() => setSort('att')}>Most attempts</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th className="left">{who === 'players' ? 'Player' : 'Team'}</th>
              <th>Made</th>
              <th>Att</th>
              <th>FG%</th>
              <th>vs league</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const diff = (r.pct - lgPct) * 100;
              const t = teams.get(r.team);
              return (
                <tr key={r.id}>
                  <td>{i + 1}</td>
                  <td className="left nowrap">
                    {who === 'players' ? <Link to={`/player/${r.id}`}>{r.name}</Link> : <Link to={`/team/${r.id}`} className="team-cell">{t && <TeamLogo team={t} size={16} />} {r.name}</Link>}
                    {who === 'players' && t && <span className="muted small"> {t.abbr}</span>}
                  </td>
                  <td>{r.z[zone].made}</td>
                  <td className={sort === 'att' ? 'sorted' : undefined}>{r.att}</td>
                  <td className={sort === 'pct' ? 'sorted' : undefined}>{(r.pct * 100).toFixed(1)}</td>
                  <td className={diff > 0 ? 'win' : 'loss'}>{diff > 0 ? '+' : ''}{diff.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted small">Zones come from shot locations in the play-by-play, binned to a few feet, so shots right on a zone's edge can land either side.</p>
    </>
  );
}
