# NBA Stats Hub

A web app for following the NBA: fixtures, results, live scores, box scores, standings, team schedules and player leaders.

It opens on the **2025-26 season** because that season is complete. You can switch to 2026-27 (in progress) or 2024-25 with the season picker in the header.

## Features

| Page | What it shows |
| --- | --- |
| **Scores** | Any day's fixtures, live games and results, with your favourite team's game pinned first and a countdown to its next game. Live games refresh every 30s. |
| **Game** | Scoreline, scores by quarter, team stat comparison and full box scores. Player names link to their pages. |
| **Player** | Season averages, a per-game trend chart (points, rebounds, assists, threes, minutes) with a 10-game average, and the full game log. |
| **Standings** | Conference tables with playoff/play-in lines, plus a "games above .500" race chart (highlight up to 3 teams). |
| **Playoffs** | The full bracket with seeds and series scores; expand a series to see its games. |
| **Leaders** | Top 50 per-game leaders, and a *Season highs* tab with the best single games and most triple-doubles. |
| **Rankings** | Every team ranked by any column: record, PPG, points allowed, margin, home/road, close games, best winning run, strength of schedule (played and remaining), shooting %, rebounds, assists, turnovers. |
| **Teams** | Record, margin-by-game and games-above-.500 charts, schedule as a list or month calendar, a ☆ to make it your favourite, and an *Add to calendar* (.ics) download. |
| **H2H** | Pick two teams to see their meetings, head-to-head wins and season numbers side by side. |

Your favourite team and season choice are saved in your browser.

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

Add an entry to `SEASONS` in `src/lib/seasons.ts`. ESPN numbers seasons by the year they end in, so 2027 means 2026-27.
