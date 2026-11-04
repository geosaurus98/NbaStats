import { describe, expect, it } from 'vitest';
import { parseExecutives, parseFranchiseCoaches, parseSeasonCoaches } from './staff';

// Shapes taken from the live pages (header rows included, as Basketball-Reference sends them).
const td = (stat: string, v: string, href?: string) => `<td data-stat="${stat}">${href ? `<a href="${href}">${v}</a>` : v}</td>`;
const season = `<table id="NBA_coaches"><thead><tr>${td('coach', 'Coach')}${td('team', 'Tm')}</tr></thead><tbody>
<tr>${td('coach', 'Mark Daigneault', '/coaches/daignma99c.html')}${td('team', 'OKC', '/teams/OKC/2027.html')}${td('seas_num_franch', '6')}${td('seas_num_overall', '6')}${td('cur_w', '6')}${td('cur_l', '1')}${td('fr_w', '300')}${td('fr_l', '180')}${td('car_w', '300')}${td('car_l', '180')}${td('fr_w_p', '24')}${td('fr_l_p', '12')}${td('car_w_p', '24')}${td('car_l_p', '12')}</tr>
<tr>${td('coach', 'Old Coach', '/coaches/oldco01c.html')}${td('team', 'BOS')}${td('cur_w', '1')}${td('cur_l', '3')}</tr>
<tr>${td('coach', 'New Coach', '/coaches/newco01c.html')}${td('team', 'BOS')}${td('cur_w', '2')}${td('cur_l', '0')}</tr>
</tbody></table>`;

describe('staff pages', () => {
  it('reads this season’s coaches, keeping the latest for a team that changed', () => {
    const c = parseSeasonCoaches(season);
    expect(c).toHaveLength(2);
    expect(c[0]).toMatchObject({ team: 'OKC', name: 'Mark Daigneault', bref: 'daignma99c', seasonsWithTeam: 6, season: [6, 1], career: [300, 180], playoffsCareer: [24, 12] });
    expect(c.find((x) => x.team === 'BOS')?.name).toBe('New Coach');
  });
  it('reads franchise coaching history and executives', () => {
    const coaches = parseFranchiseCoaches(`<table id="coaches"><tbody><tr>${td('ranker', 'Rk')}${td('coach', 'Coach')}</tr><tr>${td('coach', 'Al Bianchi', '/coaches/biancal01c.html')}${td('year_min', '1968')}${td('year_max', '1969')}${td('wins', '53')}${td('losses', '111')}${td('wins_playoffs', '')}${td('years_league_champion', '')}</tr></tbody></table>`);
    expect(coaches).toEqual([{ name: 'Al Bianchi', bref: 'biancal01c', from: 1968, to: 1969, record: [53, 111], playoffs: [0, 0], conferenceTitles: 0, titles: 0 }]);
    const ex = parseExecutives(`<table id="executives"><tbody><tr>${td('exec', 'Executive')}</tr><tr>${td('exec', 'Don Richman', '/executives/richmdo99x.html')}${td('date_start', '1967')}${td('date_end', '1968-05-09')}${td('notes', '')}</tr></tbody></table>`);
    expect(ex).toEqual([{ name: 'Don Richman', bref: 'richmdo99x', start: '1967', end: '1968-05-09', notes: '' }]);
  });
});
