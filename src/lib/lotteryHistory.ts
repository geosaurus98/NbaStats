// Draft lottery history since 1985: the non-playoff teams by record, and who
// actually picked at the top of each draft.
import type { FranchiseData } from './franchiseData';

export interface LotteryYear {
  year: number;
  /** Non-playoff teams, worst record first: [code, name, wins, losses]. */
  order: [string, string, number, number][];
  /** Top picks: pick, team code, player, pre-lottery rank of the picking team (undefined = pick acquired from a playoff team or via trade). */
  picks: { pick: number; team: string; player: string; playerIndex: number; rank?: number }[];
}

export function lotteryHistory(fr: FranchiseData, from = 1985, top = 4): LotteryYear[] {
  const out: LotteryYear[] = [];
  const years = [...new Set(fr.draft.filter((d) => d[1] === 0 && d[0] >= from).map((d) => d[0]))].sort((a, b) => b - a);
  for (const year of years) {
    const order = fr.teamSeasons
      .filter((t) => t[0] === year && t[1] === 0 && !t[6])
      .sort((a, b) => a[4] / (a[4] + a[5]) - b[4] / (b[4] + b[5]))
      .map((t) => [t[2], t[3], t[4], t[5]] as [string, string, number, number]);
    if (order.length < 7) continue;
    const rank = new Map(order.map((t, i) => [t[0], i + 1]));
    const picks = fr.draft
      .filter((d) => d[0] === year && d[1] === 0 && d[2] <= top)
      .sort((a, b) => a[2] - b[2])
      .map(([, , pick, , team, playerIndex, player]) => ({ pick, team, player, playerIndex, rank: rank.get(team) }));
    out.push({ year, order, picks });
  }
  return out;
}

/** Jumps up the order (pre-lottery rank minus pick) for picks a lottery team made itself. */
export function biggestJumps(years: LotteryYear[], n = 10) {
  return years
    .flatMap((y) => y.picks.filter((p) => p.rank != null && p.rank > p.pick).map((p) => ({ year: y.year, ...p, jump: p.rank! - p.pick, name: y.order[p.rank! - 1][1] })))
    .sort((a, b) => b.jump - a.jump || b.year - a.year)
    .slice(0, n);
}
