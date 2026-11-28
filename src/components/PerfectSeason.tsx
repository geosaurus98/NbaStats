// Games → Perfect Season: you're dealt a random team-season each round and
// take one of its players for an open spot in your starting five. Once all
// five are in, the season is played out: can they go 82-0?
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { allStarCounts } from '../lib/careers';
import { franchiseOf } from '../lib/franchises';
import { dailyKey, eraFrom, randomKey, seededRandom, seedFromString, type Era } from '../lib/games';
import { deck, distance, FIRST_SEASON, playSeason, rate, SLOTS, type Card, type Slot } from '../lib/perfectSeason';
import { seasonLabel, type Graph } from '../lib/teammates';
import { useCareers } from './CareerStats';
import { ShareButton } from './ShareButton';
import { ErrorBox, Loading } from './Status';

const SKIPS = 2;

interface Pick {
  player: number;
  season: number;
  team: string;
}
interface State {
  picks: Partial<Record<Slot, Pick>>;
  /** Deals used so far (picks plus skips). */
  dealt: number;
  skips: number;
}

function load(k: string): State | undefined {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as State) : undefined;
  } catch {
    return undefined;
  }
}
function save(k: string, v: State) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
}

const fresh = (): State => ({ picks: {}, dealt: 0, skips: SKIPS });
const teamName = (code: string) => franchiseOf(code)?.name ?? code;

export function PerfectSeason({ graph, era }: { graph: Graph; era: Era }) {
  const careers = useCareers();
  const [seed, setSeed] = useState(() => dailyKey('perfect', era));
  const daily = seed === dailyKey('perfect', era);
  const [state, setState] = useState<State>(() => load(seed) ?? fresh());
  useEffect(() => {
    setState(load(seed) ?? fresh());
  }, [seed]);
  useEffect(() => save(seed, state), [seed, state]);

  const from = eraFrom(era, FIRST_SEASON);
  const all = useMemo(() => (careers.data ? deck(graph, careers.data, from) : []), [graph, careers.data, from]);
  // The order teams are dealt in, fixed by the puzzle's seed.
  const order = useMemo(() => {
    const rand = seededRandom(seedFromString(seed));
    const idx = all.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx;
  }, [all, seed]);

  if (careers.error) return <ErrorBox error={careers.error} />;
  if (!careers.data || !all.length) return <Loading label="Shuffling every team since 1973-74…" />;
  const data = careers.data;
  const name = (p: number) => graph.data.players[p]?.[0] ?? '';
  const cardOf = (p: Pick): Card | undefined => all.find((d) => d.season === p.season && d.team === p.team)?.cards.find((c) => c.player === p.player);
  const team: Partial<Record<Slot, Card>> = Object.fromEntries(SLOTS.flatMap((s) => (state.picks[s] ? [[s, cardOf(state.picks[s]!)]] : [])).filter(([, c]) => c));
  const open = SLOTS.filter((s) => !state.picks[s]);
  const done = open.length === 0;
  const deal = done ? undefined : all[order[state.dealt % order.length]];
  const rating = rate(team);
  const result = done ? playSeason(rating.net, seededRandom(seedFromString(`${seed}|${SLOTS.map((s) => state.picks[s]!.player).join(',')}`))) : undefined;
  const stars = allStarCounts(data);
  // One of each player: a second season of someone already picked isn't allowed.
  const taken = new Set(Object.values(state.picks).map((p) => p!.player));

  const take = (c: Card, slot: Slot) => {
    setState((s) => ({ ...s, picks: { ...s.picks, [slot]: { player: c.player, season: c.season, team: c.team } }, dealt: s.dealt + 1 }));
  };
  const skip = () => {
    setState((s) => ({ ...s, dealt: s.dealt + 1, skips: s.skips - 1 }));
  };
  const verdict = !result
    ? ''
    : result.wins === 82
      ? '🏆 82-0. A perfect season!'
      : result.wins >= 73
        ? 'An all-time great season.'
        : result.wins >= 60
          ? 'A title contender.'
          : result.wins >= 41
            ? 'A playoff team.'
            : 'Lottery bound.';

  return (
    <>
      <p className="muted">
        Each round you’re dealt a real team-season. Take one of its players for an open spot in your starting five (you get that player as they were that season).
        Fill all five and the season is played out: can they go 82-0? {SKIPS} skips per game. Players out of position, too many shots for one ball, or too few rebounds cost you.
        {era === 'all' ? ' Teams come from 1973-74 on, when steals and blocks start in the records.' : ''}
      </p>
      <div className="actions">
        <span className="chip static">{daily ? `Daily draft · ${seed.slice(-10)}` : 'Random draft'}</span>
        <button className="chip" onClick={() => setSeed(randomKey('perfect', era))}>🎲 New random draft</button>
        {!daily && <button className="chip" onClick={() => setSeed(dailyKey('perfect', era))}>Back to today's</button>}
      </div>

      <div className="perfect-lineup" aria-label="Your starting five">
        {SLOTS.map((s) => {
          const c = team[s];
          return (
            <div key={s} className={`perfect-slot${c ? ' filled' : ''}`}>
              <div className="muted small">{s}</div>
              {c ? (
                <>
                  <b>{name(c.player)}</b>
                  <div className="small muted">
                    {seasonLabel(c.season)} {c.team}
                    {distance(c.pos, s) >= 2 ? <span className="loss"> · out of position</span> : null}
                  </div>
                  <div className="small">{c.ppg.toFixed(1)} / {c.rpg.toFixed(1)} / {c.apg.toFixed(1)}</div>
                </>
              ) : (
                <div className="muted small">open</div>
              )}
            </div>
          );
        })}
      </div>

      {deal && (
        <div className="card">
          <h2 className="perfect-round">
            Round {SLOTS.length - open.length + 1}: {seasonLabel(deal.season)} {teamName(deal.team)}
          </h2>
          <p className="muted small">Pick a player by choosing the spot to put them in (a green outline is their natural position). Stats are per game that season (points / rebounds / assists).</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="left">Player</th>
                  <th>Pos</th>
                  <th>G</th>
                  <th>MIN</th>
                  <th>PTS</th>
                  <th>REB</th>
                  <th>AST</th>
                  <th className="left">Put at</th>
                </tr>
              </thead>
              <tbody>
                {deal.cards.map((c) => (
                  <tr key={c.player}>
                    <td className="left nowrap">
                      {name(c.player)}
                      {(stars.get(c.player) ?? 0) > 0 ? <span className="muted small" title="All-Star selections in their career"> ★{stars.get(c.player)}</span> : null}
                    </td>
                    <td>{c.pos || '–'}</td>
                    <td>{c.g}</td>
                    <td>{c.mpg.toFixed(1)}</td>
                    <td>{c.ppg.toFixed(1)}</td>
                    <td>{c.rpg.toFixed(1)}</td>
                    <td>{c.apg.toFixed(1)}</td>
                    <td className="left nowrap">
                      {taken.has(c.player) ? <span className="muted small">already in your five</span> : open.map((s) => (
                        <button key={s} className={`chip small-chip${distance(c.pos, s) < 1 ? ' fit' : ''}`} onClick={() => take(c, s)} aria-label={`Put ${name(c.player)} at ${s}`} title={distance(c.pos, s) >= 2 ? 'Out of position' : distance(c.pos, s) < 1 ? 'Natural position' : 'Close enough'}>
                          {s}
                        </button>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {state.skips > 0 && <button className="chip" onClick={skip}>Skip this team ({state.skips} left)</button>}
        </div>
      )}

      {result && (
        <div className="card">
          <h2>{result.wins}-{result.losses}</h2>
          <p><b>{verdict}</b> Expected about {Math.round(result.expected)} wins; longest winning streak {result.longestStreak}.</p>
          <div className="starter-strip" role="img" aria-label={`${result.wins} wins and ${result.losses} losses, game by game`}>
            {result.games.map((w, i) => (
              <span key={i} className="starter-cell" style={{ background: w ? 'var(--win)' : 'var(--loss)' }} title={`Game ${i + 1}: ${w ? 'W' : 'L'}`} />
            ))}
          </div>
          <p className="small">
            Team rating {rating.net > 0 ? '+' : ''}{rating.net.toFixed(1)} points per 100 possessions against an average team:{' '}
            {rating.parts.filter((p) => Math.abs(p.value) >= 0.1).map((p) => `${p.label.toLowerCase()} ${p.value > 0 ? '+' : ''}${p.value.toFixed(1)}`).join(', ')}.
          </p>
          <p>
            <button className="link" onClick={() => setState(fresh())}>Draft again</button>{' '}
            <ShareButton
              label="Share result"
              text={`🏀 NBA Stats Hub · Perfect Season ${daily ? seed.slice(-10) : ''}${era === 'modern' ? ' (since 2000)' : ''}\n${result.wins}-${result.losses} ${result.wins === 82 ? '🏆' : ''}\n${SLOTS.map((s) => `${s} ${name(team[s]!.player)} '${String(team[s]!.season).slice(2)}`).join('\n')}`}
            />{' '}
            <Link to="/history" className="small">See their careers in History →</Link>
          </p>
        </div>
      )}
    </>
  );
}
