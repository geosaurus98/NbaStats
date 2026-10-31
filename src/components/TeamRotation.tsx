// Team page: how the coach uses the roster (minutes in each 3-minute stretch
// of a game), the lineups trusted in clutch time, and opponents' shooting by
// zone with each player on the floor.
import { Link } from 'react-router-dom';
import { seasonSnapshot, snapshotPlayers, type SeasonType } from '../api/espn';
import { SEGMENTS } from '../lib/lineups';
import { ZONES } from '../lib/pbpStats';
import { NetBar, per48, signed } from './TeamLineups';

const pct1 = (v: number) => `${(v * 100).toFixed(1)}%`;

function useTeamLineups(season: number, type: SeasonType, teamId: string) {
  const snap = seasonSnapshot(season);
  const names = snapshotPlayers(season);
  const t = snap?.lineups?.[String(type)]?.[teamId];
  const surname = (id: string) => (names[id] ?? id).split(' ').slice(1).join(' ') || (names[id] ?? id);
  return { t, names, surname };
}

export function RotationChart({ season, type, teamId }: { season: number; type: SeasonType; teamId: string }) {
  const { t, names } = useTeamLineups(season, type, teamId);
  const rows = t?.rotation;
  if (!rows || rows.length < 5) return null;
  const shade = (sec: number) => Math.min(5, Math.max(0, Math.ceil((sec / 180) * 5)));
  const slotLabel = (i: number) => (i === SEGMENTS - 1 ? 'OT' : `Q${Math.floor(i / 4) + 1} ${12 - (i % 4) * 3}:00–${9 - (i % 4) * 3}:00`);
  return (
    <div className="card">
      <h3>Rotation</h3>
      <p className="muted small">How often each player is on the floor in every 3-minute stretch of a game (darker = on court more of that stretch, averaged over the games they played).</p>
      <div className="rotation-scroll">
        <table className="rotation">
          <thead>
            <tr>
              <th className="left">Player</th>
              {Array.from({ length: SEGMENTS - 1 }, (_, i) => (
                <th key={i} className={i % 4 === 0 ? 'q-start' : undefined}>{i % 4 === 0 ? `Q${i / 4 + 1}` : ''}</th>
              ))}
              <th className="q-start">OT</th>
              <th title="Minutes per game">MPG</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([id, games, ...sec]) => (
              <tr key={id}>
                <td className="left nowrap"><Link to={`/player/${id}`}>{names[id] ?? id}</Link> <span className="muted small">{games} g</span></td>
                {sec.map((s, i) => (
                  <td key={i} className={`rot-cell seq-${shade(s)}${i % 4 === 0 || i === SEGMENTS - 1 ? ' q-start' : ''}`} title={`${names[id] ?? id}, ${slotLabel(i)}: on court ${Math.round((s / 180) * 100)}% of the time`} />
                ))}
                <td className="muted">{(sec.slice(0, SEGMENTS - 1).reduce((a, b) => a + b, 0) / 60).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="legend small">
        {['rarely', '', '', '', 'almost always'].map((l, i) => (
          <span key={i}><i className={`key-sq seq-${i + 1}`} />{l}</span>
        ))}
      </div>
    </div>
  );
}

export function ClutchLineups({ season, type, teamId }: { season: number; type: SeasonType; teamId: string }) {
  const { t, surname } = useTeamLineups(season, type, teamId);
  const rows = t?.clutchLineups;
  if (!rows?.length) return null;
  const max = Math.max(10, ...rows.map(([, sec, pf, pa]) => Math.abs(per48(pf, pa, sec))));
  return (
    <div className="card">
      <h3>Clutch lineups</h3>
      <p className="muted small">Five-man groups used in clutch time (last five minutes of the fourth quarter or overtime, within five points), with 2+ minutes together.</p>
      <div className="table-wrap flush">
        <table>
          <thead>
            <tr>
              <th className="left">Five on court</th>
              <th>Min</th>
              <th title="Points for and against">Score</th>
              <th title="Point margin per 48 minutes">+/- per 48</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map(([ids, sec, pf, pa]) => {
              const net = per48(pf, pa, sec);
              return (
                <tr key={ids.join()}>
                  <td className="left small">{ids.map(surname).join(', ')}</td>
                  <td>{(sec / 60).toFixed(1)}</td>
                  <td className="muted">{pf}-{pa}</td>
                  <td className={net >= 0 ? 'win' : 'loss'}>{signed(net)}</td>
                  <td className="net-cell"><NetBar v={net} max={max} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DefenseByZone({ season, type, teamId }: { season: number; type: SeasonType; teamId: string }) {
  const { t, names } = useTeamLineups(season, type, teamId);
  if (!t?.defense?.length || !t.oppZones) return null;
  const team = t.oppZones;
  const zones = ZONES.map((z, i) => ({ ...z, i }));
  const rows = t.defense
    .map(([id, ...z]) => {
      const cells = zones.map(({ i }) => {
        const onA = z[i * 2];
        const onM = z[i * 2 + 1];
        const offA = team[i * 2] - onA;
        const offM = team[i * 2 + 1] - onM;
        return { on: onA ? onM / onA : 0, off: offA ? offM / offA : 0, onA, offA };
      });
      const total = cells.reduce((s, c) => s + c.onA, 0);
      return { id, cells, total };
    })
    .filter((r) => r.total >= 100)
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);
  if (!rows.length) return null;
  return (
    <div className="card">
      <h3>Opponent shooting with each player on court</h3>
      <p className="muted small">Opponents' FG% by zone while each player is on the floor, and the change from when they sit (green = opponents shoot worse with them on). ESPN doesn't record who guarded whom, so this is a team-on-court measure, not one-on-one defence.</p>
      <div className="table-wrap flush">
        <table>
          <thead>
            <tr>
              <th className="left">Player</th>
              {zones.map((z) => (
                <th key={z.id} title={z.title}>{z.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="left nowrap"><Link to={`/player/${r.id}`}>{names[r.id] ?? r.id}</Link></td>
                {r.cells.map((c, i) => {
                  const d = c.on - c.off;
                  const enough = c.onA >= 20 && c.offA >= 20;
                  return (
                    <td key={i} title={`${zones[i].label}: ${pct1(c.on)} on ${c.onA} shots with them on, ${pct1(c.off)} on ${c.offA} with them off`}>
                      {pct1(c.on)} {enough && <span className={`small ${d < -0.02 ? 'win' : d > 0.02 ? 'loss' : 'muted'}`}>{d > 0 ? '+' : ''}{(d * 100).toFixed(1)}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">Team overall: {zones.map((z) => `${z.label.toLowerCase()} ${pct1(team[z.i * 2 + 1] / Math.max(1, team[z.i * 2]))}`).join(' · ')}.</p>
    </div>
  );
}

