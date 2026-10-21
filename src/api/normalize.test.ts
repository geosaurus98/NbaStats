import { describe, expect, it } from 'vitest';
import {
  normalizeGameLog,
  normalizeLeaders,
  normalizeScoreboard,
  normalizeStandings,
  normalizeSummary,
  normalizeTeamSchedule,
} from './normalize';

const team = (id: string, abbr: string, name: string) => ({
  id,
  abbreviation: abbr,
  displayName: name,
  shortDisplayName: name.split(' ').pop(),
  logo: `https://a.espncdn.com/${abbr}.png`,
  color: '000000',
});

describe('normalizeScoreboard', () => {
  it('maps a final game with string scores, records and leaders', () => {
    const [g] = normalizeScoreboard({
      events: [
        {
          id: '401',
          date: '2026-04-12T23:30Z',
          status: { type: { state: 'post', completed: true, shortDetail: 'Final/OT' } },
          competitions: [
            {
              venue: { fullName: 'Crypto.com Arena' },
              broadcasts: [{ names: ['ESPN'] }],
              competitors: [
                {
                  homeAway: 'home',
                  winner: true,
                  score: '120',
                  team: team('13', 'LAL', 'Los Angeles Lakers'),
                  records: [{ name: 'overall', type: 'total', summary: '50-32' }],
                  linescores: [{ value: 30 }, { value: 25 }, { value: 28 }, { value: 27 }, { value: 10 }],
                  leaders: [{ abbreviation: 'PTS', leaders: [{ displayValue: '35', athlete: { shortName: 'L. Doncic' } }] }],
                },
                { homeAway: 'away', winner: false, score: '115', team: team('2', 'BOS', 'Boston Celtics') },
              ],
            },
          ],
        },
      ],
    });
    expect(g.state).toBe('post');
    expect(g.statusDetail).toBe('Final/OT');
    expect(g.home.team.abbr).toBe('LAL');
    expect(g.home.team.color).toBe('#000000');
    expect(g.home.score).toBe(120);
    expect(g.away.score).toBe(115);
    expect(g.home.record).toBe('50-32');
    expect(g.home.linescores).toEqual([30, 25, 28, 27, 10]);
    expect(g.home.leaders[0]).toEqual({ category: 'PTS', athlete: 'L. Doncic', value: '35' });
    expect(g.broadcasts).toEqual(['ESPN']);
    expect(g.venue).toBe('Crypto.com Arena');
  });

  it('treats a scheduled game as pre with no score', () => {
    const [g] = normalizeScoreboard({
      events: [
        {
          id: '402',
          status: { type: { state: 'pre' } },
          competitions: [
            { competitors: [{ homeAway: 'home', team: team('1', 'ATL', 'Atlanta Hawks') }, { homeAway: 'away', team: team('5', 'CLE', 'Cleveland Cavaliers') }] },
          ],
        },
      ],
    });
    expect(g.state).toBe('pre');
    expect(g.home.score).toBeUndefined();
  });

  it('handles empty payloads', () => {
    expect(normalizeScoreboard({})).toEqual([]);
    expect(normalizeScoreboard(undefined)).toEqual([]);
  });
});

describe('postponed games', () => {
  it('drops postponed or 0-0 "final" games', () => {
    const ev = (id: string, state: string, name: string, hs: string, as: string) => ({
      id,
      status: { type: { state, name } },
      competitions: [{ competitors: [{ homeAway: 'home', score: hs, team: team('1', 'A', 'A A') }, { homeAway: 'away', score: as, team: team('2', 'B', 'B B') }] }],
    });
    const games = normalizeScoreboard({
      events: [ev('1', 'post', 'STATUS_POSTPONED', '0', '0'), ev('2', 'post', 'STATUS_FINAL', '0', '0'), ev('3', 'post', 'STATUS_FINAL', '101', '99'), ev('4', 'pre', 'STATUS_SCHEDULED', '0', '0')],
    });
    expect(games.map((g) => g.id)).toEqual(['3', '4']);
  });
});

describe('normalizeTeamSchedule', () => {
  it('reads object-shaped scores', () => {
    const { games, team: t } = normalizeTeamSchedule({
      team: team('13', 'LAL', 'Los Angeles Lakers'),
      events: [
        {
          id: '1',
          competitions: [
            {
              status: { type: { state: 'post' } },
              competitors: [
                { homeAway: 'home', winner: true, score: { value: 101, displayValue: '101' }, team: team('13', 'LAL', 'Los Angeles Lakers') },
                { homeAway: 'away', winner: false, score: { value: 99, displayValue: '99' }, team: team('2', 'BOS', 'Boston Celtics') },
              ],
            },
          ],
        },
      ],
    });
    expect(t?.name).toBe('Los Angeles Lakers');
    expect(games[0].state).toBe('post');
    expect(games[0].home.score).toBe(101);
    expect(games[0].away.score).toBe(99);
  });
});

describe('normalizeStandings', () => {
  it('builds conferences ordered by playoff seed', () => {
    const stat = (name: string, value: number | string, extra: object = {}) => ({ name, value, displayValue: String(value), ...extra });
    const confs = normalizeStandings({
      children: [
        {
          name: 'Eastern Conference',
          standings: {
            entries: [
              { team: team('2', 'BOS', 'Boston Celtics'), stats: [stat('wins', 50), stat('losses', 32), stat('winPercent', 0.61), stat('playoffSeed', 2), stat('gamesBehind', 5)] },
              {
                team: team('5', 'CLE', 'Cleveland Cavaliers'),
                stats: [
                  stat('wins', 55),
                  stat('losses', 27),
                  stat('winPercent', 0.671),
                  stat('playoffSeed', 1),
                  stat('gamesBehind', '-'),
                  stat('streak', 'W3'),
                  stat('avgPointsFor', 118.2),
                  { name: 'Home', type: 'home', summary: '30-11', displayValue: '30-11' },
                  { name: 'Last Ten Games', type: 'lasttengames', summary: '7-3', displayValue: '7-3' },
                ],
              },
            ],
          },
        },
      ],
    });
    expect(confs).toHaveLength(1);
    expect(confs[0].rows.map((r) => r.team.abbr)).toEqual(['CLE', 'BOS']);
    const cle = confs[0].rows[0];
    expect(cle).toMatchObject({ wins: 55, losses: 27, streak: 'W3', home: '30-11', last10: '7-3', ppg: 118.2 });
  });
});

describe('normalizeSummary', () => {
  it('extracts box score players, totals and team stats', () => {
    const s = normalizeSummary({
      header: {
        id: '401',
        competitions: [
          {
            date: '2026-04-12T23:30Z',
            status: { type: { state: 'post', shortDetail: 'Final' } },
            competitors: [
              { homeAway: 'home', score: '120', winner: true, team: team('13', 'LAL', 'Los Angeles Lakers') },
              { homeAway: 'away', score: '115', winner: false, team: team('2', 'BOS', 'Boston Celtics') },
            ],
          },
        ],
      },
      gameInfo: { venue: { fullName: 'Crypto.com Arena' } },
      boxscore: {
        teams: [{ team: { id: '13' }, statistics: [{ label: 'Rebounds', displayValue: '44' }] }],
        players: [
          {
            team: team('13', 'LAL', 'Los Angeles Lakers'),
            statistics: [
              {
                labels: ['MIN', 'PTS'],
                totals: ['240', '120'],
                athletes: [
                  { athlete: { id: '9', displayName: 'Luka Doncic', position: { abbreviation: 'G' } }, starter: true, stats: ['38', '35'] },
                  { athlete: { id: '10', displayName: 'Bench Guy' }, didNotPlay: true, reason: 'COACH\'S DECISION', stats: [] },
                ],
              },
            ],
          },
        ],
      },
    });
    expect(s.game.id).toBe('401');
    expect(s.game.venue).toBe('Crypto.com Arena');
    expect(s.teams[0].labels).toEqual(['MIN', 'PTS']);
    expect(s.teams[0].players[0]).toMatchObject({ name: 'Luka Doncic', starter: true, dnp: false, stats: ['38', '35'] });
    expect(s.teams[0].players[1].dnp).toBe(true);
    expect(s.teams[0].teamStats).toEqual([{ label: 'Rebounds', value: '44' }]);
  });
});

describe('normalizeLeaders', () => {
  it('maps category columns by stat name', () => {
    const t = normalizeLeaders(
      {
        categories: [
          { name: 'general', names: ['gamesPlayed', 'avgRebounds'] },
          { name: 'offensive', names: ['avgPoints'] },
        ],
        athletes: [
          {
            athlete: { id: '1', displayName: 'Shai Gilgeous-Alexander', teamShortName: 'OKC' },
            categories: [
              { name: 'general', totals: ['76', '5.0'] },
              { name: 'offensive', totals: ['32.7'] },
            ],
          },
        ],
      },
      [
        { category: 'general', name: 'gamesPlayed', label: 'GP' },
        { category: 'offensive', name: 'avgPoints', label: 'PTS' },
        { category: 'offensive', name: 'missingStat', label: 'X' },
      ],
    );
    expect(t.columns.map((c) => c.label)).toEqual(['GP', 'PTS']);
    expect(t.rows[0]).toMatchObject({ athlete: 'Shai Gilgeous-Alexander', team: 'OKC' });
    expect(t.rows[0].values['offensive.avgPoints']).toBe('32.7');
  });
});

describe('normalizeGameLog', () => {
  it('joins stat rows to event metadata and splits season types', () => {
    const log = normalizeGameLog({
      labels: ['MIN', 'PTS'],
      events: {
        '2': { gameDate: '2026-01-02T00:00Z', atVs: '@', gameResult: 'L', score: '99-101', opponent: { id: '2', abbreviation: 'BOS' } },
        '1': { gameDate: '2026-01-01T00:00Z', atVs: 'vs', gameResult: 'W', score: '110-100', opponent: { id: '2', abbreviation: 'BOS' } },
        '9': { gameDate: '2026-04-20T00:00Z', atVs: 'vs', gameResult: 'W', score: '1-0', opponent: { id: '2', abbreviation: 'BOS' } },
      },
      seasonTypes: [
        { displayName: '2025-26 Postseason', categories: [{ events: [{ eventId: '9', stats: ['40', '41'] }] }] },
        {
          displayName: '2025-26 Regular Season',
          categories: [{ events: [{ eventId: '2', stats: ['30', '20'] }] }, { events: [{ eventId: '1', stats: ['35', '30'] }] }],
        },
        { displayName: '2025-26 Preseason', categories: [{ events: [{ eventId: '7', stats: ['10', '5'] }] }] },
      ],
    });
    expect(log.games.map((g) => g.gameId)).toEqual(['1', '2', '9']);
    expect(log.games[0]).toMatchObject({ result: 'W', atVs: 'vs', seasonType: 'regular', stats: { MIN: '35', PTS: '30' } });
    expect(log.games[2].seasonType).toBe('playoffs');
  });
});
