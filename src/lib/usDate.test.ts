import { describe, expect, it } from 'vitest';
import { slateLabel, usDate } from './dates';

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;

describe('US game day', () => {
  it('uses the US Eastern date', () => {
    // 1pm Sunday in Auckland is 8pm Saturday in New York.
    expect(usDate(new Date('2026-11-01T00:00:00Z'))).toBe('2026-10-31');
    expect(usDate(new Date('2026-11-01T18:00:00Z'))).toBe('2026-11-01');
  });
  it('labels a slate by the local day when it differs', () => {
    expect(slateLabel('2026-11-01', [])).not.toMatch(/your time/);
    const tz = env.TZ;
    env.TZ = 'Pacific/Auckland';
    // 7pm and 10pm Eastern on Saturday 31 October are Sunday afternoon in New Zealand.
    expect(slateLabel('2026-10-31', ['2026-10-31T23:00Z', '2026-11-01T02:00Z'])).toMatch(/^Sun, Nov 1, 2026 your time · Sat, Oct 31, 2026 in the US$/);
    env.TZ = 'America/New_York';
    expect(slateLabel('2026-10-31', ['2026-10-31T23:00Z', '2026-11-01T02:00Z'])).toBe(slateLabel('2026-10-31', []));
    env.TZ = tz;
  });
});
