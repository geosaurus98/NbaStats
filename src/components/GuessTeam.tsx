// "Guess the team": name the franchise and season from a team-season's
// numbers. Each miss says whether the franchise is right and whether the
// season is earlier or later, and reveals another clue.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { DETAIL, loadFranchiseData, type FranchiseData } from '../lib/franchiseData';
import { franchiseOf, FRANCHISES } from '../lib/franchises';
import { seededRandom, seedFromString, todayKey } from '../lib/games';
import { seasonLabel, type Graph } from '../lib/teammates';
import { ShareButton } from './ShareButton';
import { ErrorBox, Loading } from './Status';

const GUESSES = 6;
const FROM = 1980;

/** Memorable NBA team-seasons since 1980: made the playoffs with an SRS of +3 or better, or won fewer than 25. */
function pool(fd: FranchiseData): number[] {
  const out: number[] = [];
  fd.teamSeasons.forEach((t, i) => {
    const [season, lg, , , w, , playoffs, srs] = t;
    if (lg !== 0 || season < FROM || !franchiseOf(t[2])) return;
    if ((playoffs && (srs ?? 0) >= 3) || w < 25) out.push(i);
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

interface Guess {
  team: string;
  season: number;
}
interface State {
  guesses: Guess[];
  done: boolean;
}

export function GuessTeam({ graph }: { graph: Graph }) {
  const fd = useAsync(() => loadFranchiseData(), []);
  const [seed, setSeed] = useState(() => `team-${todayKey()}`);
  const daily = seed === `team-${todayKey()}`;
  const picks = useMemo(() => (fd.data ? pool(fd.data) : []), [fd.data]);
  const target = picks.length ? picks[Math.floor(seededRandom(seedFromString(seed))() * picks.length)] : undefined;
  const [state, setState] = useState<State>(() => load<State>(seed) ?? { guesses: [], done: false });
  const [team, setTeam] = useState('');
  const [season, setSeason] = useState('');
  useEffect(() => {
    setState(load<State>(seed) ?? { guesses: [], done: false });
  }, [seed]);
  useEffect(() => save(seed, state), [seed, state]);

  if (fd.error) return <ErrorBox error={fd.error} />;
  if (!fd.data || target === undefined) return <Loading label="Loading every team-season…" />;
  const data = fd.data;
  const t = data.teamSeasons[target];
  const [year, , code, name, w, l, playoffs, srs, ortg, drtg, pace] = t;
  const d = data.detail[target] ?? [];
  const franchise = franchiseOf(code)!;
  const lastYear = Math.max(...data.teamSeasons.map((x) => x[0]));
  const isRight = (g: Guess) => g.team === franchise.id && g.season === year;
  const won = state.guesses.some(isRight);
  const over = won || state.done || state.guesses.length >= GUESSES;
  const wrong = state.guesses.filter((g) => !isRight(g)).length;
  const lg = data.league.find((r) => r[0] === year && r[1] === 0);
  // Top scorers: [playerIndex, g, ppg×10, rpg×10, apg×10] × 5
  const top = data.top[target] ?? [];
  const scorers = Array.from({ length: Math.floor(top.length / 5) }, (_, i) => top.slice(i * 5, i * 5 + 5));
  const fmt = (v: number | null | undefined, digits = 1) => (v == null ? '–' : v.toFixed(digits));
  const pct = (v: number | null | undefined) => (v == null ? '–' : `${(v * 100).toFixed(1)}%`);
  const clues: [string, string][] = [
    ['Record', `${w}-${l}${playoffs ? ', made the playoffs' : ', missed the playoffs'}`],
    ['Ratings', `SRS ${srs == null ? '–' : `${srs > 0 ? '+' : ''}${srs.toFixed(2)}`} · offence ${fmt(ortg)} · defence ${fmt(drtg)} per 100`],
    ['Style', `pace ${fmt(pace)} · ${pct(d[DETAIL.par3] as number | null)} of shots from three${lg?.[4] != null ? ` (league ${pct(lg[4] as number)})` : ''} · average age ${fmt(d[DETAIL.age] as number | null)}`],
    ['Top scorers', scorers.slice(0, 3).map((s) => `${(s[2] / 10).toFixed(1)} / ${(s[3] / 10).toFixed(1)} / ${(s[4] / 10).toFixed(1)}`).join(' · ') + ' (pts/reb/ast)'],
    ['Decade', `The ${Math.floor((year - 1) / 10) * 10}s`],
    ['Best player', graph.data.players[scorers[0]?.[0]]?.[0] ?? 'unknown'],
  ];
  const shown = over ? clues.length : Math.min(clues.length, 3 + wrong);
  const guess = () => {
    const s = Number(season);
    if (!team || !s) return;
    setState((st) => ({ ...st, guesses: [...st.guesses, { team, season: s }] }));
  };
  const hint = (g: Guess) =>
    isRight(g) ? '✓' : `${g.team === franchise.id ? 'right team' : 'wrong team'}, ${g.season === year ? 'right season' : g.season < year ? 'later season' : 'earlier season'}`;
  const sorted = [...FRANCHISES].sort((a, b) => a.name.localeCompare(b.name));
  const nameOf = (id: string) => FRANCHISES.find((f) => f.id === id)?.name ?? id;

  return (
    <>
      <p className="muted">Which team-season is this? Pick the franchise and the season. {GUESSES} guesses; each miss tells you if the team and the season are right, and shows another clue. Teams count as today’s franchise (Seattle is OKC).</p>
      <div className="actions">
        <span className="chip static">{daily ? `Daily · ${todayKey()}` : 'Random team'}</span>
        <button className="chip" onClick={() => setSeed(`team-random-${Date.now()}`)}>🎲 New random team</button>
        {!daily && <button className="chip" onClick={() => setSeed(`team-${todayKey()}`)}>Back to today's</button>}
      </div>
      <div className="card connect-card">
        <dl className="clue-list">
          {clues.slice(0, shown).map(([k, v]) => (
            <div key={k}>
              <dt className="muted small">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        {state.guesses.length > 0 && (
          <ul className="hint-list">
            {state.guesses.map((g, i) => (
              <li key={i} className={isRight(g) ? 'win' : undefined}>{nameOf(g.team)} {seasonLabel(g.season)}: <span className={isRight(g) ? 'win' : 'muted'}>{hint(g)}</span></li>
            ))}
          </ul>
        )}
        {!over && (
          <div className="grid-input">
            <select aria-label="Franchise" value={team} onChange={(e) => setTeam(e.target.value)}>
              <option value="">Franchise…</option>
              {sorted.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <select aria-label="Season" value={season} onChange={(e) => setSeason(e.target.value)}>
              <option value="">Season…</option>
              {Array.from({ length: lastYear - FROM + 1 }, (_, i) => lastYear - i).map((y) => (
                <option key={y} value={y}>{seasonLabel(y)}</option>
              ))}
            </select>
            <button className="chip active" onClick={guess} disabled={!team || !season}>Guess ({GUESSES - state.guesses.length} left)</button>
            <button className="chip" onClick={() => setState((s) => ({ ...s, done: true }))}>Give up</button>
          </div>
        )}
        {over && (
          <p>
            <b>{won ? `🎉 Got it in ${state.guesses.length}!` : 'Out of guesses.'}</b> It was the {seasonLabel(year)} <Link to={`/franchise/${franchise.id}`}>{name}</Link>.{' '}
            <button className="link" onClick={() => setState({ guesses: [], done: false })}>Play again</button>{' '}
            <ShareButton
              label="Share result"
              text={`🏀 NBA Stats Hub · Guess the team ${daily ? todayKey() : ''}\n${state.guesses.map((g) => (isRight(g) ? '🟩' : g.team === franchise.id || g.season === year ? '🟨' : '🟥')).join('')} ${won ? `${state.guesses.length}/${GUESSES}` : `X/${GUESSES}`}`}
            />
          </p>
        )}
      </div>
    </>
  );
}
