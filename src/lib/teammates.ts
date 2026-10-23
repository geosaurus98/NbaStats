// "Degrees of separation" between players: two players are linked if they
// were on the same team in the same season. The graph is stored bipartite
// (players ↔ team-season rosters) so a breadth-first search visits each
// roster once instead of every teammate pair.

export interface TeammateData {
  source: string;
  generatedAt: string;
  /** [name, firstSeason, lastSeason] — season = the year it ends in. */
  players: [string, number, number][];
  /** [season, league, team, playerIndexes] */
  rosters: [number, string, string, number[]][];
  /** [playerIndex, averageDistance] for the most connected players. */
  central: [number, number][];
  /** Each player's rosters in career order (within a season: order played). */
  stints: number[][];
  /** Basketball-Reference player ids, by player index. */
  ids?: string[];
  /** ESPN athlete id → player index, for everyone in the season in progress. */
  espn?: Record<string, number>;
}

export interface Graph {
  data: TeammateData;
  /** Roster indexes each player appears on. */
  playerRosters: number[][];
}

export function buildGraph(data: TeammateData): Graph {
  const playerRosters: number[][] = data.players.map(() => []);
  data.rosters.forEach(([, , , ids], r) => {
    for (const p of ids) playerRosters[p].push(r);
  });
  return { data, playerRosters };
}

export interface Search {
  /** Distance from the centre; -1 = unreachable. */
  dist: Int16Array;
  /** Player we came from, and the roster that links them. */
  parent: Int32Array;
  via: Int32Array;
  /** Players per distance (index = distance). */
  counts: number[];
}

export function bfs(g: Graph, start: number): Search {
  const n = g.data.players.length;
  const dist = new Int16Array(n).fill(-1);
  const parent = new Int32Array(n).fill(-1);
  const via = new Int32Array(n).fill(-1);
  const seenRoster = new Uint8Array(g.data.rosters.length);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  dist[start] = 0;
  queue[tail++] = start;
  while (head < tail) {
    const p = queue[head++];
    for (const r of g.playerRosters[p]) {
      if (seenRoster[r]) continue;
      seenRoster[r] = 1;
      for (const q of g.data.rosters[r][3]) {
        if (dist[q] !== -1) continue;
        dist[q] = dist[p] + 1;
        parent[q] = p;
        via[q] = r;
        queue[tail++] = q;
      }
    }
  }
  const counts: number[] = [];
  for (let i = 0; i < n; i++) if (dist[i] >= 0) counts[dist[i]] = (counts[dist[i]] ?? 0) + 1;
  return { dist, parent, via, counts };
}

export interface Link {
  player: number;
  /** Roster connecting this player to the previous one in the chain. */
  roster?: number;
}

/** Chain from the centre out to `target` (centre first). Empty if unreachable. */
export function pathTo(s: Search, target: number): Link[] {
  if (s.dist[target] < 0) return [];
  const out: Link[] = [];
  for (let p = target; p !== -1; p = s.parent[p]) out.push({ player: p, roster: s.via[p] >= 0 ? s.via[p] : undefined });
  return out.reverse();
}

/** Average distance from `start` to every reachable player. */
export function averageDistance(s: Search): number {
  let sum = 0;
  let n = 0;
  s.counts.forEach((c, d) => {
    sum += c * d;
    n += c;
  });
  return n > 1 ? sum / (n - 1) : 0;
}

/** The `top` players with the lowest average distance to everyone. */
export function centrality(g: Graph, top: number): [number, number][] {
  const scores: [number, number][] = [];
  // Only rank players connected to the main body of the league; a small
  // isolated group would otherwise score a misleadingly short average.
  const reach = (s: Search) => s.counts.reduce((a, b) => a + b, 0);
  const best = Math.max(...[0, Math.floor(g.data.players.length / 2)].map((p) => reach(bfs(g, p))));
  for (let p = 0; p < g.data.players.length; p++) {
    const s = bfs(g, p);
    if (reach(s) >= best) scores.push([p, averageDistance(s)]);
  }
  return scores.sort((a, b) => a[1] - b[1]).slice(0, top).map(([p, avg]) => [p, Math.round(avg * 1000) / 1000]);
}

/** Lower-case, accent-free name for matching ("Dončić" → "doncic"). */
export function normName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Best match for a typed name: exact, then prefix, then substring; ties → longer career. */
export function findPlayer(data: TeammateData, query: string): number | undefined {
  const q = normName(query);
  if (!q) return undefined;
  let best: { i: number; score: number } | undefined;
  data.players.forEach(([name, from, to], i) => {
    const n = normName(name);
    const rank = n === q ? 3 : n.startsWith(q) ? 2 : n.includes(q) ? 1 : 0;
    if (!rank) return;
    const score = rank * 1000 + (to - from);
    if (!best || score > best.score) best = { i, score };
  });
  return best?.i;
}

/** "1996-97" style label from the ending year. */
export function seasonLabel(season: number): string {
  return `${season - 1}-${String(season).slice(-2)}`;
}
