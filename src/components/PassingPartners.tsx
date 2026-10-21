import { Link } from 'react-router-dom';
import type { Partner } from '../api/espn';

function Bars({ title, list, color, verb }: { title: string; list: Partner[]; color: string; verb: string }) {
  const top = list.slice(0, 8);
  const max = Math.max(1, ...top.map((p) => p.assists));
  return (
    <div className="card">
      <h3>{title}</h3>
      {top.length === 0 && <p className="muted small">None recorded.</p>}
      <div className="partner-bars">
        {top.map((p) => (
          <div key={p.id} className="pbar" title={`${p.assists} assists ${verb} (${p.points} pts)`}>
            <Link to={`/player/${p.id}`} className="pbar-name">{p.name}</Link>
            <span className="pbar-track">
              <span className="pbar-fill" style={{ width: `${(p.assists / max) * 100}%`, background: color }} />
            </span>
            <b className="pbar-n">{p.assists}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PassingPartners({ to, from }: { to: Partner[]; from: Partner[] }) {
  if (to.length === 0 && from.length === 0) return null;
  const total = (l: Partner[]) => l.reduce((s, p) => s + p.assists, 0);
  return (
    <>
      <h2>Passing partners</h2>
      <p className="muted small">
        From play-by-play: {total(to)} assists made, {total(from)} baskets assisted by teammates.
      </p>
      <div className="two-col">
        <Bars title="Assists to" list={to} color="var(--series-1)" verb="to them" />
        <Bars title="Assisted by" list={from} color="var(--series-2)" verb="from them" />
      </div>
    </>
  );
}
