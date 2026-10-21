import { Link } from 'react-router-dom';
import { fetchLeagueGames, fetchStandings } from '../api/espn';
import type { Conference } from '../api/types';
import { Empty, ErrorBox, Loading } from '../components/Status';
import { TeamLogo } from '../components/TeamLogo';
import { useAsync } from '../hooks/useAsync';
import { buildBracket, type Series } from '../lib/league';
import { useSeason } from '../SeasonContext';

const ROUND_NAMES = ['First round', 'Conference semifinals', 'Conference finals', 'NBA Finals'];

function lookups(confs: Conference[]) {
  const seeds = new Map<string, number>();
  const conferences = new Map<string, string>();
  for (const c of confs) {
    c.rows.forEach((r, i) => {
      seeds.set(r.team.id, r.seed ?? i + 1);
      conferences.set(r.team.id, c.name);
    });
  }
  return { seeds, conferences };
}

export function Playoffs() {
  const { season } = useSeason();
  const { data, error, loading } = useAsync(async () => {
    const [standings, league] = await Promise.all([fetchStandings(season.year), fetchLeagueGames(season.year, 3)]);
    const { seeds, conferences } = lookups(standings);
    return { series: buildBracket(league.games, seeds, conferences), conferenceNames: standings.map((c) => c.name) };
  }, [season.year]);

  const west = data?.conferenceNames.find((n) => /west/i.test(n));
  const east = data?.conferenceNames.find((n) => /east/i.test(n));
  const pick = (conf: string | undefined, round: number) =>
    data?.series.filter((s) => s.round === round && s.conference === conf) ?? [];
  const finals = data?.series.find((s) => s.round === 4);
  const champion = finals?.winner;

  return (
    <section>
      <h1>{season.label} playoffs</h1>
      {loading && <Loading label="Loading every team's playoff games…" />}
      {error && <ErrorBox error={error} />}
      {data && data.series.length === 0 && <Empty>No playoff games yet for {season.label}.</Empty>}

      {champion && (
        <div className="champion">
          <TeamLogo team={champion} size={44} />
          <div>
            <div className="muted small">{season.label} NBA champions</div>
            <div className="champion-name">{champion.name}</div>
          </div>
        </div>
      )}

      {data && data.series.length > 0 && (
        <div className="bracket">
          {[1, 2, 3].map((round) => (
            <BracketColumn key={`w${round}`} title={`West · ${ROUND_NAMES[round - 1]}`} series={pick(west, round)} />
          ))}
          <BracketColumn title={ROUND_NAMES[3]} series={finals ? [finals] : []} finals />
          {[3, 2, 1].map((round) => (
            <BracketColumn key={`e${round}`} title={`East · ${ROUND_NAMES[round - 1]}`} series={pick(east, round)} />
          ))}
        </div>
      )}
      <p className="muted small">Play-in games aren't shown. Click a series to see its games.</p>
    </section>
  );
}

function BracketColumn({ title, series, finals }: { title: string; series: Series[]; finals?: boolean }) {
  return (
    <div className={`bracket-col${finals ? ' finals' : ''}`}>
      <div className="bracket-title">{title}</div>
      <div className="bracket-cells">
        {series.length === 0 && <div className="series empty">TBD</div>}
        {series.map((s) => (
          <SeriesCard key={s.key} s={s} />
        ))}
      </div>
    </div>
  );
}

function SeriesCard({ s }: { s: Series }) {
  // Higher seed first.
  const order = (s.seeds[0] ?? 99) <= (s.seeds[1] ?? 99) ? [0, 1] : [1, 0];
  const last = s.games[s.games.length - 1];
  return (
    <details className="series">
      <summary>
        {order.map((i) => (
          <div key={s.teams[i].id} className={`series-row${s.winner && s.winner.id !== s.teams[i].id ? ' lost' : ''}`}>
            <span className="seed">{s.seeds[i] ?? ''}</span>
            <TeamLogo team={s.teams[i]} size={20} />
            <span className="series-team">{s.teams[i].abbr}</span>
            <b>{s.wins[i]}</b>
          </div>
        ))}
      </summary>
      <ol className="series-games">
        {s.games.map((g, n) => (
          <li key={g.id}>
            <Link to={`/game/${g.id}`}>
              G{n + 1}:{' '}
              {g.state === 'post'
                ? `${g.away.team.abbr} ${g.away.score} @ ${g.home.team.abbr} ${g.home.score}`
                : `${g.away.team.abbr} @ ${g.home.team.abbr} · ${g.statusDetail}`}
            </Link>
          </li>
        ))}
      </ol>
      {!s.winner && last && <div className="muted small">Series in progress</div>}
    </details>
  );
}
