# NBA Stats Hub

A web app for following the NBA: fixtures, results, live scores, box scores, standings, team schedules and player leaders.

It opens on the **2025-26 season** because that season is complete. You can switch to 2026-27 (in progress) or 2024-25 with the season picker in the header.

## Features

| Page | What it shows |
| --- | --- |
| **Scores** | Any day's fixtures, live games and results. Step through dates or jump to opening night / the last regular-season day. Live games refresh every 30s. |
| **Game** | Scoreline, scores by quarter, team stat comparison, and full player box scores for both teams. |
| **Standings** | East and West tables: W-L, PCT, GB, home/road, last 10, streak, PPG and points allowed. Lines mark the playoff and play-in cut-offs. |
| **Leaders** | The top 50 qualified players, sortable by points, rebounds, assists, steals, blocks or 3P%. Regular season or playoffs. |
| **Teams** | Every team's season: record, PPG, net rating, last 10, and full lists of fixtures and results. |

## Data

All data comes from ESPN's public NBA API. It needs no API key and is fetched straight from the browser, so there is no backend. These endpoints are unofficial and may change. All parsing is in `src/api/normalize.ts`, so if a payload's shape changes, that is the only file to fix.

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
