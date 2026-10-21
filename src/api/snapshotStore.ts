// Loads the bundled season snapshots (src/data/season-*.json). Kept apart from
// ./snapshot so the Node snapshot script can import the format without Vite.
import { expandGame, type SeasonSnapshot } from './snapshot';
import type { SeasonType } from './live';
import type { Game } from './types';

const files = import.meta.glob<SeasonSnapshot>('../data/season-*.json', { eager: true, import: 'default' });
const byYear = new Map<number, SeasonSnapshot>(Object.values(files).map((s) => [s.year, s]));

export function getSnapshot(year: number): SeasonSnapshot | undefined {
  return byYear.get(year);
}

const expanded = new Map<string, Game[]>();

/** All games of a season type from the snapshot, expanded, date-ordered. */
export function snapshotGames(year: number, type: SeasonType): Game[] | undefined {
  const snap = byYear.get(year);
  const list = snap?.games[String(type)];
  if (!snap || !list) return undefined;
  const key = `${year}:${type}`;
  if (!expanded.has(key)) {
    const teams = new Map(snap.teams.map((t) => [t.id, t]));
    expanded.set(key, list.map((c) => expandGame(c, teams)));
  }
  return expanded.get(key);
}
