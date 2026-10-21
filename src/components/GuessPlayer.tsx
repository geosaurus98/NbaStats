// "Guess the player" from their career path of franchises. Six guesses; each
// wrong guess shows franchises in common and whether the answer debuted
// earlier or later, and unlocks another hint.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { allStarCounts, perGame, totals, type CareerData } from '../lib/careers';
import { careerSegments } from '../lib/history';
import { seededRandom, seedFromString, todayKey } from '../lib/games';
import { findPlayer, type Graph } from '../lib/teammates';
import { useCareers } from './CareerStats';
import { ShareButton } from './ShareButton';
import { ErrorBox, Loading } from './Status';

const GUESSES = 6;

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

/** Well-known players with an interesting path: 3+ franchises, modern era, big career. */
function candidates(graph: Graph, data: CareerData): number[] {
  const stars = allStarCounts(data);
  return graph.data.players
    .map((_, p) => p)
    .filter((p) => {
      const [, , last] = graph.data.players[p];
      if (last < 1985) return false;
      const keys = new Set(careerSegments(graph, p).map((s) => s.key));
      if (keys.size < 3) return false;
      const t = totals(data.seasons[p] ?? []);
      return t.values.pts >= 12000 || (stars.get(p) ?? 0) >= 3;
    });
}

interface State {
  guesses: number[];
  done: boolean;
}

export function GuessPlayer({ graph }: { graph: Graph }) {
  const careers = useCareers();
  const [seed, setSeed] = useState(() => `guess-${todayKey()}`);
  const daily = seed === `guess-${todayKey()}`;
  const pool = useMemo(() => (careers.data ? candidates(graph, careers.data) : []), [graph, careers.data]);
  const target = pool.length ? pool[Math.floor(seededRandom(seedFromString(seed))() * pool.length)] : undefined;
  const [state, setState] = useState<State>(() => load<State>(seed) ?? { guesses: [], done: false });
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setState(load<State>(seed) ?? { guesses: [], done: false });
    setMsg('');
  }, [seed]);
  useEffect(() => save(seed, state), [seed, state]);

  if (careers.loading) return <Loading label="Loading every career…" />;
  if (careers.error) return <ErrorBox error={careers.error} />;
  if (target == null) return null;
  const data = careers.data!;
  const players = graph.data.players;
  const path = careerSegments(graph, target);
  const pathKeys = new Set(path.map((s) => s.key));
  const won = state.guesses.includes(target);
  const over = won || state.guesses.length >= GUESSES || state.done;
  const wrong = state.guesses.filter((g) => g !== target).length;
  const t = totals(data.seasons[target] ?? []);
  const [name, debut] = players[target];
  const hints = [
    `Debuted in the ${Math.floor((debut - 1) / 10) * 10}s`,
    `Career: ${perGame(t, 'pts')?.toFixed(1)} points, ${perGame(t, 'trb')?.toFixed(1)} rebounds, ${perGame(t, 'ast')?.toFixed(1)} assists per game`,
    `${allStarCounts(data).get(target) ?? 0}× All-Star, ${t.seasons} seasons`,
    `Initials: ${name.split(' ').map((w) => w[0]).join('.')}.`,
  ];

  const guess = () => {
    const p = findPlayer(graph.data, text);
    if (p == null) {
      setMsg(`No player called "${text}".`);
      return;
    }
    if (state.guesses.includes(p)) {
      setMsg('Already guessed.');
      return;
    }
    setMsg('');
    setText('');
    setState((s) => ({ ...s, guesses: [...s.guesses, p] }));
  };

  return (
    <>
      <p className="muted">Whose career is this? Teams in order (today's franchise names). {GUESSES} guesses; every miss unlocks a hint.</p>
      <div className="actions">
        <span className="chip static">{daily ? `Daily · ${todayKey()}` : 'Random player'}</span>
        <button className="chip" onClick={() => setSeed(`guess-random-${Date.now()}`)}>🎲 New random player</button>
        {!daily && <button className="chip" onClick={() => setSeed(`guess-${todayKey()}`)}>Back to today's</button>}
      </div>
      <div className="card connect-card">
        <div className="path-clue">
          {path.map((s, i) => (
            <span key={i} className="path-step">
              {i > 0 && <span className="muted">→</span>}
              <span className="chip static">{s.defunct ? s.code : s.key}</span>
            </span>
          ))}
        </div>
        <ul className="hint-list">
          {hints.slice(0, over ? hints.length : wrong).map((h) => (
            <li key={h}>💡 {h}</li>
          ))}
        </ul>
        {state.guesses.length > 0 && (
          <table className="guess-table">
            <thead>
              <tr>
                <th className="left">Guess</th>
                <th>Teams in common</th>
                <th>Debut</th>
              </tr>
            </thead>
            <tbody>
              {state.guesses.map((g) => {
                const keys = new Set(careerSegments(graph, g).map((s) => s.key));
                const common = [...keys].filter((k) => pathKeys.has(k));
                const d = players[g][1];
                return (
                  <tr key={g} className={g === target ? 'right' : ''}>
                    <td className="left"><b>{players[g][0]}</b></td>
                    <td>{g === target ? '✓' : `${common.length}${common.length ? ` (${common.join(', ')})` : ''}`}</td>
                    <td>{g === target ? '✓' : d === debut ? '= same year' : d > debut ? `${d - 1} · answer earlier ↓` : `${d - 1} · answer later ↑`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!over && (
          <div className="grid-input">
            <input autoFocus list="all-players" value={text} placeholder="Type a player…" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && guess()} />
            <button className="chip active" onClick={guess} disabled={!text}>Guess ({GUESSES - state.guesses.length} left)</button>
            <button className="chip" onClick={() => setState((s) => ({ ...s, done: true }))}>Give up</button>
          </div>
        )}
        {msg && <p className="loss">{msg}</p>}
        {over && (
          <p>
            <b>{won ? `🎉 Got it in ${state.guesses.length}!` : 'Out of guesses.'}</b> It was{' '}
            <Link to={`/history?tab=careers&p=${encodeURIComponent(name)}`}>{name}</Link>.{' '}
            <button className="link" onClick={() => setState({ guesses: [], done: false })}>Play again</button>{' '}
            <ShareButton
              label="Share result"
              text={`🏀 NBA Stats Hub · Guess the player ${daily ? todayKey() : ''}\n${state.guesses.map((g) => (g === target ? '🟩' : '🟥')).join('')} ${won ? `${state.guesses.length}/${GUESSES}` : `X/${GUESSES}`}`}
            />
          </p>
        )}
      </div>
    </>
  );
}
