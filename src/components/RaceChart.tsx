import { useEffect, useState } from 'react';
import { fetchLeagueGames } from '../api/espn';
import type { Conference } from '../api/types';
import { useFavourite } from '../FavouriteContext';
import { useAsync } from '../hooks/useAsync';
import { raceSeries } from '../lib/league';
import { LineChart } from './Charts';
import { ErrorBox, Loading } from './Status';

const SLOTS = 3;
const SLOT_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)'];

/** Games above .500 by game number for one conference; up to 3 highlighted teams. */
export function RaceChart({ season, conferences }: { season: number; conferences: Conference[] }) {
  const { favouriteId } = useFavourite();
  const [confName, setConfName] = useState(conferences[0]?.name ?? '');
  const conf = conferences.find((c) => c.name === confName) ?? conferences[0];
  // Fixed slots so a team keeps its colour when others are toggled.
  const [slots, setSlots] = useState<(string | null)[]>([]);
  const league = useAsync(() => fetchLeagueGames(season, 2), [season]);

  useEffect(() => {
    if (!conf) return;
    const ids = conf.rows.map((r) => r.team.id);
    const initial = favouriteId && ids.includes(favouriteId) ? [favouriteId, ...ids.filter((i) => i !== favouriteId)] : ids;
    setSlots(initial.slice(0, SLOTS));
  }, [conf?.name, favouriteId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!conf) return null;

  const toggle = (id: string) => {
    setSlots((s) => {
      if (s.includes(id)) return s.map((x) => (x === id ? null : x));
      const free = s.indexOf(null);
      if (free >= 0) return s.map((x, i) => (i === free ? id : x));
      if (s.length < SLOTS) return [...s, id];
      return s; // all slots full
    });
  };

  const games = league.data?.games ?? [];
  const series = conf.rows.map((r) => {
    const slot = slots.indexOf(r.team.id);
    return {
      id: r.team.id,
      label: r.team.shortName,
      values: raceSeries(games, r.team.id),
      color: slot >= 0 ? SLOT_COLORS[slot] : undefined,
    };
  });
  // Draw highlighted series in slot order (legend order stays stable).
  const ordered = [...series.filter((s) => !s.color), ...slots.flatMap((id) => series.filter((s) => s.id === id && s.color))];
  const full = slots.filter(Boolean).length >= SLOTS;

  return (
    <div className="card">
      <div className="page-head">
        <h2>The race: games above .500</h2>
        <div className="segmented">
          {conferences.map((c) => (
            <button key={c.name} className={c.name === conf.name ? 'active' : ''} onClick={() => setConfName(c.name)}>
              {c.name.replace(' Conference', '')}
            </button>
          ))}
        </div>
      </div>
      <p className="muted small">Highlight up to {SLOTS} teams. Other teams are shown in grey for context.</p>
      <div className="chips tight">
        {conf.rows.map((r) => {
          const slot = slots.indexOf(r.team.id);
          return (
            <button
              key={r.team.id}
              className={slot >= 0 ? 'chip picked' : 'chip'}
              disabled={slot < 0 && full}
              onClick={() => toggle(r.team.id)}
            >
              {slot >= 0 && <i className="key-line" style={{ background: SLOT_COLORS[slot] }} />}
              {r.team.abbr}
            </button>
          );
        })}
      </div>
      {league.loading && <Loading label="Loading every team's games…" />}
      {league.error && <ErrorBox error={league.error} />}
      {games.length > 0 && (
        <LineChart
          ariaLabel={`${conf.name} teams' wins minus losses by game number`}
          series={ordered}
          height={320}
          xLabel={(i) => `After game ${i + 1}`}
          xTick={(i) => `G${i + 1}`}
          yFormat={(v) => (v > 0 ? `+${v}` : String(v))}
          zeroLine
        />
      )}
    </div>
  );
}
