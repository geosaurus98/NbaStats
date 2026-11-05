// "Career reveal": guess a player from their career, shown one season at a
// time from their rookie year, with years and teams hidden. Every wrong guess
// (or skip) shows the next season; the fewer seasons you need, the better.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { allStarCounts, COL, type CareerData } from '../lib/careers';
import { franchiseOf } from '../lib/franchises';
import { seededRandom, seedFromString, todayKey } from '../lib/games';
import { findPlayer, seasonLabel, type Graph } from '../lib/teammates';
import { useCareers } from './CareerStats';
import { ShareButton } from './ShareButton';
import { ErrorBox, Loading } from './Status';

const GUESSES = 8;

/** Notable NBA careers since 1980 with at least six seasons: an All-Star pick, or 15+ points a game over 400+ games. */
function pool(data: CareerData): number[] {
  const stars = allStarCounts(data);
  const out: number[] = [];
  data.seasons.forEach((rows, player) => {
    const nba = rows.filter((r) => r[COL.lg] === 0);
    const seasons = new Set(nba.map((r) => r[COL.season]));
    if (seasons.size < 6 || Math.min(...seasons) < 1980) return;
    const g = nba.reduce((a, r) => a + r[COL.g], 0);
    const pts = nba.reduce((a, r) => a + r[COL.pts], 0);
    if ((stars.get(player) ?? 0) > 0 || (g >= 400 && pts / g >= 15)) out.push(player);
  });
  return out;
}

/** One row per season (traded seasons keep the row with the most games: the season total). */
function seasonsOf(data: CareerData, player: number): number[][] {
  const by = new Map<number, number[]>();
  for (const r of data.seasons[player] ?? []) {
    if (r[COL.lg] !== 0) continue;
    const s = r[COL.season];
    if (!by.has(s) || by.get(s)![COL.g] < r[COL.g]) by.set(s, r);
  }
  return [...by.values()].sort((a, b) => a[COL.season] - b[COL.season]);
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
  skips: number;
  done: boolean;
}

export function CareerReveal({ graph }: { graph: Graph }) {
  const careers = useCareers();
  const [seed, setSeed] = useState(() => `reveal-${todayKey()}`);
  const daily = seed === `reveal-${todayKey()}`;
  const picks = useMemo(() => (careers.data ? pool(careers.data) : []), [careers.data]);
  const target = picks.length ? picks[Math.floor(seededRandom(seedFromString(seed))() * picks.length)] : undefined;
  const fresh: State = { guesses: [], skips: 0, done: false };
  const [state, setState] = useState<State>(() => load<State>(seed) ?? fresh);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    setState(load<State>(seed) ?? { guesses: [], skips: 0, done: false });
    setMsg('');
  }, [seed]);
  useEffect(() => save(seed, state), [seed, state]);

  if (careers.error) return <ErrorBox error={careers.error} />;
  if (!careers.data || target === undefined) return <Loading label="Loading every career…" />;
  const rows = seasonsOf(careers.data, target);
  const name = graph.data.players[target][0];
  const won = state.guesses.includes(target);
  const wrong = state.guesses.filter((g) => g !== target).length;
  const over = won || state.done || wrong >= GUESSES;
  const shown = over ? rows.length : Math.min(rows.length, 1 + wrong + state.skips);
  const per = (r: number[], c: number) => (r[c] < 0 ? '–' : (r[c] / r[COL.g]).toFixed(1));
  const pct = (r: number[], m: number, a: number) => (r[m] < 0 || r[a] <= 0 ? '–' : ((r[m] / r[a]) * 100).toFixed(1));
  const teamsIn = (season: number) =>
    [...new Set(graph.data.stints[target].map((i) => graph.data.rosters[i]).filter((ro) => ro[0] === season).map((ro) => franchiseOf(String(ro[2]))?.id ?? String(ro[2])))].join('/');
  const debut = rows[0]?.[COL.season] ?? 0;

  const guess = () => {
    const p = findPlayer(graph.data, text);
    if (p == null) return setMsg(`No player called "${text}".`);
    if (state.guesses.includes(p)) return setMsg('Already guessed.');
    setMsg('');
    setText('');
    setState((s) => ({ ...s, guesses: [...s.guesses, p] }));
  };

  return (
    <>
      <p className="muted">Whose career is this? It starts with their rookie season; every wrong guess, or a skip, shows the next one. Years and teams stay hidden until the end. {GUESSES} wrong guesses allowed.</p>
      <div className="actions">
        <span className="chip static">{daily ? `Daily · ${todayKey()}` : 'Random career'}</span>
        <button className="chip" onClick={() => setSeed(`reveal-random-${Date.now()}`)}>🎲 New random career</button>
        {!daily && <button className="chip" onClick={() => setSeed(`reveal-${todayKey()}`)}>Back to today's</button>}
      </div>
      <div className="card connect-card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="left">Season</th>
                <th>Age</th>
                <th>G</th>
                <th>MIN</th>
                <th>PTS</th>
                <th>REB</th>
                <th>AST</th>
                <th className="hide-sm">FG%</th>
                <th className="hide-sm">3P%</th>
                {over && <th className="left">Team</th>}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, shown).map((r, i) => (
                <tr key={r[COL.season]}>
                  <td className="left nowrap">{over ? seasonLabel(r[COL.season]) : `Year ${i + 1}`}</td>
                  <td>{r[COL.age]}</td>
                  <td>{r[COL.g]}</td>
                  <td>{per(r, COL.mp)}</td>
                  <td>{per(r, COL.pts)}</td>
                  <td>{per(r, COL.trb)}</td>
                  <td>{per(r, COL.ast)}</td>
                  <td className="hide-sm">{pct(r, COL.fg, COL.fga)}</td>
                  <td className="hide-sm">{pct(r, COL.tp, COL.tpa)}</td>
                  {over && <td className="left small">{teamsIn(r[COL.season])}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!over && (
          <p className="muted small">
            Showing {shown} of {rows.length} seasons.{wrong >= 3 ? ` Debuted in the ${Math.floor(debut / 10) * 10}s.` : ''}{wrong >= 5 ? ` Initials: ${name.split(' ').map((w) => w[0]).join('.')}.` : ''}
          </p>
        )}
        {state.guesses.length > 0 && (
          <p className="small">
            Guesses:{' '}
            {state.guesses.map((p, i) => (
              <span key={p} className={p === target ? 'win' : 'loss'}>{i > 0 && ', '}{graph.data.players[p][0]}</span>
            ))}
          </p>
        )}
        {!over && (
          <div className="grid-input">
            <input list="all-players" aria-label="Your guess" value={text} placeholder="Type a player…" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && guess()} />
            <button className="chip active" onClick={guess} disabled={!text}>Guess ({GUESSES - wrong} left)</button>
            {shown < rows.length && <button className="chip" onClick={() => setState((s) => ({ ...s, skips: s.skips + 1 }))}>Show next season</button>}
            <button className="chip" onClick={() => setState((s) => ({ ...s, done: true }))}>Give up</button>
          </div>
        )}
        {msg && <p className="loss">{msg}</p>}
        {over && (
          <p>
            <b>{won ? `🎉 Got it after ${1 + wrong + state.skips} season${1 + wrong + state.skips === 1 ? '' : 's'}!` : 'Out of guesses.'}</b> It was{' '}
            <Link to={`/history?tab=careers&p=${encodeURIComponent(name)}`}>{name}</Link>.{' '}
            <button className="link" onClick={() => setState({ guesses: [], skips: 0, done: false })}>Play again</button>{' '}
            <ShareButton
              label="Share result"
              text={`🏀 NBA Stats Hub · Career reveal ${daily ? todayKey() : ''}\n${won ? `Got it after ${1 + wrong + state.skips} of ${rows.length} seasons` : `Missed (${rows.length} seasons)`} ${state.guesses.map((p) => (p === target ? '🟩' : '🟥')).join('')}`}
            />
          </p>
        )}
      </div>
    </>
  );
}
