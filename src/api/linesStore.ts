// Every player's line in every game (src/data/lines-*.json), loaded only by
// the pages that need it.
import type { SeasonLines } from '../lib/boxTotals';

const loaders = import.meta.glob<SeasonLines>('../data/lines-*.json', { import: 'default' });
const byYear = new Map(Object.entries(loaders).map(([path, load]) => [Number(/lines-(\d+)\.json$/.exec(path)![1]), load]));
const pending = new Map<number, Promise<SeasonLines | undefined>>();

export function loadLines(year: number): Promise<SeasonLines | undefined> {
  const load = byYear.get(year);
  if (!load) return Promise.resolve(undefined);
  if (!pending.has(year)) pending.set(year, load());
  return pending.get(year)!;
}
