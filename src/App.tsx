import { Fragment, useEffect } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Awards } from './pages/Awards';
import { Compare } from './pages/Compare';
import { Degrees } from './pages/Degrees';
import { Franchise } from './pages/Franchise';
import { Game } from './pages/Game';
import { Games } from './pages/Games';
import { HeadToHead } from './pages/HeadToHead';
import { History } from './pages/History';
import { Home } from './pages/Home';
import { Insights } from './pages/Insights';
import { Leaders } from './pages/Leaders';
import { Player } from './pages/Player';
import { Playoffs } from './pages/Playoffs';
import { Projections } from './pages/Projections';
import { Rankings } from './pages/Rankings';
import { Scores } from './pages/Scores';
import { Standings } from './pages/Standings';
import { Team } from './pages/Team';
import { Teams } from './pages/Teams';
import { LiveBar } from './components/LiveBar';
import { ShareButton } from './components/ShareButton';
import { SnapshotGate } from './components/SnapshotGate';
import { ThemeToggle } from './components/ThemeToggle';
import { SearchBox } from './components/SearchBox';
import { SEASONS } from './lib/seasons';
import { useSeason } from './SeasonContext';

// Grouped: this season · stats · teams & players · history & fun.
const NAV: [string, string][][] = [
  [['/', 'Home'], ['/scores', 'Scores'], ['/standings', 'Standings'], ['/playoffs', 'Playoffs'], ['/projections', 'Projections']],
  [['/leaders', 'Leaders'], ['/awards', 'Awards'], ['/rankings', 'Rankings'], ['/insights', 'Insights']],
  [['/teams', 'Teams'], ['/h2h', 'H2H'], ['/compare', 'Compare']],
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
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="brand">🏀 NBA Stats Hub</NavLink>
          <SearchBox />
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
      <LiveBar />
      <main key={season.year}>
        <SnapshotGate season={season.year}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/scores" element={<Scores />} />
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
          <Route path="/team/:id" element={<Team />} />
          <Route path="/game/:id" element={<Game />} />
        </Routes>
        </SnapshotGate>
      </main>
      <footer className="muted small">Data from ESPN's public API. Times shown in your local time zone.</footer>
    </>
  );
}
