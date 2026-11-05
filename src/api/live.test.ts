import { afterEach, describe, expect, it, vi } from 'vitest';

describe('ESPN reachability', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });
  it('keeps trying after one refused request, and stops after two in a row', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', (url: string) => {
      calls.push(url);
      return Promise.reject(new TypeError('Failed to fetch'));
    });
    const live = await import('./live');
    await expect(live.fetchScoreboard('2026-11-01')).rejects.toMatchObject({ kind: 'network' });
    await expect(live.fetchScoreboard('2026-11-02')).rejects.toMatchObject({ kind: 'network' });
    // Two refusals in a row: the third request isn't even tried.
    await expect(live.fetchScoreboard('2026-11-03')).rejects.toMatchObject({ kind: 'network' });
    expect(calls.length).toBe(2);
  });
  it('resets the count after a request gets through', async () => {
    let n = 0;
    vi.stubGlobal('fetch', () => (++n === 2 ? Promise.resolve(new Response('{"events":[]}', { status: 200 })) : Promise.reject(new TypeError('Failed to fetch'))));
    const live = await import('./live');
    await expect(live.fetchScoreboard('2026-11-01')).rejects.toMatchObject({ kind: 'network' });
    await live.fetchScoreboard('2026-11-02');
    await expect(live.fetchScoreboard('2026-11-03')).rejects.toMatchObject({ kind: 'network' });
    await expect(live.fetchScoreboard('2026-11-04')).rejects.toMatchObject({ kind: 'network' });
    expect(n).toBe(4);
  });
});
