// Daily trivia: five multiple-choice questions generated from the data
// (champions, scoring leaders, MVPs, No. 1 picks, win totals).
import type { CareerData } from './careers';
import { CHAMPIONS, type FranchiseData } from './franchiseData';
import { franchiseOf } from './franchises';
import type { Graph } from './teammates';
import { seasonLabel } from './teammates';

export interface Question {
  kind: string;
  text: string;
  options: string[];
  answer: number;
  /** One line shown after answering. */
  fact: string;
}

const pick = <T>(xs: T[], rand: () => number): T => xs[Math.floor(rand() * xs.length)];
function shuffle<T>(xs: T[], rand: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function ask(kind: string, text: string, right: string, wrong: string[], fact: string, rand: () => number): Question | undefined {
  const others = [...new Set(wrong.filter((w) => w && w !== right))].slice(0, 3);
  if (others.length < 3) return undefined;
  const options = shuffle([right, ...others], rand);
  return { kind, text, options, answer: options.indexOf(right), fact };
}

export function makeQuiz(fd: FranchiseData, careers: CareerData, graph: Graph, rand: () => number): Question[] {
  const name = (p: number) => graph.data.players[p][0];
  const nba = fd.teamSeasons.map((s, i) => ({ s, i })).filter(({ s }) => s[1] !== 1 && s[0] >= 1960);
  const makers: (() => Question | undefined)[] = [
    () => {
      const year = pick(Object.keys(CHAMPIONS).map(Number).filter((y) => y >= 1960 && y <= 2026), rand);
      const champ = fd.teamSeasons.find((s) => s[0] === year && s[2] === CHAMPIONS[year]);
      if (!champ) return undefined;
      const rivals = shuffle(fd.teamSeasons.filter((s) => s[0] === year && s[6] && s !== champ), rand).map((s) => s[3]);
      return ask('Champions', `Who won the ${seasonLabel(year)} NBA title?`, champ[3], rivals, `${champ[3]} went ${champ[4]}-${champ[5]} that season.`, rand);
    },
    () => {
      const { s, i } = pick(nba.filter(({ i }) => (fd.top[i]?.length ?? 0) >= 20), rand);
      const top = fd.top[i];
      const players = Array.from({ length: top.length / 5 }, (_, k) => top.slice(k * 5, k * 5 + 5));
      const [leader] = players;
      return ask(
        'Scoring leader',
        `Who led the ${seasonLabel(s[0])} ${s[3]} in scoring?`,
        name(leader[0]),
        players.slice(1).map((p) => name(p[0])),
        `${name(leader[0])} scored ${(leader[2] / 10).toFixed(1)} points a game for a ${s[4]}-${s[5]} team.`,
        rand,
      );
    },
    () => {
      const rows = careers.awards['nba mvp'] ?? [];
      const years = [...new Set(rows.map((r) => r[0]))].filter((y) => y >= 1960);
      const year = pick(years, rand);
      const voted = rows.filter((r) => r[0] === year).sort((a, b) => b[2] - a[2]);
      const winner = voted.find((r) => r[3]);
      if (!winner) return undefined;
      return ask('MVP', `Who won MVP in ${seasonLabel(year)}?`, name(winner[1]), voted.filter((r) => r !== winner).map((r) => name(r[1])), `${name(winner[1])} took ${(winner[2] * 100).toFixed(0)}% of the vote.`, rand);
    },
    () => {
      const firsts = fd.draft.filter((d) => d[2] === 1 && d[1] !== 1 && d[0] >= 1960);
      const d = pick(firsts, rand);
      const others = fd.draft.filter((x) => x[0] === d[0] && x[1] === d[1] && x[2] >= 2 && x[2] <= 6).map((x) => x[6]);
      return ask('Draft', `Who was the No. 1 pick in the ${d[0]} draft?`, d[6], shuffle(others, rand), `${franchiseOf(d[4])?.name ?? d[4]} took ${d[6]}${d[7] ? ` out of ${d[7]}` : ''}.`, rand);
    },
    () => {
      const { s } = pick(nba.filter(({ s }) => s[4] + s[5] >= 70), rand);
      const right = s[4];
      const wrong = shuffle([-12, -8, -5, -3, 3, 5, 8, 12], rand).map((d) => right + d).filter((w) => w > 0 && w < s[4] + s[5]);
      return ask('Record', `How many games did the ${seasonLabel(s[0])} ${s[3]} win?`, String(right), wrong.map(String), `They finished ${s[4]}-${s[5]}${s[6] ? ' and made the playoffs' : ''}.`, rand);
    },
  ];
  const out: Question[] = [];
  for (const make of makers) {
    for (let tries = 0; tries < 20; tries++) {
      const q = make();
      if (q) {
        out.push(q);
        break;
      }
    }
  }
  return out;
}
