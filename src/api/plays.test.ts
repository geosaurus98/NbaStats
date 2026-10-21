import { describe, expect, it } from 'vitest';
import { aggregateAssists, elapsedSeconds, normalizePlays } from './normalize';

const play = (o: Record<string, unknown>) => ({
  period: { number: 1 },
  clock: { displayValue: '10:00' },
  homeScore: 0,
  awayScore: 0,
  team: { id: '14' },
  participants: [],
  ...o,
});

describe('elapsedSeconds', () => {
  it('converts period + clock to time since tip-off', () => {
    expect(elapsedSeconds(1, '12:00')).toBe(0);
    expect(elapsedSeconds(2, '6:00')).toBe(720 + 360);
    expect(elapsedSeconds(4, '0.0')).toBe(2880);
    expect(elapsedSeconds(5, '2:30')).toBe(2880 + 150);
  });
});

describe('normalizePlays', () => {
  const raw = {
    plays: [
      play({ id: '1', type: { text: 'Jumpball' }, coordinate: { x: -214748340, y: -214748365 } }),
      play({
        id: '2',
        text: 'Bam Adebayo makes 24-foot three point jumper (Davion Mitchell assists)',
        scoringPlay: true,
        shootingPlay: true,
        scoreValue: 3,
        pointsAttempted: 3,
        homeScore: 3,
        participants: [{ athlete: { id: 'bam' } }, { athlete: { id: 'davion' } }],
        coordinate: { x: 3, y: 11 },
        type: { text: 'Jump Shot' },
      }),
      play({ id: '3', text: 'Alex Sarr misses 11-foot two point shot', shootingPlay: true, homeScore: 3, team: { id: '27' }, participants: [{ athlete: { id: 'sarr' } }], coordinate: { x: 15, y: 6 }, pointsAttempted: 2, type: { text: 'Jump Shot' } }),
      play({ id: '4', text: 'Bam Adebayo makes free throw 1 of 1', scoringPlay: true, shootingPlay: true, scoreValue: 1, homeScore: 4, participants: [{ athlete: { id: 'bam' } }], coordinate: { x: 25, y: 19 }, type: { text: 'Free Throw - 1 of 1' } }),
    ],
    winprobability: [{ playId: '2', homeWinPercentage: 0.6 }],
  };
  const pbp = normalizePlays(raw);

  it('records passer and scorer for assisted baskets only', () => {
    expect(pbp.assists).toEqual([{ teamId: '14', scorerId: 'bam', passerId: 'davion', points: 3 }]);
  });

  it('keeps field-goal attempts with valid coordinates, skipping free throws', () => {
    expect(pbp.shots.map((s) => [s.athleteId, s.made, s.value])).toEqual([
      ['bam', true, 3],
      ['sarr', false, 2],
    ]);
    // ESPN's y is measured from the hoop; ours from the baseline (hoop at 5.25 ft).
    expect(pbp.shots[0]).toMatchObject({ x: 3, y: 16.25 });
  });

  it('tracks score changes and win probability', () => {
    expect(pbp.flow.map((f) => [f.home, f.away])).toEqual([[0, 0], [3, 0], [4, 0]]);
    expect(pbp.flow[1].homeWin).toBe(0.6);
  });
});

describe('aggregateAssists', () => {
  it('totals passer → scorer pairs per team, most frequent first', () => {
    const out = aggregateAssists(
      [
        { teamId: 'T', passerId: 'a', scorerId: 'b', points: 2 },
        { teamId: 'T', passerId: 'a', scorerId: 'b', points: 3 },
        { teamId: 'T', passerId: 'b', scorerId: 'a', points: 2 },
        { teamId: 'U', passerId: 'x', scorerId: 'y', points: 2 },
      ],
      { a: 'A', b: 'B' },
    );
    expect(out.T.pairs).toEqual([
      ['a', 'b', 2, 5],
      ['b', 'a', 1, 2],
    ]);
    expect(out.T.players).toEqual([['a', 'A'], ['b', 'B']]);
    expect(out.U.players).toEqual([['x', 'x'], ['y', 'y']]);
  });
});
