import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchAthlete, fetchGameLog, seasonShots, snapshotPlayers } from '../api/espn';
import type { GameLogEntry, LogSeasonType, PlayerProfile } from '../api/types';
import { LineChart } from '../components/Charts';
import { SeasonShotMap } from '../components/SeasonShotMap';
import { ErrorBox, Loading } from '../components/Status';
import { useAsync } from '../hooks/useAsync';
import { averages, statValue, type Averages } from '../lib/playerStats';
import { SEASONS } from '../lib/seasons';
import { normName } from '../lib/teammates';
import { useSeason } from '../SeasonContext';

const MAX = 3;
const COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)'];
const DEFAULTS = ['Shai Gilgeous-Alexander', 'Nikola Jokic', 'Luka Doncic'];
const ROLLING = 10;

const STATS: { key: keyof Averages; label: string; pct?: boolean; lowerIsBetter?: boolean }[] = [
  { key: 'pts', label: 'Points' },
  { key: 'reb', label: 'Rebounds' },
  { key: 'ast', label: 'Assists' },
  { key: 'stl', label: 'Steals' },
  { key: 'blk', label: 'Blocks' },
  { key: 'tov', label: 'Turnovers', lowerIsBetter: true },
  { key: 'fgPct', label: 'FG%', pct: true },
  { key: 'threePct', label: '3P%', pct: true },
  { key: 'ftPct', label: 'FT%', pct: true },
  { key: 'min', label: 'Minutes' },
];
const TRENDS = [
  { label: 'PTS', title: 'Points' },
  { label: 'REB', title: 'Rebounds' },
  { label: 'AST', title: 'Assists' },
  { label: '3PM', title: 'Threes made' },
];

/** Every ESPN player we know (from season snapshots), newest season first. */
function useDirectory() {
  return useMemo(() => {
    const byName = new Map<string, { id: string; name: string }>();
    for (const s of SEASONS) {
      for (const [id, name] of Object.entries(snapshotPlayers(s.year))) if (!byName.has(normName(name))) byName.set(normName(name), { id, name });
    }
    return byName;
  }, []);
}

interface Loaded {
  id: string;
  profile?: PlayerProfile;
  games: GameLogEntry[];
  avg: Averages;
}

export function Compare() {
  const { season } = useSeason();
  const directory = useDirectory();
  const [params, setParams] = useSearchParams();
  const [type, setType] = useState<LogSeasonType>('regular');
  const [trend, setTrend] = useState('PTS');
  const [text, setText] = useState('');
  const fromUrl = (params.get('p') ?? '').split(',').filter(Boolean);
  const ids = fromUrl.length ? fromUrl : DEFAULTS.map((n) => directory.get(normName(n))?.id).filter((x): x is string => !!x);
  const setIds = (next: string[]) => setParams({ p: next.join(',') }, { replace: true });

  const { data, error, loading } = useAsync(
    () =>
      Promise.all(
        ids.map(async (id): Promise<Loaded> => {
          const [profile, log] = await Promise.all([fetchAthlete(id).catch(() => undefined), fetchGameLog(id, season.year)]);
          const games = log.games.filter((g) => g.seasonType === type);
          return { id, profile, games, avg: averages(games) };
        }),
      ),
    [ids.join(','), season.year, type],
  );

  const add = () => {
    const hit = directory.get(normName(text)) ?? [...directory.values()].find((p) => normName(p.name).includes(normName(text)));
    if (hit && !ids.includes(hit.id) && ids.length < MAX) setIds([...ids, hit.id]);
    setText('');
  };
  const players = data ?? [];
  const dirName = (id: string) => [...directory.values()].find((d) => d.id === id)?.name ?? id;
  const nameOf = (p: Loaded) => p.profile?.name ?? dirName(p.id);
  const shots = seasonShots(season.year, type === 'playoffs' ? 3 : 2);
  const fmt = (v: number | undefined, pct?: boolean) => (v == null ? '-' : pct ? `${(v * 100).toFixed(1)}%` : v.toFixed(1));

  // Rolling averages by game number, one line per player.
  const rolling = (games: GameLogEntry[]) => {
    const vals = games.map((g) => statValue(g, trend));
    return vals.map((_, i) => {
      const w = vals.slice(Math.max(0, i - ROLLING + 1), i + 1);
      return Math.round((w.reduce((a, b) => a + b, 0) / w.length) * 10) / 10;
    });
  };

  return (
    <section>
      <datalist id="espn-players">
        {[...directory.values()].map((p) => (
          <option key={p.id} value={p.name} />
        ))}
      </datalist>
      <div className="page-head">
        <h1>Compare players · {season.label}</h1>
        <div className="segmented">
          <button className={type === 'regular' ? 'active' : ''} onClick={() => setType('regular')}>Regular season</button>
          <button className={type === 'playoffs' ? 'active' : ''} onClick={() => setType('playoffs')}>Playoffs</button>
        </div>
      </div>
      <div className="actions">
        {ids.map((id, i) => (
          <span key={id} className="chip picked">
            <i className="key-line" style={{ background: COLORS[i] }} />
            {dirName(id)}
            <button className="link" aria-label="Remove" onClick={() => setIds(ids.filter((x) => x !== id))}>✕</button>
          </span>
        ))}
        {ids.length < MAX && (
          <span className="grid-input inline">
            <input list="espn-players" value={text} placeholder="Add a player…" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
            <button className="chip" onClick={add} disabled={!text}>Add</button>
          </span>
        )}
      </div>

      {loading && <Loading label="Loading game logs…" />}
      {error && <ErrorBox error={error} />}

      {players.length > 0 && (
        <>
          <div className="compare-heads">
            {players.map((p, i) => (
              <Link key={p.id} to={`/player/${p.id}`} className="card compare-head" style={{ borderTopColor: COLORS[i] }}>
                {p.profile?.headshot && <img src={p.profile.headshot} alt="" width={72} height={52} />}
                <div>
                  <b>{nameOf(p)}</b>
                  <div className="muted small">
                    {p.profile?.team?.abbr} · {p.avg.gp} games
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="card">
            <h3>Per-game averages</h3>
            <div className="compare-bars">
              {STATS.map((s) => {
                const vals = players.map((p) => p.avg[s.key] as number | undefined);
                const max = Math.max(...vals.map((v) => v ?? 0), 0.0001);
                const best = s.lowerIsBetter ? Math.min(...vals.map((v) => v ?? Infinity)) : Math.max(...vals.map((v) => v ?? -Infinity));
                return (
                  <div key={s.key} className="compare-stat">
                    <div className="compare-label">{s.label}</div>
                    <div>
                      {players.map((p, i) => {
                        const v = vals[i];
                        return (
                          <div key={p.id} className="pbar compact">
                            <span className="pbar-track">
                              <span className="pbar-fill" style={{ width: `${((v ?? 0) / max) * 100}%`, background: COLORS[i] }} />
                            </span>
                            <span className={v === best && players.length > 1 ? 'pbar-n best' : 'pbar-n'}>{fmt(v, s.pct)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="muted small">Bold = best of the group (fewest for turnovers). Bars are scaled to the highest value in each row.</p>
          </div>

          <div className="card">
            <div className="page-head">
              <h3>{TRENDS.find((t) => t.label === trend)?.title}: {ROLLING}-game rolling average</h3>
              <div className="chips tight">
                {TRENDS.map((t) => (
                  <button key={t.label} className={t.label === trend ? 'chip active' : 'chip'} onClick={() => setTrend(t.label)}>{t.title}</button>
                ))}
              </div>
            </div>
            <LineChart
              ariaLabel={`${ROLLING}-game rolling average by game number`}
              series={players.map((p, i) => ({ id: p.id, label: nameOf(p), values: rolling(p.games), color: COLORS[i] }))}
              xLabel={(i) => `Game ${i + 1}`}
              xTick={(i) => `G${i + 1}`}
              yFormat={(v) => (Number.isInteger(v) ? String(v) : v.toFixed(1))}
            />
          </div>

          {shots && players.some((p) => shots.players[p.id]) && (
            <>
              <h2>Shot maps</h2>
              <div className="compare-shots">
                {players.map((p) =>
                  shots.players[p.id] ? (
                    <SeasonShotMap key={p.id} title={nameOf(p)} bins={shots.players[p.id].bins} size={shots.playerSize} league={shots.league} leagueSize={shots.teamSize} minShare={0.008} />
                  ) : (
                    <div key={p.id} className="card muted small">{nameOf(p)}: not enough shots for a map.</div>
                  ),
                )}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
