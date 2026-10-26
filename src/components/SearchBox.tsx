// Site-wide search: teams, every player in history and pages. Opens from the
// header button or the "/" key; arrow keys + Enter to pick.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { allSnapshotPlayers } from '../api/espn';
import { FRANCHISES } from '../lib/franchises';
import { loadTeammateGraph } from '../lib/teammateStore';
import { normName } from '../lib/teammates';

interface Result {
  kind: 'Team' | 'Player' | 'Page';
  label: string;
  detail: string;
  to: string;
  score: number;
}

const PAGES = [
  { label: 'Home dashboard', to: '/', words: 'home dashboard today overview' },
  { label: 'My team', to: '/myteam', words: 'my team favourite favorite hub' },
  { label: 'Scores & fixtures', to: '/scores', words: 'scores fixtures results today games schedule' },
  { label: 'Standings', to: '/standings', words: 'standings table conference race' },
  { label: 'Playoffs bracket', to: '/playoffs', words: 'playoffs bracket finals champion' },
  { label: 'Player leaders & season highs', to: '/leaders', words: 'leaders stats points rebounds assists highs' },
  { label: 'Playoff odds & projections', to: '/projections', words: 'projections odds playoff chances elo power ratings predictions' },
  { label: 'Power ratings', to: '/projections?tab=ratings', words: 'power ratings elo rankings upsets' },
  { label: 'All-time leaders', to: '/history?tab=leaders', words: 'all time leaders career records' },
  { label: 'Awards & MVP voting', to: '/history?tab=awards', words: 'awards mvp dpoy rookie all star voting' },
  { label: 'Team vs team across eras', to: '/history?tab=teams', words: 'compare team seasons eras greatest bulls warriors matchup' },
  { label: 'Greatest teams of all time', to: '/history?tab=greatest', words: 'greatest best teams ever all time srs dynasty' },
  { label: 'Similar players (any era)', to: '/history?tab=similar', words: 'similar players comparison comps era like' },
  { label: 'Standings what if', to: '/projections?tab=whatif', words: 'what if picks standings scenarios seeding' },
  { label: 'Draft lottery odds', to: '/projections?tab=lottery', words: 'draft lottery tankathon odds pick tank' },
  { label: 'Draft history', to: '/history?tab=draft', words: 'draft picks history steals busts number one' },
  { label: 'Guess the player game', to: '/games?tab=guess', words: 'games guess player wordle' },
  { label: 'Who am I? stat-line game', to: '/games?tab=statline', words: 'games who am i stat line guess season puzzle' },
  { label: 'Trivia quiz', to: '/games?tab=trivia', words: 'trivia quiz questions daily' },
  { label: 'Higher or lower game', to: '/games?tab=higher', words: 'games higher lower streak' },
  { label: 'Awards race (MVP, DPOY, ROY)', to: '/awards', words: 'awards race mvp dpoy roy rookie defensive ladder model' },
  { label: 'Milestone watch', to: '/leaders?tab=milestones', words: 'milestones career records passing all time watch' },
  { label: 'Shooting zones', to: '/insights?tab=zones', words: 'shooting zones corner three mid range rim' },
  { label: 'Salaries & payrolls', to: '/salaries', words: 'salaries salary payroll cap tax apron contracts money' },
  { label: 'Shot types (dunks, layups, step-backs)', to: '/insights?tab=shots', words: 'shot type dunk layup floater hook fadeaway pullup stepback assisted unassisted self created quarter' },
  { label: 'Points by source', to: '/insights?tab=sources', words: 'paint fast break three free throw midrange points source' },
  { label: 'Usage vs efficiency', to: '/insights?tab=usage', words: 'usage efficiency true shooting scatter load' },
  { label: 'Team styles (pace & threes)', to: '/insights?tab=styles', words: 'pace three point rate style era scatter' },
  { label: 'Team rankings', to: '/rankings', words: 'rankings team stats strength schedule sos' },
  { label: 'Head-to-head', to: '/h2h', words: 'h2h head to head compare teams' },
  { label: 'Compare players', to: '/compare', words: 'compare players side by side' },
  { label: '6 Degrees (teammate graph)', to: '/degrees', words: 'six degrees kevin bacon teammates graph' },
  { label: 'Most exciting games', to: '/insights?tab=drama', words: 'exciting drama comebacks clutch insights' },
  { label: 'Passing duos', to: '/insights?tab=duos', words: 'passing duos assists insights' },
  { label: 'Player movement map', to: '/history?tab=movement', words: 'history movement trades chord' },
  { label: 'Career journeys & journeymen', to: '/history?tab=careers', words: 'history careers journeymen' },
  { label: 'Roster continuity', to: '/history?tab=continuity', words: 'history continuity roster heatmap' },
  { label: 'Played-for-both grid game', to: '/games?tab=grid', words: 'games grid puzzle immaculate' },
  { label: 'Connect the players game', to: '/games?tab=connect', words: 'games connect puzzle chain' },
];

interface Index {
  players: { name: string; n: string; from: number; to: number; espnId?: string }[];
}

let indexPromise: Promise<Index> | undefined;

/** Built on first search: every player since 1946-47, with ESPN ids for current-era players. */
function loadIndex(): Promise<Index> {
  indexPromise ??= Promise.all([loadTeammateGraph(), allSnapshotPlayers()]).then(([graph, directory]) => {
    const espn = new Map<string, string>();
    for (const [id, name] of Object.entries(directory)) espn.set(normName(name), id);
    return { players: graph.data.players.map(([name, from, to]) => ({ name, n: normName(name), from, to, espnId: espn.get(normName(name)) })) };
  });
  return indexPromise;
}

function search(index: Index | undefined, query: string): Result[] {
  const q = normName(query);
  if (!q) return [];
  const out: Result[] = [];
  const rank = (text: string) => {
    const t = normName(text);
    if (t === q) return 100;
    if (t.startsWith(q)) return 80;
    if (t.split(' ').some((w) => w.startsWith(q))) return 60;
    if (t.includes(q)) return 30;
    return 0;
  };
  for (const f of FRANCHISES) {
    const byId = rank(f.id);
    const s = Math.max(rank(f.name), byId ? byId + 5 : 0);
    if (s) {
      out.push({ kind: 'Team', label: f.name, detail: f.id, to: `/team/${f.espnId}`, score: s + 15 });
      out.push({ kind: 'Page', label: `${f.name} history`, detail: 'Franchise', to: `/franchise/${f.id}`, score: s + 14 });
    }
  }
  for (const p of index?.players ?? []) {
    const s = rank(p.name);
    if (!s) continue;
    // Prefer recent, long careers among equal matches.
    const bonus = (p.to - 1940) / 20 + Math.min(10, p.to - p.from) / 2;
    out.push({
      kind: 'Player',
      label: p.name,
      detail: `${p.from - 1}–${p.to}${p.espnId ? '' : ' · career'}`,
      to: p.espnId ? `/player/${p.espnId}` : `/history?tab=careers&p=${encodeURIComponent(p.name)}`,
      score: s + bonus,
    });
  }
  for (const pg of PAGES) {
    const s = Math.max(rank(pg.label), ...pg.words.split(' ').map((w) => (w.startsWith(q) ? 50 : 0)));
    if (s) out.push({ kind: 'Page', label: pg.label, detail: 'Page', to: pg.to, score: s });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 10);
}

export function SearchBox() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [index, setIndex] = useState<Index | undefined>();
  useEffect(() => {
    if (open && !index) loadIndex().then(setIndex);
  }, [open, index]);
  const results = useMemo(() => search(index, query), [index, query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (e.key === '/' && !typing) {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 0);
    else setQuery('');
  }, [open]);
  useEffect(() => setSel(0), [query]);

  const go = (r: Result | undefined) => {
    if (!r) return;
    navigate(r.to);
    setOpen(false);
  };

  return (
    <>
      <button className="search-button" aria-label="Search (press /)" title="Search (press /)" onClick={() => setOpen(true)}>
        🔍<span className="search-hint">Search players, teams, pages…</span>
        <kbd className="search-key">/</kbd>
      </button>
      {open && (
        <div className="search-overlay" onClick={() => setOpen(false)}>
          <div className="search-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Search">
            <input
              ref={input}
              value={query}
              placeholder="Search players (any era), teams or pages…"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setSel((s) => Math.min(results.length - 1, s + 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setSel((s) => Math.max(0, s - 1));
                } else if (e.key === 'Enter') go(results[sel]);
              }}
            />
            <ul className="search-results">
              {results.map((r, i) => (
                <li key={`${r.kind}${r.to}`}>
                  <button className={i === sel ? 'active' : ''} onMouseEnter={() => setSel(i)} onClick={() => go(r)}>
                    <span className="search-kind">{r.kind}</span>
                    <b>{r.label}</b>
                    <span className="muted small">{r.detail}</span>
                  </button>
                </li>
              ))}
              {query && !index && <li className="muted small pad">Loading players…</li>}
              {query && index && results.length === 0 && <li className="muted small pad">No matches.</li>}
              {!query && <li className="muted small pad">Try "Durant", "Celtics", "Mikan", "grid"…</li>}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
