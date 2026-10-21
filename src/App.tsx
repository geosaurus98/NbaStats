import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Degrees } from './pages/Degrees';
import { Game } from './pages/Game';
import { HeadToHead } from './pages/HeadToHead';
import { Leaders } from './pages/Leaders';
import { Player } from './pages/Player';
import { Playoffs } from './pages/Playoffs';
import { Rankings } from './pages/Rankings';
import { Scores } from './pages/Scores';
import { Standings } from './pages/Standings';
import { Team } from './pages/Team';
import { Teams } from './pages/Teams';
import { SEASONS } from './lib/seasons';
import { useSeason } from './SeasonContext';

export function App() {
  const { season, setSeasonYear } = useSeason();
  const location = useLocation();
  const navigate = useNavigate();
  const changeSeason = (year: number) => {
    setSeasonYear(year);
    // A date picked for the old season makes no sense for the new one.
    if (location.pathname === '/') navigate('/');
  };
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="brand">🏀 NBA Stats Hub</NavLink>
          <nav>
            <NavLink to="/" end>Scores</NavLink>
            <NavLink to="/standings">Standings</NavLink>
            <NavLink to="/playoffs">Playoffs</NavLink>
            <NavLink to="/leaders">Leaders</NavLink>
            <NavLink to="/rankings">Rankings</NavLink>
            <NavLink to="/teams">Teams</NavLink>
            <NavLink to="/h2h">H2H</NavLink>
            <NavLink to="/degrees">6 Degrees</NavLink>
          </nav>
          <label className="season-select">
            <span className="muted">Season</span>
            <select value={season.year} onChange={(e) => changeSeason(Number(e.target.value))}>
              {SEASONS.map((s) => (
                <option key={s.year} value={s.year}>{s.label}</option>
              ))}
            </select>
          </label>
        </div>
      </header>
      <main key={season.year}>
        <Routes>
          <Route path="/" element={<Scores />} />
          <Route path="/standings" element={<Standings />} />
          <Route path="/playoffs" element={<Playoffs />} />
          <Route path="/leaders" element={<Leaders />} />
          <Route path="/rankings" element={<Rankings />} />
          <Route path="/h2h" element={<HeadToHead />} />
          <Route path="/degrees" element={<Degrees />} />
          <Route path="/player/:id" element={<Player />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/team/:id" element={<Team />} />
          <Route path="/game/:id" element={<Game />} />
        </Routes>
      </main>
      <footer className="muted small">Data from ESPN's public API. Times shown in your local time zone.</footer>
    </>
  );
}
