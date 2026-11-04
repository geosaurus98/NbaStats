// Main navigation: Home and Scores, then four drop-down menus. Each menu lists
// its pages with a line on what is there. Click (or Enter/Space) opens one;
// Escape, a click outside or moving to another page closes it.
import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

interface MenuLink {
  to: string;
  label: string;
  what: string;
}

export const MENUS: { label: string; links: MenuLink[] }[] = [
  {
    label: 'This season',
    links: [
      { to: '/standings', label: 'Standings', what: 'Conference tables, the race and the NBA Cup' },
      { to: '/recap', label: 'This week', what: 'The week in the NBA: best games, movers and upsets' },
      { to: '/playoffs', label: 'Playoffs', what: 'Bracket, series odds and your bracket challenge' },
      { to: '/projections', label: 'Projections', what: 'Playoff and title odds, power ratings, what if' },
      { to: '/awards', label: 'Awards', what: 'MVP, DPOY and ROY races, and past winners' },
      { to: '/draft', label: 'Draft hub', what: 'Lottery odds, class grades and draft history' },
    ],
  },
  {
    label: 'Stats',
    links: [
      { to: '/leaders', label: 'Leaders', what: 'Averages, highs, streaks, advanced stats' },
      { to: '/rankings', label: 'Team rankings', what: 'Ratings, four factors, luck, styles, schedule' },
      { to: '/insights', label: 'Insights', what: 'Exciting games, clutch, shooting, players' },
      { to: '/fantasy', label: 'Fantasy', what: 'Fantasy points, 9-cat value and pickups' },
    ],
  },
  {
    label: 'Teams & players',
    links: [
      { to: '/teams', label: 'Teams', what: 'All 30 teams' },
      { to: '/myteam', label: 'My team', what: 'Everything about the team you star' },
      { to: '/compare', label: 'Compare players', what: 'Up to three players side by side' },
      { to: '/h2h', label: 'Head-to-head', what: 'Two teams: meetings and numbers' },
      { to: '/salaries', label: 'Salaries', what: 'Payrolls, the cap, tax and aprons' },
      { to: '/trade', label: 'Trade machine', what: 'Does the trade work under the cap rules?' },
      { to: '/coaches', label: 'Coaches & front offices', what: 'Every coach and GM, with records' },
    ],
  },
  {
    label: 'History & fun',
    links: [
      { to: '/history', label: 'History', what: 'Careers, all-time leaders, greatest teams, eras' },
      { to: '/degrees', label: '6 Degrees', what: 'How any two players connect through teammates' },
      { to: '/games', label: 'Games', what: 'Daily puzzles and trivia' },
      { to: '/guide', label: "What's on this site", what: 'A tour of every page and the stats explained' },
      { to: '/status', label: 'Data health', what: 'How fresh and complete the data is' },
    ],
  },
];

const inMenu = (path: string, links: MenuLink[]) => links.some((l) => path === l.to || path.startsWith(`${l.to}/`));

function useNarrow(px = 640) {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth <= px);
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth <= px);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [px]);
  return narrow;
}

/** The menu number used for the single phone menu. */
const ALL = -1;

export function NavMenus() {
  const { pathname } = useLocation();
  const narrow = useNarrow();
  const [open, setOpen] = useState<number | undefined>();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => setOpen(undefined), [pathname]);
  useEffect(() => {
    if (open === undefined) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(undefined);
        (ref.current?.querySelector(`[data-menu="${open}"]`) as HTMLElement | null)?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(undefined);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);
  // Team, player and game pages belong to "Teams & players" for highlighting.
  const current = MENUS.findIndex((m) => inMenu(pathname, m.links) || (m.label === 'Teams & players' && /^\/(team|player|franchise)\//.test(pathname)));
  if (narrow) {
    const here = MENUS.flatMap((m) => m.links).find((l) => pathname === l.to || pathname.startsWith(`${l.to}/`));
    return (
      <nav className="mainnav phone" aria-label="Main" ref={ref}>
        <NavLink to="/" end>Home</NavLink>
        <NavLink to="/scores">Scores</NavLink>
        <button data-menu={ALL} className={`nav-menu-button${current >= 0 ? ' active' : ''}`} aria-expanded={open === ALL} aria-controls="menu-all" onClick={() => setOpen(open === ALL ? undefined : ALL)}>
          ☰ {here?.label ?? 'Menu'}
        </button>
        {open === ALL && (
          <div className="nav-panel nav-panel-all" id="menu-all">
            {MENUS.map((m) => (
              <div key={m.label} className="nav-panel-group">
                <div className="nav-panel-heading">{m.label}</div>
                {m.links.map((l) => (
                  <NavLink key={l.to} to={l.to} className="nav-panel-link">
                    <span className="nav-panel-label">{l.label}</span>
                  </NavLink>
                ))}
              </div>
            ))}
          </div>
        )}
      </nav>
    );
  }
  return (
    <nav className="mainnav" aria-label="Main" ref={ref}>
      <NavLink to="/" end>Home</NavLink>
      <NavLink to="/scores">Scores</NavLink>
      {MENUS.map((m, i) => (
        <div key={m.label} className="nav-menu">
          <button
            data-menu={i}
            className={`nav-menu-button${i === current ? ' active' : ''}`}
            aria-expanded={open === i}
            aria-controls={`menu-${i}`}
            onClick={() => setOpen(open === i ? undefined : i)}
          >
            {m.label} <span aria-hidden>▾</span>
          </button>
          {open === i && (
            <div className="nav-panel" id={`menu-${i}`}>
              {m.links.map((l) => (
                <NavLink key={l.to} to={l.to} className="nav-panel-link">
                  <span className="nav-panel-label">{l.label}</span>
                  <span className="nav-panel-what">{l.what}</span>
                </NavLink>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}
