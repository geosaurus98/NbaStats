import { describe, expect, it } from 'vitest';
import { brefTables } from './brefTables';

describe('Basketball-Reference tables', () => {
  it('reads rows by data-stat, including commented-out tables', () => {
    const html = `<div><!--<table id="coaches"><thead><tr><th data-stat="coach">Coach</th></tr></thead><tbody>
      <tr><th data-stat="coach"><a href="/coaches/daigner01c.html">Mark Daigneault</a></th><td data-stat="team_id"><a href="/teams/OKC/2026.html">OKC</a></td><td data-stat="wins_cur">68</td></tr>
      <tr class="thead"><th data-stat="coach">Coach</th></tr>
      <tr><th data-stat="coach">J.B. Bickerstaff</th><td data-stat="team_id">DET</td><td data-stat="wins_cur">60</td></tr>
    </tbody></table>--></div>`;
    const rows = brefTables(html).get('coaches')!;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ coach: 'Mark Daigneault', coach_href: '/coaches/daigner01c.html', team_id: 'OKC', wins_cur: '68' });
    expect(rows[1].coach).toBe('J.B. Bickerstaff');
  });
});
