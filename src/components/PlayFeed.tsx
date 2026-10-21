// Play-by-play feed for a game: newest first while live, filterable to
// scoring plays or a single period.
import { useState } from 'react';
import type { FeedItem, Game } from '../api/types';

const periodName = (p: number) => (p <= 4 ? `Q${p}` : `OT${p - 4}`);

export function PlayFeed({ game, feed }: { game: Game; feed: FeedItem[] }) {
  const [scoringOnly, setScoringOnly] = useState(false);
  const periods = [...new Set(feed.map((f) => f.period))];
  const [period, setPeriod] = useState<number | 'all'>('all');
  if (feed.length === 0) return null;
  const live = game.state === 'in';
  const shown = feed.filter((f) => (!scoringOnly || f.scoring) && (period === 'all' || f.period === period));
  const ordered = live ? [...shown].reverse() : shown;
  const abbr = (id: string) => (id === game.home.team.id ? game.home.team.abbr : id === game.away.team.id ? game.away.team.abbr : '');

  return (
    <div className="card">
      <div className="page-head">
        <h3>Play-by-play{live ? ' (latest first)' : ''}</h3>
        <div className="chips tight">
          <button className={scoringOnly ? 'chip active' : 'chip'} onClick={() => setScoringOnly(!scoringOnly)}>Scoring plays</button>
          <button className={period === 'all' ? 'chip active' : 'chip'} onClick={() => setPeriod('all')}>All</button>
          {periods.map((p) => (
            <button key={p} className={period === p ? 'chip active' : 'chip'} onClick={() => setPeriod(p)}>{periodName(p)}</button>
          ))}
        </div>
      </div>
      <ol className="feed">
        {ordered.map((f) => (
          <li key={f.id} className={f.scoring ? 'scoring' : undefined}>
            <span className="feed-time muted small">{periodName(f.period)} {f.clock}</span>
            <span className="feed-team small">{abbr(f.teamId)}</span>
            <span className="feed-text">{f.text}</span>
            <span className="feed-score small">{game.away.team.abbr} {f.away}-{f.home} {game.home.team.abbr}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
