// Projections → Injury what-if: sit a player for the rest of the season (or
// bring back one who's out) and see the team's playoff and title odds change.
// A player's value is his Win Shares per game so far, over the games left,
// turned into an Elo change for the team.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { seasonSnapshot } from '../api/espn';
import { useTeamSeasons } from './TeamAnalytics';
import { playerAdvanced } from '../lib/advanced';
import { oddsPct } from '../lib/format';
import { seededRandom } from '../lib/games';
import { eloForWins, gamesLeft, simulate, steadyWsPerGame } from '../lib/projections';
import type { Model } from '../pages/Projections';
import { Empty, Loading } from './Status';
import { TeamLogo } from './TeamLogo';

const SIMS = 1000;

export function InjuryWhatIf({ model, season }: { model: Model; season: number }) {
  const snap = seasonSnapshot(season);
  const seasons = useTeamSeasons(season, 2);
  const teams = useMemo(() => [...model.teams].sort((a, b) => a.name.localeCompare(b.name)), [model.teams]);
  const [teamId, setTeamId] = useState(() => teams[0]?.id ?? '');
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const left = useMemo(() => gamesLeft(model.games), [model.games]);
  const out = useMemo(() => new Set((snap?.injuries ?? []).filter((i) => /^out/i.test(i.status)).map((i) => i.athleteId)), [snap]);
  const players = useMemo(() => {
    const box = snap?.box?.['2'];
    if (!box || !seasons.data) return [];
    return playerAdvanced(box, seasons.data.seasons)
      .filter((p) => p.team === teamId && p.g > 0)
      .map((p) => ({ id: p.id, ws: p.ws, perGame: steadyWsPerGame(p.ws, p.g), g: p.g, out: out.has(p.id) }))
      .sort((a, b) => b.ws - a.ws)
      .slice(0, 12);
  }, [snap, seasons.data, teamId, out]);
  const remaining = left.get(teamId) ?? 0;
  const winsDelta = players.filter((p) => changed.has(p.id)).reduce((s, p) => s + (p.out ? 1 : -1) * p.perGame * remaining, 0);
  const result = useMemo(() => {
    if (!remaining) return undefined;
    const base = simulate(model.games, model.conferences, model.elo.ratings, SIMS, seededRandom(season));
    const ratings = new Map(model.elo.ratings);
    ratings.set(teamId, (ratings.get(teamId) ?? 1505) + eloForWins(winsDelta, remaining));
    const after = winsDelta ? simulate(model.games, model.conferences, ratings, SIMS, seededRandom(season)) : base;
    return { base, after };
  }, [model, season, teamId, winsDelta, remaining]);

  if (!snap?.box?.['2'] || seasons.loading) return <Loading />;
  const names = snap.players ?? {};
  const team = teams.find((t) => t.id === teamId);
  const toggle = (id: string) => {
    const next = new Set(changed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChanged(next);
  };
  const b = result?.base.get(teamId);
  const a = result?.after.get(teamId);
  const conf = model.conferences.get(teamId);
  const movers = result
    ? [...result.after.values()]
        .filter((o) => o.teamId !== teamId && model.conferences.get(o.teamId) === conf)
        .map((o) => ({ id: o.teamId, d: o.playoffs - (result.base.get(o.teamId)?.playoffs ?? 0) }))
        .filter((m) => Math.abs(m.d) >= 0.02)
        .sort((x, y) => Math.abs(y.d) - Math.abs(x.d))
        .slice(0, 4)
    : [];
  return (
    <>
      <p className="muted">Pick a team, then sit players for the rest of the season or bring back players listed as out. Each player is worth his Win Shares per game so far (shrunk while he has played only a few games) over the {remaining} games left, turned into a change in the team's Elo rating, and the season is simulated {SIMS.toLocaleString()} times.</p>
      <label className="small">
        Team{' '}
        <select value={teamId} onChange={(e) => { setTeamId(e.target.value); setChanged(new Set()); }}>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      {!remaining ? (
        <Empty>{team?.name} have no regular-season games left.</Empty>
      ) : (
        <div className="two-col">
          <div className="card">
            <h3>Players</h3>
            <ul className="trade-list">
              {players.map((p) => {
                const on = changed.has(p.id);
                return (
                  <li key={p.id}>
                    <label className={on ? 'active' : undefined}>
                      <input type="checkbox" checked={on} onChange={() => toggle(p.id)} />
                      <span className="trade-name">{names[p.id] ?? p.id}{p.out ? <span className="muted small"> · out</span> : null}</span>
                      <span className="muted small">{p.ws.toFixed(1)} WS</span>
                      <span className="trade-salary small">{p.out ? (on ? 'Back' : 'Bring back') : on ? 'Sitting' : 'Sit'}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="card">
            <h3 className="team-title">{team && <TeamLogo team={team} size={22} />} {team?.name}</h3>
            {b && a && (
              <>
                <div className="stat-tiles">
                  {([['Wins', b.avgWins.toFixed(1), a.avgWins.toFixed(1)], ['Playoffs', oddsPct(b.playoffs), oddsPct(a.playoffs)], ['Title', oddsPct(b.champion), oddsPct(a.champion)]] as const).map(([label, x, y]) => (
                    <div key={label} className="tile">
                      <div className="tile-value">{y}</div>
                      <div className="tile-label">{label}{x !== y ? ` · was ${x}` : ''}</div>
                    </div>
                  ))}
                </div>
                <p className="small">
                  {winsDelta ? `${winsDelta > 0 ? '+' : ''}${winsDelta.toFixed(1)} wins over the rest of the season (${eloForWins(winsDelta, remaining) > 0 ? '+' : ''}${Math.round(eloForWins(winsDelta, remaining))} Elo).` : 'Tick a player to see the difference.'}
                </p>
                {movers.length > 0 && (
                  <p className="small">
                    <b>Playoff odds elsewhere in the {conf?.replace(' Conference', '')}:</b>{' '}
                    {movers.map((m, i) => (
                      <span key={m.id}>{i > 0 && ', '}<Link to={`/team/${m.id}`}>{model.teams.find((t) => t.id === m.id)?.abbr}</Link> {m.d > 0 ? '+' : ''}{Math.round(m.d * 100)}</span>
                    ))}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
      <p className="muted small">Win Shares only count what a player has done so far, so a star back from a long injury or a rookie still settling in can be under- or over-rated. Replacements' minutes aren't modelled beyond that.</p>
    </>
  );
}
