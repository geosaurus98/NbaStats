// Loads the bundled season snapshots (src/data/season-*.json) on demand: the
// hosted site downloads a season's file only when it's first needed. Kept
// apart from ./snapshot so the Node snapshot script can import the format
// without Vite.
import { expandGame, type SeasonSnapshot } from './snapshot';
import type { SeasonType } from './live';
import type { Game } from './types';

const loaders = import.meta.glob<SeasonSnapshot>('../data/season-*.json', { import: 'default' });
const loaderByYear = new Map(Object.entries(loaders).map(([path, load]) => [Number(/season-(\d+)\.json$/.exec(path)![1]), load]));
const byYear = new Map<number, SeasonSnapshot>();
const pending = new Map<number, Promise<SeasonSnapshot | undefined>>();

/** Years that have a bundled snapshot. */
export function snapshotYears(): number[] {
  return [...loaderByYear.keys()].sort((a, b) => b - a);
}

/** Fetches a season's snapshot (once); resolves undefined if there isn't one. */
export function loadSnapshot(year: number): Promise<SeasonSnapshot | undefined> {
  const load = loaderByYear.get(year);
  if (!load) return Promise.resolve(undefined);
  if (!pending.has(year)) {
    pending.set(
      year,
      load().then((s) => {
        byYear.set(year, s);
        return s;
      }),
    );
  }
  return pending.get(year)!;
}

/** A snapshot that has already been loaded (see loadSnapshot / SnapshotGate). */
export function getSnapshot(year: number): SeasonSnapshot | undefined {
  return byYear.get(year);
}

const expanded = new Map<string, Game[]>();

/** All games of a season type from a loaded snapshot, expanded, date-ordered. */
export function snapshotGames(year: number, type: SeasonType): Game[] | undefined {
  const snap = byYear.get(year);
  const list = snap?.games[String(type)];
  if (!snap || !list) return undefined;
  const key = `${year}:${type}`;
  if (!expanded.has(key)) {
    const teams = new Map(snap.teams.map((t) => [t.id, t]));
    // Older snapshots kept postponed games as 0-0 "finals".
    expanded.set(key, list.filter((c) => !(c[4] === 0 && c[5] === 0)).map((c) => expandGame(c, teams)));
  }
  return expanded.get(key);
}
