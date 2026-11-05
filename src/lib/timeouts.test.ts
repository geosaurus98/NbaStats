import { describe, expect, it } from 'vitest';
import { after, isTeamTimeout, runMoments, TimeoutAccumulator, type TimeoutPlay } from './timeouts';

const p = (t: number, home: number, away: number, text = 'shot', teamId = ''): TimeoutPlay => ({ t, home, away, text, teamId });

describe('timeouts', () => {
  it('tells team timeouts from official ones', () => {
    expect(isTeamTimeout({ text: 'Celtics Full Timeout', teamId: 'H' })).toBe(true);
    expect(isTeamTimeout({ text: 'Official timeout', teamId: 'H' })).toBe(false);
    expect(isTeamTimeout({ text: 'Timeout', teamId: '' })).toBe(false);
  });
  it('finds timeouts called during a run and what followed', () => {
    // Away goes on a 9-0 run; home calls time, then scores 4 and concedes 2 in the next two minutes.
    const feed = [p(0, 2, 0), p(10, 2, 3), p(20, 2, 6), p(30, 2, 9), p(35, 2, 9, 'Home Full Timeout', 'H'), p(60, 4, 9), p(90, 4, 11), p(120, 6, 11), p(400, 6, 14)];
    const { moments, timeouts } = runMoments(feed, 'H', 'A');
    expect(timeouts).toEqual({ H: 1, A: 0 });
    expect(moments).toEqual([{ team: 'H', i: 4, timeout: true }]);
    expect(after(feed, moments[0], 'H')).toEqual({ net: 2, stopped: true });
  });
  it('counts runs with no timeout once 30 seconds pass', () => {
    const feed = [p(0, 0, 0), p(10, 0, 4), p(20, 0, 8), p(70, 0, 10), p(100, 2, 10)];
    const acc = new TimeoutAccumulator();
    acc.add(feed, 'H', 'A');
    // H: 1 game, no timeouts; one run without a timeout, from t=20: then 2-2 over two minutes, A scored next.
    expect(acc.result().teams.H).toEqual([1, 0, 0, 0, 0, 1, 0, 0]);
  });
});
