# NBA Stats Hub

A web app for following the NBA: fixtures, results, live scores, box scores, standings, team schedules and player leaders.

It opens on the **2026-27 season**, which is in progress. You can switch to the completed 2025-26 and 2024-25 seasons with the season picker in the header.

## Features

| Page | What it shows |
| --- | --- |
| **Home** | A dashboard: today's games (or the season's last day), your team's next game, the top six in each conference, title odds (or the champion once a season is over), last night's best player, the scoring and awards races, and today's puzzles with your progress. |
| **My team** | Your favourite team in one place: countdown to the next game, record and seed, projected wins, playoff/title odds (and No. 1 pick odds if they're in the lottery), last-10 form, the model's pick for each of the next five games, the schedule ahead, leaders, the injury report, this season against last season game by game, and every result. |
| **Scores** | Any day's fixtures, live games and results, with your favourite team's game pinned first and a countdown to its next game. Live games refresh every 30s. |
| **Game** | Before tip-off, a preview: the model's pick and margin, both teams' form, leaders and injuries, and this season's meetings. During and after, a live play-by-play feed and 30-second refresh during games (and a "Live now" bar on every page), scoreline, scores by quarter, team stat comparison, a game-flow (lead) chart, win probability, each team's assist network, a shot chart with paint / mid-range / 3PT splits, and full box scores. |
| **Player** | A season card (averages and league percentiles) you can save as an image or share, season averages, a per-game trend chart (points, rebounds, assists, threes, minutes) with a 10-game average, passing partners (who they assist and who assists them), a season shot map for high-volume shooters, and the full game log. |
| **Awards** | A live MVP, Defensive Player of the Year and Rookie of the Year race from a simple, explained model (box-score production, team record, plus-minus and on/off; steals, blocks and team defence for DPOY), with the 65-game rule pro-rated during the season. For 2024-25 the real voting sits alongside: the model had the right MVP and Rookie of the Year. A chart shows how the race moved week by week. |
| **Projections** | *Playoff odds*: every team's chances to make the playoffs, conference finals, Finals and title, from 2,000 simulations of the rest of the season (incl. play-in and every series), plus how those odds moved week by week. *Power ratings*: Elo ratings through the season, a power ranking, the model's picks for upcoming games, its accuracy and the biggest upsets. *Draft lottery* (Tankathon-style): the 14 lottery teams from current standings or projected final records, each team's exact odds for every pick, and a button to run the lottery. *What if*: pick winners for the next 7/14/30 days and watch seeding, play-in and lottery places change. |
| **Standings** | Conference tables with playoff/play-in lines, plus a "games above .500" race chart (highlight up to 3 teams). |
| **Playoffs** | The full bracket with seeds and series scores; expand a series to see its games. |
| **Leaders** | Top 50 per-game leaders, a *Season highs* tab with the best single games and most triple-doubles, and *Milestone watch*: active players about to reach a round-number career total or pass someone on an all-time list, with how many games it should take. |
| **Rankings** | Every team ranked by any column: record, PPG, points allowed, margin, home/road, close games, best winning run, strength of schedule (played and remaining), shooting %, rebounds, assists, turnovers. |
| **Teams** | Record, this season against last season game by game, the injury report, margin-by-game and games-above-.500 charts, a season *who assists whom* network plus passer × scorer grid, a season shot map (frequency and FG% vs league by spot), *lineups & on/off* (most-used five-man units with +/- per 48, and each player's on/off swing, inferred from play-by-play substitutions), schedule as a list or month calendar, a ☆ to make it your favourite, and an *Add to calendar* (.ics) download. |
| **Compare** | Up to three players side by side: per-game averages (best highlighted), rolling-average trend lines and their season shot maps. |
| **H2H** | Pick two teams to see their meetings, head-to-head wins and season numbers side by side. |
| **Insights** | *Player of the night* (each night's best game by Game Score, plus the season's best). *Hot & cold* (players and teams over their last 5/10/15 games vs the season). *Clutch* (last five minutes, within five points: scoring, shooting and team records). *Duos & trios* (best and worst two- and three-man combinations per 48 minutes). *Shooting zones* (best and most frequent shooters at the rim, mid-range, corner and above-the-break threes). *Schedule ahead* (remaining opponent strength, back-to-backs and road trips from any date). *Most exciting games*: every game ranked by win-probability swings, comebacks, lead changes and late drama, with a scatter of the whole season. *Passing duos*: the league's top passer → scorer pairs and a passing-style chart (ball movement vs one-man show). |
| **History** | All-time rosters and stats: a chord diagram of players moving between teams (by era), career journeys with season-by-season stats, honours and career arcs, the journeymen leaderboard, a two-player compare, all-time leaders (totals, per game, best seasons), awards history (MVP voting by season, winners, All-Star selections), *greatest teams* (every team-season ranked by SRS, by era), *similar players* (the closest era-adjusted seasons since 1979-80 to any player-season), *team vs team* (any two franchise seasons side by side, e.g. the 1995-96 Bulls and 2016-17 Warriors, with ratings, shooting and pace against each season's league average, top scorers, and the odds if they met, from each team's SRS), *draft history* (every NBA/BAA draft class, a redraft of any class by career production, the best player taken at each pick, late-pick steals and every No. 1 pick, filterable by team) and a roster-continuity heatmap. |
| **Franchise** | Each franchise's whole history: names and eras, titles, all-time record, a win %-above-.500 bar for every season, franchise leaders (counting only seasons with that team, traded seasons split correctly), its best draft picks and a season-by-season table with SRS, offensive/defensive rating, pace and attendance. Also an all-time starting five (one per position) with a bench. Open it from any team page. |
| **Games** | *Played for both*: a daily 3×3 franchise grid puzzle. *Connect the players*: link two players teammate by teammate. *Guess the player*: name a player from their career path. *Trivia*: five daily questions (a champion, a scoring leader, an MVP, a No. 1 pick, a win total). *Who am I?*: guess the player from one season's stat line. *Higher or lower*: who had more of a career stat? |
| **6 Degrees** | The Kevin Bacon game for the NBA: every player since 1946-47, linked by having been teammates. Pick a centre player to see all 5,400+ players arranged in rings by teammate distance (and around the circle by era), connect any two players by the shortest chain of teammates, and see history's best-connected players. |

Search (🔍 in the header, or press `/`) finds any team, page or player from any era: current players open their player page, older ones their career timeline.

Your favourite team and season choice are saved in your browser.

The header has a 🔗 share button (copies a link to the page you're on, or opens your phone's share sheet) and a light/dark switch (auto follows your system; light and dark are remembered). The puzzle games also share a spoiler-free result, Wordle-style.

## Data

All data comes from ESPN's public NBA API (no key needed). Parsing is in `src/api/normalize.ts`.

**Completed seasons are bundled with the app.** Loading a whole season live from a browser means about 45 MB of team schedules plus about 100 MB of player game logs for season highs. So the **Season snapshot** GitHub Action (`.github/workflows/snapshot.yml` → `scripts/snapshot.ts`) fetches 2025-26 and 2024-25 once and saves a compact copy in `src/data/season-*.json`. Standings, playoffs, rankings, leaders, season highs, team schedules and H2H for those seasons load instantly, even offline. The snapshot also totals every game's play-by-play into passer → scorer assist pairs, binned shot locations (teams, the league and the top 75 shooters), a "drama" row per game, lineups and on/off, clutch-time totals, two- and three-man combinations, and every player's season box-score totals (which drive the awards race; first-year players are found by matching names against Basketball-Reference). Box scores, player pages and per-day top scorers are still fetched live. To refresh the copies, run the workflow from the **Actions** tab.

The season in progress is snapshotted too, and refreshed daily by a scheduled run of the workflow (GitHub only runs schedules on the default branch, so this starts once the code is on `main`). For that season, standings, single-team schedules and leaders are still fetched live; the snapshot only powers the heavy league-wide views.

**Career stats and awards.** `scripts/careers.ts` builds `src/data/careers.json` (every player's season totals, award voting and All-Star selections, about 1.6 MB) from the same source. The hosted site loads it only on pages that need it.

**Per-game lines.** The snapshot job also writes `src/data/lines-<year>.json`: every player's line in every game (about 1.3 MB per season), loaded only by Player of the night, Hot & cold and the awards timeline.

**Injuries.** The site reads ESPN's league injury report live; the snapshot keeps a copy for when ESPN can't be reached.

**On this day.** `scripts/careers.ts` also writes `src/data/onthisday.json`: for each calendar day, the most notable players born or debuting on it (from Basketball-Reference's career info), shown on the home page with the top scorer from a year ago.

**Franchises and drafts.** `scripts/franchises.ts` builds `src/data/franchises.json` (every team-season's record, playoffs, ratings, four factors and top five scorers, league averages, and every draft pick, about 830 KB). Titles are listed in `src/lib/franchiseData.ts`.

**Loading.** The hosted site loads only what a page needs: the app itself is about 150 KB (gzipped), each season's snapshot about 250 KB, and the history files load only on the pages that use them. The standalone file still bundles everything.

**Teammate graph.** `scripts/teammates.ts` builds `src/data/teammates.json` (every team-season roster since 1946-47, about 330 KB) from Basketball-Reference data via the open [bball-reference-datasets](https://github.com/sumitrodatta/bball-reference-datasets) project. ESPN has no historical rosters. Until Basketball-Reference adds the season in progress, its rosters come from our ESPN box scores (everyone who has played a game for each team): returning players are matched by name, first-year players are added. The snapshot workflow rebuilds it, with `careers.json` and `franchises.json`, every day.

## Quick start (no install)

Download `standalone/NBA-Stats-Hub.html` and double-click it. It opens in your browser and needs no Node.js or other install. An internet connection is required for the data.

After changing the code, run `npm run build:standalone` to rebuild that file.

## Development

Requires [Node.js](https://nodejs.org) (LTS).

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests for the API normalisers
npm run build    # production build in dist/
```

## Deployment

`.github/workflows/deploy.yml` runs the tests and build on every push and PR. On `main` it publishes `dist/` to GitHub Pages. To turn it on, open **Settings → Pages** and set the source to **GitHub Actions**.

## Adding a season

Add an entry to `SEASONS` in `src/lib/seasons.ts`. ESPN numbers seasons by the year they end in, so 2027 means 2026-27. Once a season finishes, add its year to the snapshot workflow's default `seasons` input and run it.
