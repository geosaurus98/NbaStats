// Data health: when each bundled dataset was last refreshed, how complete it
// is, and how the daily data job has been doing, so stale data is obvious.
import { Link } from 'react-router-dom';
import { loadLines } from '../api/linesStore';
import { loadSnapshot, snapshotYears } from '../api/snapshotStore';
import { Loading } from '../components/Status';
import { useAsync } from '../hooks/useAsync';
import { loadCareers } from '../lib/careers';
import { loadFranchiseData } from '../lib/franchiseData';
import { loadTeammateGraph } from '../lib/teammateStore';
import { DEFAULT_SEASON, seasonInfo } from '../lib/seasons';

/** The GitHub repository the site is published from (for the daily job's history). */
function repo(): string {
  if (typeof location !== 'undefined' && /\.github\.io$/.test(location.hostname)) {
    const owner = location.hostname.split('.')[0];
    const name = location.pathname.split('/').filter(Boolean)[0];
    if (owner && name) return `${owner}/${name}`;
  }
  return 'geosaurus98/NbaStats';
}

const hoursAgo = (iso: string) => (Date.now() - Date.parse(iso)) / 3600e3;
const ago = (iso: string) => {
  const h = hoursAgo(iso);
  return h < 1 ? 'under an hour ago' : h < 48 ? `${Math.round(h)} hours ago` : `${Math.round(h / 24)} days ago`;
};

interface Check {
  label: string;
  value: string;
  ok: boolean | undefined;
  note?: string;
}

export function Status() {
  const data = useAsync(async () => {
    const years = snapshotYears();
    const seasons = await Promise.all(
      years.map(async (y) => {
        const [snap, lines] = await Promise.all([loadSnapshot(y), loadLines(y)]);
        return { y, snap, lines };
      }),
    );
    const [careers, fr, graph] = await Promise.all([loadCareers(), loadFranchiseData(), loadTeammateGraph()]);
    return { seasons, careers, fr, graph };
  }, []);
  const runs = useAsync(async () => {
    const res = await fetch(`https://api.github.com/repos/${repo()}/actions/workflows/snapshot.yml/runs?per_page=8`);
    if (!res.ok) throw new Error(`GitHub ${res.status}`);
    const j = (await res.json()) as { workflow_runs: { id: number; status: string; conclusion: string | null; event: string; created_at: string; html_url: string; head_branch: string }[] };
    return j.workflow_runs;
  }, []);
  if (data.loading || !data.data) return <Loading label="Checking every dataset…" />;
  const { seasons, careers, fr, graph } = data.data;
  const checks = (s: (typeof seasons)[number]): Check[] => {
    const snap = s.snap;
    if (!snap) return [{ label: 'Snapshot', value: 'missing', ok: false }];
    const inProgress = snap.complete === false;
    const regular = snap.games['2'] ?? [];
    const finals = regular.filter((g) => g[4] != null).length;
    const pbp = snap.drama?.['2']?.length ?? 0;
    const lineGames = s.lines?.games.filter((g) => g[2] === 2).length ?? 0;
    const fresh = hoursAgo(snap.generatedAt);
    return [
      { label: 'Last refreshed', value: `${new Date(snap.generatedAt).toLocaleString()} (${ago(snap.generatedAt)})`, ok: inProgress ? fresh < 36 : true, note: inProgress ? 'Refreshed every day while the season is on.' : 'Season finished: no more refreshes needed.' },
      { label: 'Regular-season games', value: `${finals} played of ${regular.length}`, ok: regular.length >= 1200 },
      { label: 'Box scores (player lines)', value: `${lineGames} of ${finals} games`, ok: finals === 0 ? undefined : lineGames >= finals - 2 },
      { label: 'Play-by-play', value: `${pbp} of ${finals} games`, ok: finals === 0 ? undefined : pbp >= finals * 0.97, note: 'Lineups, clutch, shot charts and win probability come from this.' },
      { label: 'Win probability', value: `${snap.wpa?.['2']?.players.length ?? 0} players`, ok: finals === 0 ? undefined : (snap.wpa?.['2']?.players.length ?? 0) > 100 },
      ...(inProgress
        ? [
            { label: 'Injury report', value: `${snap.injuries?.length ?? 0} players`, ok: (snap.injuries?.length ?? 0) > 0 },
            { label: 'Payrolls', value: `${Object.keys(snap.payroll ?? {}).length} of 30 teams`, ok: Object.keys(snap.payroll ?? {}).length >= 28 },
          ]
        : []),
    ];
  };
  const latestCareer = Math.max(...careers.seasons.flatMap((r) => r.map((x) => x[0])));
  const latestFranchise = Math.max(...fr.teamSeasons.map((t) => t[0]));
  const history: Check[] = [
    { label: 'Career stats', value: `through ${seasonInfo(latestCareer).label}`, ok: latestCareer >= DEFAULT_SEASON - 1, note: 'Basketball-Reference adds a season once it has finished.' },
    { label: 'Franchise seasons and drafts', value: `through ${seasonInfo(latestFranchise).label}`, ok: latestFranchise >= DEFAULT_SEASON - 1 },
    { label: 'Teammate graph (6 Degrees)', value: `${graph.data.players.length.toLocaleString()} players, built ${ago(graph.data.generatedAt)}`, ok: hoursAgo(graph.data.generatedAt) < 72 },
    { label: 'Hall of Fame list', value: `${careers.hof?.length ?? 0} players`, ok: (careers.hof?.length ?? 0) > 100 },
  ];
  const icon = (ok: boolean | undefined) => (ok === undefined ? <span className="muted">–</span> : ok ? <span className="win" aria-label="OK">✔</span> : <span className="loss" aria-label="Needs attention">⚠</span>);
  const problems = [...seasons.flatMap(checks), ...history].filter((c) => c.ok === false).length;
  return (
    <section>
      <h1>Data health</h1>
      <h2 className="sr-only">Checks</h2>
      <p className={problems ? 'loss' : 'win'}><b>{problems ? `${problems} thing${problems === 1 ? '' : 's'} need${problems === 1 ? 's' : ''} attention.` : 'Everything is up to date.'}</b></p>
      <p className="muted">The site bundles a daily snapshot of each season, built by a GitHub Action from ESPN and Basketball-Reference. Live scores, box scores and player pages always come straight from ESPN.</p>
      <div className="two-col">
        {seasons.map((s) => (
          <div key={s.y} className="table-wrap">
            <h3 className="table-title">{seasonInfo(s.y).label}{s.snap?.complete === false ? ' (in progress)' : ''}</h3>
            <table>
              <tbody>
                {checks(s).map((c) => (
                  <tr key={c.label} title={c.note}>
                    <td className="left">{c.label}</td>
                    <td className="left">{c.value}</td>
                    <td>{icon(c.ok)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <div className="table-wrap">
          <h3 className="table-title">History</h3>
          <table>
            <tbody>
              {history.map((c) => (
                <tr key={c.label} title={c.note}>
                  <td className="left">{c.label}</td>
                  <td className="left">{c.value}</td>
                  <td>{icon(c.ok)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="table-wrap job-runs">
        <h3 className="table-title">Daily data job (latest runs)</h3>
        {runs.loading && <p className="small muted">Asking GitHub…</p>}
        {runs.error && <p className="small muted">Couldn't reach GitHub ({runs.error.message}); the checks above still apply.</p>}
        {runs.data && (
          <table>
            <tbody>
              {runs.data.map((r) => (
                <tr key={r.id}>
                  <td className="left">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="left muted">{r.event === 'schedule' ? 'daily' : r.event === 'workflow_dispatch' ? 'manual' : 'code change'} · {r.head_branch}</td>
                  <td className={r.conclusion === 'success' ? 'win' : r.conclusion ? 'loss' : 'muted'}>{r.conclusion ?? r.status}</td>
                  <td><a href={r.html_url}>log</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="small"><Link to="/guide">What's on this site →</Link></p>
    </section>
  );
}
