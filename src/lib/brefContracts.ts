// Parses a Basketball-Reference team payroll page (/contracts/<TEAM>.html):
// each player's salary for this season and the next five, with options and
// non-guaranteed years marked.

export type SalaryFlag = '' | 'player-option' | 'team-option' | 'early-termination' | 'non-guaranteed';

export interface PayrollPlayer {
  /** Basketball-Reference player id. */
  bref: string;
  /** ESPN athlete id, when we can match one. */
  espn?: string;
  name: string;
  age?: number;
  /** Salary per season, this season first (null = no salary that year). */
  salaries: (number | null)[];
  flags: SalaryFlag[];
  /** Guaranteed money left on the deal. */
  guaranteed: number;
}

const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/<[^>]+>/g, '').trim();

function flagOf(cell: string): SalaryFlag {
  if (/salary-pl/.test(cell)) return 'player-option';
  if (/salary-tm/.test(cell)) return 'team-option';
  if (/salary-et/.test(cell)) return 'early-termination';
  if (/<em>/.test(cell)) return 'non-guaranteed';
  return '';
}

export function parseBrefContracts(html: string, seasons = 6): PayrollPlayer[] {
  const start = html.indexOf('id="contracts"');
  if (start < 0) return [];
  const body = html.slice(start, html.indexOf('</tbody>', start));
  const out: PayrollPlayer[] = [];
  for (const row of body.split(/<tr[\s>]/).slice(1)) {
    const player = /data-stat="player"[^>]*csk="([^"]+)"[^>]*>(.*?)<\/th>/.exec(row);
    if (!player) continue;
    const cell = (stat: string) => new RegExp(`<td[^>]*data-stat="${stat}"[^>]*>(.*?)</td>`).exec(row);
    const tag = (stat: string) => new RegExp(`<td[^>]*data-stat="${stat}"[^>]*>`).exec(row)?.[0] ?? '';
    const csk = (stat: string) => {
      const m = /csk="(\d+)"/.exec(tag(stat));
      return m ? Number(m[1]) : null;
    };
    const salaries: (number | null)[] = [];
    const flags: SalaryFlag[] = [];
    for (let y = 1; y <= seasons; y++) {
      const v = csk(`y${y}`);
      salaries.push(v);
      flags.push(v == null ? '' : flagOf(tag(`y${y}`) + (cell(`y${y}`)?.[1] ?? '')));
    }
    const age = Number(decode(cell('age_today')?.[1] ?? ''));
    out.push({ bref: player[1], name: decode(player[2]), age: Number.isFinite(age) && age > 0 ? age : undefined, salaries, flags, guaranteed: csk('remain_gtd') ?? 0 });
  }
  return out;
}
