// What's on this site: a short tour of every page and a plain-English
// glossary of the stats it uses.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { InstallButton } from '../components/AppStatus';

const PAGES: { to: string; name: string; what: string }[] = [
  { to: '/', name: 'Home', what: "Today's games, your team, last night in brief, the standings, title odds, the awards race and on this day." },
  { to: '/scores', name: 'Scores', what: 'Any day\'s games. Open one for the box score, charts, play-by-play and (after the final) a shareable recap card; before tip-off, a preview with a projected score. Before tip-off: projected box scores and tonight\'s likeliest 30-point games, double-doubles and triple-doubles.' },
  { to: '/myteam', name: 'My team', what: 'Everything about the team you star: next game, form, odds, injuries and payroll.' },
  { to: '/recap', name: 'This week', what: 'A Monday-to-Sunday round-up: team and player of the week, best performances, new season highs, standings movers and upsets.' },
  { to: '/standings', name: 'Standings', what: 'Conference tables, the race chart (games above .500), seed by week and the NBA Cup groups and knockout bracket.' },
  { to: '/playoffs', name: 'Playoffs', what: 'The bracket with series odds after every game, series leaders and a bracket challenge; before the playoffs, the projected first round and play-in odds.' },
  { to: '/projections', name: 'Projections', what: 'Playoff and title odds from 2,000 simulated seasons, power ratings, what-if standings and an injury what-if (sit or bring back players and see the odds move).' },
  { to: '/leaders', name: 'Leaders', what: 'Season averages and highs, streaks, milestone watch, advanced stats (PER, Win Shares), win probability added, on/off, shot quality and a build-your-own ranking.' },
  { to: '/awards', name: 'Awards', what: 'MVP, Defensive Player and Rookie of the Year ladders, win odds while the season is on, the rookie ladder, and every past winner and MVP vote. Also All-NBA, All-Defensive and All-Rookie team predictions.' },
  { to: '/rankings', name: 'Rankings', what: 'Every team ranked: SRS, four factors, luck, quarter splits, scoring runs, garbage time, rest & travel, team styles, points by source and schedule ahead.' },
  { to: '/insights', name: 'Insights', what: 'Exciting games, player of the night, hot & cold, clutch, shooting (zones, shot types, hot hand, situations) and players (usage, archetypes, duos).' },
  { to: '/fantasy', name: 'Fantasy', what: 'Fantasy points in ESPN, Yahoo and DraftKings scoring or nine-category value, hot pickups and games per team this week and next.' },
  { to: '/teams', name: 'Teams', what: 'Each team in tabs: overview (results, Elo, style, injuries), lineups & rotation, shooting & passing, schedule and payroll, plus a printable season report.' },
  { to: '/salaries', name: 'Salaries', what: 'Payrolls against the cap, tax and aprons, salary vs production and Win Shares per $10M.' },
  { to: '/draft', name: 'Draft hub', what: "This year's projected order and lottery odds (the new 3-2-1 lottery from 2027), draft classes graded against their slots, which franchises draft best, every draft class since 1947 and every lottery since 1985. A lottery race shows No. 1 pick odds week by week and who is near relegation." },
  { to: '/trade', name: 'Trade machine', what: 'Two or three teams, players and draft picks: does the salary match under the aprons, every payroll afterwards, the Win Shares that move and each team\'s title odds after the trade.' },
  { to: '/coaches', name: 'Coaches & front offices', what: "Every team's head coach (this season, with the team and career) and front office; each franchise page has its full coaching history and every executive's draft record." },
  { to: '/compare', name: 'Compare', what: 'Up to three current players side by side, with a full report (advanced stats, shot diet, archetype, contract value), their shot maps and how they have done head-to-head.' },
  { to: '/history', name: 'History', what: 'Every season since 1946-47: careers, comparisons across eras, Hall of Fame odds, all-time leaders, greatest teams, roster continuity and on this date.' },
  { to: '/degrees', name: '6 Degrees', what: 'How any two players connect through teammates.' },
  { to: '/games', name: 'Games', what: 'Daily puzzles: the franchise grid, connect the players, guess the player, stat-line and trivia.' },
  { to: '/alerts', name: 'Alerts', what: 'What happened to your team and the players you follow since your last visit, plus optional notifications when your team tips off, is in a close finish, or finishes.' },
];

const GLOSSARY: { term: string; what: string }[] = [
  { term: 'eFG% (effective field-goal %)', what: 'Field-goal percentage with threes counted as 1.5 makes, since they are worth 50% more.' },
  { term: 'TS% (true shooting)', what: 'Scoring efficiency including free throws: points ÷ (2 × (FGA + 0.44 × FTA)).' },
  { term: 'Usage (USG%)', what: 'Share of a team\'s plays a player finishes (shot, free throws or turnover) while on court. 20% is average for five players.' },
  { term: 'Offensive / defensive rating (ORtg, DRtg)', what: 'Points scored / allowed per 100 possessions. Net rating is the difference.' },
  { term: 'Pace', what: 'Possessions per 48 minutes.' },
  { term: 'Four factors', what: "Dean Oliver's four things that decide games: shooting (eFG%), turnovers (TOV%), offensive rebounding (ORB%) and getting to the line (FT rate), roughly weighted 40/25/20/15." },
  { term: 'SRS (Simple Rating System)', what: 'Average margin of victory adjusted for the strength of the opponents played. 0 is an average team.' },
  { term: 'MOV / SOS', what: 'Margin of victory (average points ahead) and strength of schedule (the average SRS of opponents).' },
  { term: 'Pythagorean wins / luck', what: 'The record a team "should" have from its points scored and allowed. Wins above that usually come from close games and opponents missing shots, which rarely lasts.' },
  { term: 'Elo', what: 'A rating that goes up when a team wins and down when it loses, more for surprising results. Used for game predictions and the season simulations.' },
  { term: 'Game Score', what: "John Hollinger's one-number rating of a single game: points plus weighted rebounds, assists, steals and blocks, minus misses, turnovers and fouls. 10 is an average game, 40 a monster one." },
  { term: 'PER (Player Efficiency Rating)', what: "Hollinger's per-minute box-score production, adjusted for pace and scaled so the league average is 15." },
  { term: 'Win Shares (WS, WS/48)', what: "Basketball-Reference's estimate of the wins a player's offence and defence produced. WS/48 is per 48 minutes; .100 is average." },
  { term: 'On/off', what: "How a team's point margin changes with a player on the floor versus on the bench. Captures things the box score misses, but also who they play alongside." },
  { term: 'Win probability added (WPA)', what: "Each play moves ESPN's chance of winning; the players involved get the credit or blame. Totals are in wins." },
  { term: 'Clutch time', what: 'The last five minutes of the fourth quarter or overtime with the score within five points.' },
  { term: 'Garbage time', what: "Cleaning the Glass's rule: the fourth quarter once a game is out of reach (25+ points with 9+ minutes left, 20+ with 6-9, 10+ in the last 6) and no more than two starters on the floor." },
  { term: 'Shot quality', what: 'The eFG% an average shooter would get from a player\'s shot locations. Shot making is how far above or below that they actually shoot.' },
  { term: 'Hot hand', what: 'Shooting right after a make against right after a miss, allowing for tougher shots taken after makes.' },
  { term: 'Archetypes', what: 'Eight playing styles (shot creator, playmaker, slasher, shooter, 3-and-D wing, stretch big, rim-running big, rim protector) assigned from each player\'s statistical profile.' },
  { term: 'Era adjustment', what: 'Per-game numbers rescaled to another season\'s pace (and, for points, scoring efficiency) so different eras compare fairly.' },
  { term: 'Fantasy 9-category', what: 'The usual head-to-head categories (points, rebounds, assists, steals, blocks, threes, FG%, FT%, turnovers), each scored against the league and added up.' },
];

export function Guide() {
  const [q, setQ] = useState('');
  const match = (s: string) => s.toLowerCase().includes(q.toLowerCase());
  const glossary = GLOSSARY.filter((g) => !q || match(g.term) || match(g.what));
  return (
    <section className="guide">
      <h1>What's on this site</h1>
      <h2 className="sr-only">Pages</h2>
      <p className="muted">A quick tour of every page and what the numbers mean. Data comes from ESPN (live) and Basketball-Reference (history and salaries), refreshed every day. Search (top of the page, or press /) finds any player, team or page.</p>
      <div className="guide-grid">
        {PAGES.map((p) => (
          <Link key={p.to} to={p.to} className="card guide-card">
            <h3>{p.name}</h3>
            <p className="small">{p.what}</p>
          </Link>
        ))}
      </div>
      <h2>Stats explained</h2>
      <input className="guide-search" type="search" placeholder="Filter terms…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter the glossary" />
      <dl className="glossary">
        {glossary.map((g) => (
          <div key={g.term}>
            <dt>{g.term}</dt>
            <dd>{g.what}</dd>
          </div>
        ))}
      </dl>
      <h2>Using it on your phone</h2>
      <p className="small">Open the site in your phone's browser and choose <b>Add to Home Screen</b> (Safari: the share button; Chrome: the ⋮ menu). It then opens like an app and keeps the last data it loaded for when you're offline.</p>
      <InstallButton />
      <h2>Is the data up to date?</h2>
      <p className="small">The <Link to="/status">data health</Link> page shows when each season was last refreshed, how complete it is and how the daily data job has been doing.</p>
    </section>
  );
}
