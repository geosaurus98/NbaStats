// Site-wide search: teams, every player in history and pages. Opens from the
// header button or the "/" key; arrow keys + Enter to pick.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { snapshotPlayers } from '../api/espn';
import { FRANCHISES } from '../lib/franchises';
import { SEASONS } from '../lib/seasons';
import { getTeammateGraph } from '../lib/teammateStore';
import { normName } from '../lib/teammates';

interface Result {
  kind: 'Team' | 'Player' | 'Page';
  label: string;
  detail: string;
  to: string;
  score: number;
}

const PAGES = [
  { label: 'Scores & fixtures', to: '/', words: 'scores fixtures results today games schedule' },
  { label: 'Standings', to: '/standings', words: 'standings table conference race' },
  { label: 'Playoffs bracket', to: '/playoffs', words: 'playoffs bracket finals champion' },
  { label: 'Player leaders & season highs', to: '/leaders', words: 'leaders stats points rebounds assists highs' },
  { label: 'Playoff odds & projections', to: '/projections', words: 'projections odds playoff chances elo power ratings predictions' },
  { label: 'Power ratings', to: '/projections?tab=ratings', words: 'power ratings elo rankings upsets' },
  { label: 'All-time leaders', to: '/history?tab=leaders', words: 'all time leaders career records' },
  { label: 'Awards & MVP voting', to: '/history?tab=awards', words: 'awards mvp dpoy rookie all star voting' },
  { label: 'Guess the player game', to: '/games?tab=guess', words: 'games guess player wordle' },
  { label: 'Higher or lower game', to: '/games?tab=higher', words: 'games higher lower streak' },
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

function useIndex() {
  return useMemo(() => {
    const graph = getTeammateGraph();
    // ESPN ids for current-era players, matched on accent-free names.
    const espn = new Map<string, string>();
    for (const s of SEASONS) for (const [id, name] of Object.entries(snapshotPlayers(s.year))) espn.set(normName(name), id);
    const players = graph.data.players.map(([name, from, to]) => ({ name, n: normName(name), from, to, espnId: espn.get(normName(name)) }));
    return { players };
  }, []);
}

function search(index: ReturnType<typeof useIndex>, query: string): Result[] {
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
    if (s) out.push({ kind: 'Team', label: f.name, detail: f.id, to: `/team/${f.espnId}`, score: s + 15 });
  }
  for (const p of index.players) {
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
  const index = useIndex();
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
              {query && results.length === 0 && <li className="muted small pad">No matches.</li>}
              {!query && <li className="muted small pad">Try "Durant", "Celtics", "Mikan", "grid"…</li>}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
