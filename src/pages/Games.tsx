import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { GuessPlayer } from '../components/GuessPlayer';
import { HigherLower } from '../components/HigherLower';
import { PlayerDatalist } from '../components/PlayerInput';
import { TeamLogo } from '../components/TeamLogo';
import { espnLogo, franchiseById } from '../lib/franchises';
import { franchiseSets, hint, linkingRosters, makeConnect, makeGrid, obscurity, seededRandom, seedFromString, todayKey } from '../lib/games';
import { useTeammateGraph } from '../lib/teammateStore';
import { Loading as GraphLoading } from '../components/Status';
import { bfs, findPlayer, pathTo, seasonLabel, type Graph } from '../lib/teammates';

function load<T>(key: string): T | undefined {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : undefined;
  } catch {
    return undefined;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

function FranchiseBadge({ id }: { id: string }) {
  const f = franchiseById(id)!;
  return (
    <div className="grid-head">
      <TeamLogo team={{ id: f.espnId, name: f.name, shortName: f.name, abbr: f.id, logo: espnLogo(f) }} size={34} />
      <span>{f.name.split(' ').slice(-1)[0]}</span>
    </div>
  );
}

export function Games() {
  const graph = useTeammateGraph();
  if (!graph) return <GraphLoading label="Loading every roster since 1946-47…" />;
  return <GamesPage graph={graph} />;
}

function GamesPage({ graph }: { graph: Graph }) {
  const [params, setParams] = useSearchParams();
  const tabs = [
    { id: 'grid', label: 'Played for both' },
    { id: 'connect', label: 'Connect the players' },
    { id: 'guess', label: 'Guess the player' },
    { id: 'higher', label: 'Higher or lower' },
  ];
  const tab = tabs.find((t) => t.id === params.get('tab'))?.id ?? 'grid';
  return (
    <section>
      <PlayerDatalist graph={graph} />
      <h1>Games</h1>
      <div className="tabs">
        {tabs.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setParams({ tab: t.id }, { replace: true })}>{t.label}</button>
        ))}
      </div>
      {tab === 'grid' && <GridGame graph={graph} />}
      {tab === 'connect' && <ConnectGame graph={graph} />}
      {tab === 'guess' && <GuessPlayer graph={graph} />}
      {tab === 'higher' && <HigherLower graph={graph} />}
      <p className="muted small">Based on every BAA/NBA/ABA roster since 1946-47, grouped into today's franchises (e.g. Seattle counts as OKC).</p>
    </section>
  );
}

// ---------- Played for both ----------

const GUESSES = 9;

interface GridState {
  picks: (number | null)[];
  guessesLeft: number;
  gaveUp: boolean;
}

function GridGame({ graph }: { graph: Graph }) {
  const players = graph.data.players;
  const [seed, setSeed] = useState(() => `grid-${todayKey()}`);
  const daily = seed === `grid-${todayKey()}`;
  const sets = useMemo(() => franchiseSets(graph), [graph]);
  const grid = useMemo(() => makeGrid(graph, seededRandom(seedFromString(seed)), sets), [graph, seed, sets]);
  const fresh: GridState = { picks: Array(9).fill(null), guessesLeft: GUESSES, gaveUp: false };
  const [state, setState] = useState<GridState>(() => load<GridState>(seed) ?? fresh);
  const [active, setActive] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setState(load<GridState>(seed) ?? fresh);
    setActive(null);
    setMessage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);
  useEffect(() => save(seed, state), [seed, state]);

  const solved = state.picks.filter((p) => p != null).length;
  const over = state.gaveUp || state.guessesLeft === 0 || solved === 9;
  const scores = state.picks.map((p, i) => (p == null ? null : obscurity(graph, p, grid.answers[Math.floor(i / 3)][i % 3])));
  const total = scores.reduce<number>((s, v) => s + (v ?? 0), 0);

  const guess = () => {
    if (active == null || over) return;
    const p = findPlayer(graph.data, text);
    if (p == null) {
      setMessage({ ok: false, text: `No player called "${text}".` });
      return;
    }
    if (state.picks.includes(p)) {
      setMessage({ ok: false, text: `${players[p][0]} is already used.` });
      return;
    }
    const r = Math.floor(active / 3);
    const c = active % 3;
    const ok = grid.answers[r][c].includes(p);
    setState((s) => ({ ...s, guessesLeft: s.guessesLeft - 1, picks: ok ? s.picks.map((x, i) => (i === active ? p : x)) : s.picks }));
    setMessage(
      ok
        ? { ok: true, text: `✓ ${players[p][0]}: one of ${grid.answers[r][c].length} possible answers.` }
        : { ok: false, text: `✗ ${players[p][0]} didn't play for both ${grid.rows[r]} and ${grid.cols[c]}.` },
    );
    setText('');
    if (ok) setActive(null);
  };

  return (
    <>
      <p className="muted">
        Name a player who played for <b>both</b> the row team and the column team, in any era. {GUESSES} guesses, each player once.
        Deeper cuts score more.
      </p>
      <div className="actions">
        <span className="chip static">{daily ? `Daily grid · ${todayKey()}` : 'Random grid'}</span>
        <button className="chip" onClick={() => setSeed(`grid-random-${Date.now()}`)}>🎲 New random grid</button>
        {!daily && <button className="chip" onClick={() => setSeed(`grid-${todayKey()}`)}>Back to today's</button>}
      </div>
      <div className="grid-game">
        <div />
        {grid.cols.map((c) => (
          <FranchiseBadge key={c} id={c} />
        ))}
        {grid.rows.map((r, ri) => (
          <div key={r} className="grid-row">
            <FranchiseBadge id={r} />
            {grid.cols.map((c, ci) => {
              const i = ri * 3 + ci;
              const pick = state.picks[i];
              const answers = grid.answers[ri][ci];
              return (
                <button
                  key={c}
                  className={`grid-cell${pick != null ? ' done' : ''}${active === i ? ' active' : ''}`}
                  disabled={pick != null || over}
                  onClick={() => {
                    setActive(i);
                    setMessage(null);
                  }}
                >
                  {pick != null ? (
                    <>
                      <b>{players[pick][0]}</b>
                      <span className="small">obscurity {scores[i]}</span>
                    </>
                  ) : over ? (
                    <span className="small muted">{answers.length} answers, e.g. {sampleAnswers(graph, answers).join(', ')}</span>
                  ) : (
                    <span className="muted small">{answers.length} possible</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {!over && active != null && (
        <div className="grid-input">
          <span className="small">
            Played for {franchiseById(grid.rows[Math.floor(active / 3)])!.name} and {franchiseById(grid.cols[active % 3])!.name}:
          </span>
          <input
            autoFocus
            list="all-players"
            value={text}
            placeholder="Type a player…"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && guess()}
          />
          <button className="chip active" onClick={guess} disabled={!text}>Guess</button>
        </div>
      )}
      {message && <p className={message.ok ? 'win' : 'loss'}>{message.text}</p>}

      <div className="actions">
        <span className="chip static">
          {solved}/9 · {state.guessesLeft} guesses left · obscurity score {total}
        </span>
        {!over && <button className="chip" onClick={() => setState((s) => ({ ...s, gaveUp: true }))}>Give up & show answers</button>}
        {over && <button className="chip" onClick={() => setState(fresh)}>Play this grid again</button>}
      </div>
      {over && <p><b>{solved === 9 ? '🏆 Perfect grid!' : `Finished: ${solved}/9.`}</b> Obscurity score {total} (max 900).</p>}
    </>
  );
}

function sampleAnswers(g: Graph, answers: number[]): string[] {
  const len = (p: number) => g.data.players[p][2] - g.data.players[p][1];
  return [...answers].sort((a, b) => len(b) - len(a)).slice(0, 2).map((p) => g.data.players[p][0]);
}

// ---------- Connect the players ----------

interface ConnectState {
  chain: number[];
  hints: number;
  gaveUp: boolean;
}

function ConnectGame({ graph }: { graph: Graph }) {
  const players = graph.data.players;
  const [seed, setSeed] = useState(() => `connect-${todayKey()}`);
  const daily = seed === `connect-${todayKey()}`;
  const puzzle = useMemo(() => makeConnect(graph, seededRandom(seedFromString(seed))), [graph, seed]);
  const fresh: ConnectState = { chain: [puzzle.start], hints: 0, gaveUp: false };
  const [state, setState] = useState<ConnectState>(() => load<ConnectState>(seed) ?? fresh);
  const [text, setText] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [shownHint, setShownHint] = useState<string | null>(null);

  useEffect(() => {
    setState(load<ConnectState>(seed) ?? { chain: [puzzle.start], hints: 0, gaveUp: false });
    setMessage(null);
    setShownHint(null);
  }, [seed, puzzle.start]);
  useEffect(() => save(seed, state), [seed, state]);

  const current = state.chain[state.chain.length - 1];
  const won = current === puzzle.target;
  const over = won || state.gaveUp;
  const links = state.chain.length - 1;
  const best = useMemo(() => pathTo(bfs(graph, puzzle.start), puzzle.target), [graph, puzzle]);
  const toGo = useMemo(() => bfs(graph, puzzle.target).dist[current], [graph, puzzle.target, current]);

  const add = () => {
    const p = findPlayer(graph.data, text);
    if (p == null) {
      setMessage({ ok: false, text: `No player called "${text}".` });
      return;
    }
    if (state.chain.includes(p)) {
      setMessage({ ok: false, text: `${players[p][0]} is already in your chain.` });
      return;
    }
    const via = linkingRosters(graph, current, p);
    if (via.length === 0) {
      setMessage({ ok: false, text: `${players[p][0]} never played with ${players[current][0]}.` });
      return;
    }
    setState((s) => ({ ...s, chain: [...s.chain, p] }));
    setMessage({ ok: true, text: `✓ Teammates on the ${rosterName(graph, via[via.length - 1])}.` });
    setShownHint(null);
    setText('');
  };

  const giveHint = () => {
    const h = hint(graph, current, puzzle.target);
    if (!h) return;
    setState((s) => ({ ...s, hints: s.hints + 1 }));
    setShownHint(`Try a teammate from the ${rosterName(graph, h.roster)}.`);
  };

  return (
    <>
      <p className="muted">
        Get from <b>{players[puzzle.start][0]}</b> to <b>{players[puzzle.target][0]}</b> by naming teammates, one link at a time. The
        shortest chain takes {puzzle.optimal} links.
      </p>
      <div className="actions">
        <span className="chip static">{daily ? `Daily puzzle · ${todayKey()}` : 'Random puzzle'}</span>
        <button className="chip" onClick={() => setSeed(`connect-random-${Date.now()}`)}>🎲 New random pair</button>
        {!daily && <button className="chip" onClick={() => setSeed(`connect-${todayKey()}`)}>Back to today's</button>}
      </div>

      <div className="card connect-card">
        <ol className="chain">
          {state.chain.map((p, k) => {
            const via = k > 0 ? linkingRosters(graph, state.chain[k - 1], p) : [];
            return (
              <li key={p}>
                {k > 0 && <div className="chain-via">teammates on the {via.map((r) => rosterName(graph, r)).slice(-2).join(' / ')}</div>}
                <div className="chain-player">
                  <span className="chain-step">{k}</span>
                  <b>{players[p][0]}</b>
                  <span className="muted small">{players[p][1] - 1}–{players[p][2]}</span>
                </div>
              </li>
            );
          })}
          {!won && (
            <li className="chain-target">
              <div className="chain-via dashed">{toGo > 0 ? `${toGo} link${toGo === 1 ? '' : 's'} away at best` : ''}</div>
              <div className="chain-player">
                <span className="chain-step target">?</span>
                <b>{players[puzzle.target][0]}</b>
                <span className="muted small">{players[puzzle.target][1] - 1}–{players[puzzle.target][2]}</span>
              </div>
            </li>
          )}
        </ol>

        {!over && (
          <div className="grid-input">
            <span className="small">A teammate of {players[current][0]}:</span>
            <input autoFocus list="all-players" value={text} placeholder="Type a player…" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
            <button className="chip active" onClick={add} disabled={!text}>Add</button>
          </div>
        )}
        {message && !over && <p className={message.ok ? 'win' : 'loss'}>{message.text}</p>}
        {shownHint && !over && <p className="muted">💡 {shownHint}</p>}

        <div className="actions">
          {!over && <button className="chip" onClick={giveHint}>💡 Hint</button>}
          {!over && state.chain.length > 1 && (
            <button className="chip" onClick={() => setState((s) => ({ ...s, chain: s.chain.slice(0, -1) }))}>↶ Undo</button>
          )}
          {!over && <button className="chip" onClick={() => setState((s) => ({ ...s, gaveUp: true }))}>Show the answer</button>}
          {over && <button className="chip" onClick={() => setState(fresh)}>Play again</button>}
        </div>

        {won && (
          <p>
            <b>{links === puzzle.optimal ? '🏆 Perfect, the shortest possible chain!' : `🎉 Connected in ${links} links`}</b>{' '}
            (best: {puzzle.optimal}){state.hints ? `, with ${state.hints} hint${state.hints === 1 ? '' : 's'}` : ''}.
          </p>
        )}
        {over && (
          <p className="muted small">
            One shortest chain: {best.map((l) => players[l.player][0]).join(' → ')}.{' '}
            <Link to={`/degrees?c=${encodeURIComponent(players[puzzle.start][0])}&t=${encodeURIComponent(players[puzzle.target][0])}`}>See it on the 6 Degrees map →</Link>
          </p>
        )}
      </div>
    </>
  );
}

function rosterName(g: Graph, r: number): string {
  const [season, lg, team] = g.data.rosters[r];
  return `${seasonLabel(season)} ${team}${lg === 'NBA' ? '' : ` (${lg})`}`;
}
