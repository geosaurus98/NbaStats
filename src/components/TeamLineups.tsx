// Team page: most-used five-man lineups and each player's on/off split,
// from play-by-play (snapshotted seasons).
import { Link } from 'react-router-dom';
import { seasonLineups, snapshotPlayers, type SeasonType } from '../api/espn';

export const PER48 = 2880;
export const per48 = (pf: number, pa: number, sec: number) => (sec > 0 ? ((pf - pa) / sec) * PER48 : 0);
export const signed = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}`;

/** Diverging bar around zero: blue right for positive, red left for negative. */
export function NetBar({ v, max }: { v: number; max: number }) {
  const w = Math.min(50, (Math.abs(v) / max) * 50);
  return (
    <span className="net-bar">
      <span className="net-mid" />
      <span className="net-fill" style={v >= 0 ? { left: '50%', width: `${w}%`, background: 'var(--pos)' } : { right: '50%', width: `${w}%`, background: 'var(--neg)' }} />
    </span>
  );
}

export function TeamLineups({ teamId, season, seasonType }: { teamId: string; season: number; seasonType: SeasonType }) {
  const data = seasonLineups(season, seasonType, teamId);
  if (!data || data.lineups.length === 0) return null;
  const names = snapshotPlayers(season);
  const surname = (id: string) => (names[id] ?? id).split(' ').slice(1).join(' ') || (names[id] ?? id);
  // Surnames, unless two teammates share one (e.g. Jalen and Jaylin Williams).
  const ids = new Set([...data.lineups.flatMap(([l]) => l), ...data.onOff.map(([id]) => id)]);
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(surname(id), (counts.get(surname(id)) ?? 0) + 1);
  const short = (id: string) => ((counts.get(surname(id)) ?? 0) > 1 ? (names[id] ?? id) : surname(id));
  const lineups = data.lineups.filter(([, sec]) => sec >= 600).slice(0, 10);
  const onOff = data.onOff
    .filter(([, on]) => on >= 3000)
    .map(([id, on, opf, opa, g, gpf, gpa]) => {
      const onNet = per48(opf, opa, on);
      const offNet = per48(gpf - opf, gpa - opa, g - on);
      return { id, min: on / 60, onNet, offNet, swing: onNet - offNet, offMin: (g - on) / 60 };
    })
    .sort((a, b) => b.swing - a.swing);
  const maxLineup = Math.max(10, ...lineups.map(([, sec, pf, pa]) => Math.abs(per48(pf, pa, sec))));
  const maxSwing = Math.max(10, ...onOff.map((p) => Math.abs(p.swing)));

  return (
    <>
      <h2>Lineups & on/off</h2>
      <div className="two-col">
        <div className="table-wrap">
          <h3 className="table-title">Most-used lineups</h3>
          <table>
            <thead>
              <tr>
                <th className="left">Five on court</th>
                <th>Min</th>
                <th title="Point margin per 48 minutes together">+/- per 48</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lineups.map(([ids, sec, pf, pa]) => {
                const net = per48(pf, pa, sec);
                return (
                  <tr key={ids.join()}>
                    <td className="left small">{ids.map(short).join(', ')}</td>
                    <td>{Math.round(sec / 60)}</td>
                    <td className={net >= 0 ? 'win' : 'loss'}>{signed(net)}</td>
                    <td className="net-cell"><NetBar v={net} max={maxLineup} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="table-wrap">
          <h3 className="table-title">On/off: team with vs without each player</h3>
          <table>
            <thead>
              <tr>
                <th className="left">Player</th>
                <th>Min</th>
                <th title="Team point margin per 48 while they're on court">On</th>
                <th title="…and while they're on the bench (in games he played)">Off</th>
                <th title="On minus off">Swing</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {onOff.map((p) => (
                <tr key={p.id}>
                  <td className="left nowrap"><Link to={`/player/${p.id}`}>{names[p.id] ?? p.id}</Link></td>
                  <td>{Math.round(p.min)}</td>
                  <td>{signed(p.onNet)}</td>
                  <td className="muted">{p.offMin >= 30 ? signed(p.offNet) : '–'}</td>
                  <td className={p.swing >= 0 ? 'win' : 'loss'}><b>{signed(p.swing)}</b></td>
                  <td className="net-cell"><NetBar v={p.swing} max={maxSwing} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="muted small">
        From play-by-play. Margins are points per 48 minutes (not per possession). ESPN doesn't record substitutions between quarters, so
        who started each quarter is inferred and a small share of minutes may be credited to the wrong five. Lineups with 10+ minutes;
        players with 50+ minutes.
      </p>
    </>
  );
}
