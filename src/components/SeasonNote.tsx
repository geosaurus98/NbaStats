// For pages that always show the current season: says so when another season
// is picked at the top, with a one-click switch back.
import { DEFAULT_SEASON, seasonInfo } from '../lib/seasons';
import { useSeason } from '../SeasonContext';

export function CurrentSeasonNote() {
  const { season, setSeasonYear } = useSeason();
  if (season.year === DEFAULT_SEASON) return null;
  const now = seasonInfo(DEFAULT_SEASON).label;
  return (
    <p className="season-note small">
      This page always shows the current season ({now}); the season picker at the top doesn't change it.{' '}
      <button className="link" onClick={() => setSeasonYear(DEFAULT_SEASON)}>Switch the site to {now}</button>
    </p>
  );
}
