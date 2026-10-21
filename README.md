# NBA Stats Hub

A web app for following the NBA: fixtures, results, live scores, box scores, standings, team schedules and player leaders.

It opens on the **2025-26 season** because that season is complete. You can switch to 2026-27 (in progress) or 2024-25 with the season picker in the header.

## Features

| Page | What it shows |
| --- | --- |
| **Scores** | Any day's fixtures, live games and results, with your favourite team's game pinned first and a countdown to its next game. Live games refresh every 30s. |
| **Game** | A live play-by-play feed and 30-second refresh during games (and a "Live now" bar on every page), scoreline, scores by quarter, team stat comparison, a game-flow (lead) chart, win probability, each team's assist network, a shot chart with paint / mid-range / 3PT splits, and full box scores. |
| **Player** | Season averages, a per-game trend chart (points, rebounds, assists, threes, minutes) with a 10-game average, passing partners (who they assist and who assists them), a season shot map for high-volume shooters, and the full game log. |
| **Projections** | *Playoff odds*: every team's chances to make the playoffs, conference finals, Finals and title, from 2,000 simulations of the rest of the season (incl. play-in and every series), plus how those odds moved week by week. *Power ratings*: Elo ratings through the season, a power ranking, the model's picks for upcoming games, its accuracy and the biggest upsets. |
| **Standings** | Conference tables with playoff/play-in lines, plus a "games above .500" race chart (highlight up to 3 teams). |
| **Playoffs** | The full bracket with seeds and series scores; expand a series to see its games. |
| **Leaders** | Top 50 per-game leaders, and a *Season highs* tab with the best single games and most triple-doubles. |
| **Rankings** | Every team ranked by any column: record, PPG, points allowed, margin, home/road, close games, best winning run, strength of schedule (played and remaining), shooting %, rebounds, assists, turnovers. |
| **Teams** | Record, margin-by-game and games-above-.500 charts, a season *who assists whom* network plus passer × scorer grid, a season shot map (frequency and FG% vs league by spot), schedule as a list or month calendar, a ☆ to make it your favourite, and an *Add to calendar* (.ics) download. |
| **Compare** | Up to three players side by side: per-game averages (best highlighted), rolling-average trend lines and their season shot maps. |
| **H2H** | Pick two teams to see their meetings, head-to-head wins and season numbers side by side. |
| **Insights** | *Most exciting games*: every game ranked by win-probability swings, comebacks, lead changes and late drama, with a scatter of the whole season. *Passing duos*: the league's top passer → scorer pairs and a passing-style chart (ball movement vs one-man show). |
| **History** | All-time rosters and stats: a chord diagram of players moving between teams (by era), career journeys with season-by-season stats, honours and career arcs, the journeymen leaderboard, a two-player compare, all-time leaders (totals, per game, best seasons), awards history (MVP voting by season, winners, All-Star selections) and a roster-continuity heatmap. |
| **Games** | *Played for both*: a daily 3×3 franchise grid puzzle. *Connect the players*: link two players teammate by teammate. *Guess the player*: name a player from their career path. *Higher or lower*: who had more of a career stat? |
| **6 Degrees** | The Kevin Bacon game for the NBA: every player since 1946-47, linked by having been teammates. Pick a centre player to see all 5,400+ players arranged in rings by teammate distance (and around the circle by era), connect any two players by the shortest chain of teammates, and see history's best-connected players. |

Search (🔍 in the header, or press `/`) finds any team, page or player from any era: current players open their player page, older ones their career timeline.

Your favourite team and season choice are saved in your browser.

## Data

All data comes from ESPN's public NBA API (no key needed). Parsing is in `src/api/normalize.ts`.

**Completed seasons are bundled with the app.** Loading a whole season live from a browser means about 45 MB of team schedules plus about 100 MB of player game logs for season highs. So the **Season snapshot** GitHub Action (`.github/workflows/snapshot.yml` → `scripts/snapshot.ts`) fetches 2025-26 and 2024-25 once and saves a compact copy in `src/data/season-*.json`. Standings, playoffs, rankings, leaders, season highs, team schedules and H2H for those seasons load instantly, even offline. The snapshot also totals every game's play-by-play into passer → scorer assist pairs, binned shot locations (teams, the league and the top 75 shooters) and a "drama" row per game. Box scores, player pages and per-day top scorers are still fetched live. To refresh the copies, run the workflow from the **Actions** tab.

The season in progress is snapshotted too, and refreshed daily by a scheduled run of the workflow (GitHub only runs schedules on the default branch, so this starts once the code is on `main`). For that season, standings, single-team schedules and leaders are still fetched live; the snapshot only powers the heavy league-wide views.

**Career stats and awards.** `scripts/careers.ts` builds `src/data/careers.json` (every player's season totals, award voting and All-Star selections, about 1.6 MB) from the same source. The hosted site loads it only on pages that need it.

**Teammate graph.** `scripts/teammates.ts` builds `src/data/teammates.json` (every team-season roster since 1946-47, about 330 KB) from Basketball-Reference data via the open [bball-reference-datasets](https://github.com/sumitrodatta/bball-reference-datasets) project. ESPN has no historical rosters. The snapshot workflow refreshes it too.

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
