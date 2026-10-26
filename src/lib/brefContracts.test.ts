import { describe, expect, it } from 'vitest';
import { parseBrefContracts } from './brefContracts';

// Rows exactly as Basketball-Reference serves them (from the Memphis payroll page).
const html = `<table class="sortable stats_table" id="contracts" data-cols-to-freeze=",1">
<caption>Payroll Table</caption><thead><tr><th>Player</th></tr></thead>
<tbody><tr ><th scope="row" class="left " data-stat="player" csk="grantje01" ><a href='/players/g/grantje01.html'>Jerami Grant</a></th><td class="center " data-stat="age_today" >32</td><td class="right " data-stat="y1" csk="34206898" >$34,206,898</td><td class="right salary-pl" data-stat="y2" csk="36413790" >$36,413,790</td><td class="right iz" data-stat="y3" ></td><td class="right iz" data-stat="y4" ></td><td class="right iz" data-stat="y5" ></td><td class="right iz" data-stat="y6" ></td><td class="right " data-stat="remain_gtd" csk="34206898" >$34,206,898</td></tr>
<tr ><th scope="row" class="left " data-stat="player" csk="postqu01" ><a href='/players/p/postqu01.html'>Quinten Post</a></th><td class="center " data-stat="age_today" >26</td><td class="right " data-stat="y1" csk="8285714" >$8,285,714</td><td class="right " data-stat="y2" csk="8700000" ><em>$8,700,000</em></td><td class="right " data-stat="y3" csk="9114286" ><em>$9,114,286</em></td><td class="right iz" data-stat="y4" ></td><td class="right iz" data-stat="y5" ></td><td class="right iz" data-stat="y6" ></td><td class="right " data-stat="remain_gtd" csk="8285714" >$8,285,714</td></tr>
<tr ><th scope="row" class="left " data-stat="player" csk="edeyza01" ><a href='/players/e/edeyza01.html'>Zach Edey</a></th><td class="center " data-stat="age_today" >24</td><td class="right salary-tm" data-stat="y1" csk="6332760" >$6,332,760</td><td class="right salary-tm" data-stat="y2" csk="8067937" >$8,067,937</td><td class="right iz" data-stat="y3" ></td><td class="right iz" data-stat="y4" ></td><td class="right iz" data-stat="y5" ></td><td class="right iz" data-stat="y6" ></td><td class="right " data-stat="remain_gtd" csk="14400697" >$14,400,697</td></tr>
</tbody><tfoot><tr><th>Team Totals</th></tr></tfoot></table>`;

describe('parseBrefContracts', () => {
  const rows = parseBrefContracts(html);
  it('reads every player row', () => {
    expect(rows.map((r) => r.name)).toEqual(['Jerami Grant', 'Quinten Post', 'Zach Edey']);
    expect(rows[0]).toEqual({ bref: 'grantje01', name: 'Jerami Grant', age: 32, salaries: [34206898, 36413790, null, null, null, null], flags: ['', 'player-option', '', '', '', ''], guaranteed: 34206898 });
  });
  it('marks non-guaranteed years and team options', () => {
    expect(rows[1].flags.slice(0, 3)).toEqual(['', 'non-guaranteed', 'non-guaranteed']);
    expect(rows[2].flags.slice(0, 2)).toEqual(['team-option', 'team-option']);
  });
  it('copes with a page without the table', () => {
    expect(parseBrefContracts('<html>nothing</html>')).toEqual([]);
  });
});
