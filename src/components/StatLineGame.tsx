// "Who am I?": guess the player from one season's stat line. Each miss
// reveals a hint: decade, position, age, team, initials.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { allStarCounts, COL, type CareerData } from '../lib/careers';
import { franchiseOf } from '../lib/franchises';
import { seededRandom, seedFromString, todayKey } from '../lib/games';
import { findPlayer, seasonLabel, type Graph } from '../lib/teammates';
import { useCareers } from './CareerStats';
import { ShareButton } from './ShareButton';
import { ErrorBox, Loading } from './Status';

const GUESSES = 6;
const POSITIONS: Record<string, string> = { PG: 'Point guard', SG: 'Shooting guard', SF: 'Small forward', PF: 'Power forward', C: 'Center', G: 'Guard', F: 'Forward' };

interface Pick {
  player: number;
  row: number[];
}

/** Memorable seasons: NBA, 1960 on, 50+ games and either 20+ points a game or an All-Star pick that year. */
function pool(data: CareerData): Pick[] {
  const stars = new Set(data.allStars.map(([s, p]) => `${s}|${p}`));
  const out: Pick[] = [];
  data.seasons.forEach((rows, player) => {
    for (const r of rows) {
      if (r[COL.lg] !== 0 || r[COL.season] < 1960 || r[COL.g] < 50) continue;
      if (r[COL.pts] / r[COL.g] >= 20 || stars.has(`${r[COL.season]}|${player}`)) out.push({ player, row: r });
    }
  });
  return out;
}

function load<T>(k: string): T | undefined {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : undefined;
  } catch {
    return undefined;
  }
}
function save(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
}

interface State {
  guesses: number[];
  done: boolean;
}

export function StatLineGame({ graph }: { graph: Graph }) {
  const careers = useCareers();
  const [seed, setSeed] = useState(() => `statline-${todayKey()}`);
  const daily = seed === `statline-${todayKey()}`;
  const picks = useMemo(() => (careers.data ? pool(careers.data) : []), [careers.data]);
  const target = picks.length ? picks[Math.floor(seededRandom(seedFromString(seed))() * picks.length)] : undefined;
  const [state, setState] = useState<State>(() => load<State>(seed) ?? { guesses: [], done: false });
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    setState(load<State>(seed) ?? { guesses: [], done: false });
    setMsg('');
  }, [seed]);
  useEffect(() => save(seed, state), [seed, state]);

  if (careers.error) return <ErrorBox error={careers.error} />;
  if (!careers.data || !target) return <Loading label="Loading every season…" />;
  const data = careers.data;
  const r = target.row;
  const season = r[COL.season];
  const name = graph.data.players[target.player][0];
  const won = state.guesses.includes(target.player);
  const over = won || state.done || state.guesses.length >= GUESSES;
  const wrong = state.guesses.filter((g) => g !== target.player).length;
  const g = r[COL.g];
  const per = (c: number) => (r[c] < 0 ? '–' : (r[c] / g).toFixed(1));
  const pct = (m: number, a: number) => (r[m] < 0 || r[a] <= 0 ? '–' : ((r[m] / r[a]) * 100).toFixed(1));
  const roster = graph.data.stints[target.player].map((i) => graph.data.rosters[i]).filter((ro) => ro[0] === season);
  const teams = [...new Set(roster.map((ro) => franchiseOf(String(ro[2]))?.name ?? String(ro[2])))];
  const stars = allStarCounts(data).get(target.player) ?? 0;
  const hints = [
    `The ${Math.floor((season - 1) / 10) * 10}s`,
    POSITIONS[data.pos?.[target.player] ?? ''] ?? 'Position not recorded',
    `Age ${r[COL.age]} that season · ${stars}× All-Star in his career`,
    `Played for: ${teams.join(', ') || 'unknown'}`,
    `Initials: ${name.split(' ').map((w) => w[0]).join('.')}.`,
  ];

  const guess = () => {
    const p = findPlayer(graph.data, text);
    if (p == null) return setMsg(`No player called "${text}".`);
    if (state.guesses.includes(p)) return setMsg('Already guessed.');
    setMsg('');
    setText('');
    setState((s) => ({ ...s, guesses: [...s.guesses, p] }));
  };
  const cells: [string, string][] = [
    ['G', String(g)],
    ['MIN', per(COL.mp)],
    ['PTS', per(COL.pts)],
    ['REB', per(COL.trb)],
    ['AST', per(COL.ast)],
    ['STL', per(COL.stl)],
    ['BLK', per(COL.blk)],
    ['FG%', pct(COL.fg, COL.fga)],
    ['3P%', pct(COL.tp, COL.tpa)],
    ['FT%', pct(COL.ft, COL.fta)],
  ];

  return (
    <>
      <p className="muted">Whose season is this? {GUESSES} guesses; every miss reveals a hint. "–" means the stat wasn't recorded yet (steals and blocks start in 1973-74, threes in 1979-80).</p>
      <div className="actions">
        <span className="chip static">{daily ? `Daily · ${todayKey()}` : 'Random season'}</span>
        <button className="chip" onClick={() => setSeed(`statline-random-${Date.now()}`)}>🎲 New random season</button>
        {!daily && <button className="chip" onClick={() => setSeed(`statline-${todayKey()}`)}>Back to today's</button>}
      </div>
      <div className="card connect-card">
        <div className="statline">
          {cells.map(([k, v]) => (
            <div key={k} className="statline-cell">
              <span className="muted small">{k}</span>
              <b>{v}</b>
            </div>
          ))}
        </div>
        <ul className="hint-list">
          {hints.slice(0, over ? hints.length : wrong).map((h) => (
            <li key={h}>💡 {h}</li>
          ))}
        </ul>
        {state.guesses.length > 0 && (
          <p className="small">
            Guesses:{' '}
            {state.guesses.map((p, i) => (
              <span key={p} className={p === target.player ? 'win' : 'loss'}>{i > 0 && ', '}{graph.data.players[p][0]}</span>
            ))}
          </p>
        )}
        {!over && (
          <div className="grid-input">
            <input list="all-players" value={text} placeholder="Type a player…" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && guess()} />
            <button className="chip active" onClick={guess} disabled={!text}>Guess ({GUESSES - state.guesses.length} left)</button>
            <button className="chip" onClick={() => setState((s) => ({ ...s, done: true }))}>Give up</button>
          </div>
        )}
        {msg && <p className="loss">{msg}</p>}
        {over && (
          <p>
            <b>{won ? `🎉 Got it in ${state.guesses.length}!` : 'Out of guesses.'}</b> It was{' '}
            <Link to={`/history?tab=careers&p=${encodeURIComponent(name)}`}>{name}</Link>, {seasonLabel(season)}.{' '}
            <button className="link" onClick={() => setState({ guesses: [], done: false })}>Play again</button>{' '}
            <ShareButton
              label="Share result"
              text={`🏀 NBA Stats Hub · Who am I? ${daily ? todayKey() : ''}\n${state.guesses.map((p) => (p === target.player ? '🟩' : '🟥')).join('')} ${won ? `${state.guesses.length}/${GUESSES}` : `X/${GUESSES}`}`}
            />
          </p>
        )}
      </div>
    </>
  );
}
