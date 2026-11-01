import { Fragment, lazy, Suspense, useEffect } from 'react';
import { Home } from './pages/Home';
import { Scores } from './pages/Scores';

import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { LiveBar } from './components/LiveBar';
import { ShareButton } from './components/ShareButton';
import { SnapshotGate } from './components/SnapshotGate';
import { ThemeToggle } from './components/ThemeToggle';
import { SearchBox } from './components/SearchBox';
import { SEASONS } from './lib/seasons';
import { useSeason } from './SeasonContext';
import { Loading } from './components/Status';
import { OfflineBar } from './components/AppStatus';

// Pages load their code the first time they're opened (the home page and scores are in the main bundle).
const Awards = lazy(() => import('./pages/Awards').then((m) => ({ default: m.Awards })));
const Compare = lazy(() => import('./pages/Compare').then((m) => ({ default: m.Compare })));
const Degrees = lazy(() => import('./pages/Degrees').then((m) => ({ default: m.Degrees })));
const Franchise = lazy(() => import('./pages/Franchise').then((m) => ({ default: m.Franchise })));
const Game = lazy(() => import('./pages/Game').then((m) => ({ default: m.Game })));
const Games = lazy(() => import('./pages/Games').then((m) => ({ default: m.Games })));
const HeadToHead = lazy(() => import('./pages/HeadToHead').then((m) => ({ default: m.HeadToHead })));
const History = lazy(() => import('./pages/History').then((m) => ({ default: m.History })));
const Insights = lazy(() => import('./pages/Insights').then((m) => ({ default: m.Insights })));
const MyTeam = lazy(() => import('./pages/MyTeam').then((m) => ({ default: m.MyTeam })));
const Leaders = lazy(() => import('./pages/Leaders').then((m) => ({ default: m.Leaders })));
const Player = lazy(() => import('./pages/Player').then((m) => ({ default: m.Player })));
const Playoffs = lazy(() => import('./pages/Playoffs').then((m) => ({ default: m.Playoffs })));
const Projections = lazy(() => import('./pages/Projections').then((m) => ({ default: m.Projections })));
const Rankings = lazy(() => import('./pages/Rankings').then((m) => ({ default: m.Rankings })));
const Salaries = lazy(() => import('./pages/Salaries').then((m) => ({ default: m.Salaries })));
const Standings = lazy(() => import('./pages/Standings').then((m) => ({ default: m.Standings })));
const Team = lazy(() => import('./pages/Team').then((m) => ({ default: m.Team })));
const Teams = lazy(() => import('./pages/Teams').then((m) => ({ default: m.Teams })));
const Fantasy = lazy(() => import('./pages/Fantasy').then((m) => ({ default: m.Fantasy })));
const Guide = lazy(() => import('./pages/Guide').then((m) => ({ default: m.Guide })));
const Alerts = lazy(() => import('./pages/Alerts').then((m) => ({ default: m.Alerts })));
const Draft = lazy(() => import('./pages/Draft').then((m) => ({ default: m.Draft })));
const Trade = lazy(() => import('./pages/Trade').then((m) => ({ default: m.Trade })));
const Status = lazy(() => import('./pages/Status').then((m) => ({ default: m.Status })));
const TeamReport = lazy(() => import('./pages/TeamReport').then((m) => ({ default: m.TeamReport })));

// Grouped: this season · stats · teams & players · history & fun.
const NAV: [string, string][][] = [
  [['/', 'Home'], ['/scores', 'Scores'], ['/standings', 'Standings'], ['/playoffs', 'Playoffs'], ['/projections', 'Projections']],
  [['/leaders', 'Leaders'], ['/awards', 'Awards'], ['/rankings', 'Rankings'], ['/insights', 'Insights'], ['/fantasy', 'Fantasy']],
  [['/teams', 'Teams'], ['/salaries', 'Salaries'], ['/trade', 'Trade'], ['/draft', 'Draft'], ['/compare', 'Compare']],
  [['/history', 'History'], ['/degrees', '6 Degrees'], ['/games', 'Games']],
];

export function App() {
  const { season, setSeasonYear } = useSeason();
  const location = useLocation();
  const navigate = useNavigate();
  // On narrow screens the menu scrolls: keep the current page's link in view.
  useEffect(() => {
    document.querySelector('.mainnav a.active')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [location.pathname]);
  const changeSeason = (year: number) => {
    setSeasonYear(year);
    // A date picked for the old season makes no sense for the new one.
    if (location.pathname === '/scores') navigate('/scores');
  };
  return (
    <>
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="brand">🏀 NBA Stats Hub</NavLink>
          <SearchBox />
          <NavLink to="/alerts" className="icon-link" title="Alerts: your team and followed players" aria-label="Alerts">🔔</NavLink>
          <NavLink to="/guide" className="icon-link" title="What's on this site" aria-label="Guide">?</NavLink>
          <ShareButton compact />
          <ThemeToggle />
          <label className="season-select">
            <span className="muted">Season</span>
            <select value={season.year} onChange={(e) => changeSeason(Number(e.target.value))}>
              {SEASONS.map((s) => (
                <option key={s.year} value={s.year}>{s.label}</option>
              ))}
            </select>
          </label>
        </div>
        <nav className="mainnav" aria-label="Main">
          {NAV.map((group, i) => (
            <Fragment key={i}>
              {i > 0 && <span className="nav-sep" aria-hidden />}
              {group.map(([to, label]) => (
                <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>
              ))}
            </Fragment>
          ))}
        </nav>
      </header>
      <OfflineBar />
      <LiveBar />
      <main key={season.year} id="main" tabIndex={-1}>
        <SnapshotGate season={season.year}>
        <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/scores" element={<Scores />} />
          <Route path="/myteam" element={<MyTeam />} />
          <Route path="/standings" element={<Standings />} />
          <Route path="/playoffs" element={<Playoffs />} />
          <Route path="/projections" element={<Projections />} />
          <Route path="/leaders" element={<Leaders />} />
          <Route path="/awards" element={<Awards />} />
          <Route path="/rankings" element={<Rankings />} />
          <Route path="/h2h" element={<HeadToHead />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/degrees" element={<Degrees />} />
          <Route path="/history" element={<History />} />
          <Route path="/franchise/:id" element={<Franchise />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/games" element={<Games />} />
          <Route path="/player/:id" element={<Player />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/salaries" element={<Salaries />} />
          <Route path="/team/:id" element={<Team />} />
          <Route path="/game/:id" element={<Game />} />
          <Route path="/team/:id/report" element={<TeamReport />} />
          <Route path="/fantasy" element={<Fantasy />} />
          <Route path="/guide" element={<Guide />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/status" element={<Status />} />
          <Route path="/trade" element={<Trade />} />
          <Route path="/draft" element={<Draft />} />
        </Routes>
        </Suspense>
        </SnapshotGate>
      </main>
      <footer className="muted small">Data from ESPN's public API. Times shown in your local time zone.</footer>
    </>
  );
}
