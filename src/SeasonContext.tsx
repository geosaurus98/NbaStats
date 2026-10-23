import { createContext, useContext, useState, type ReactNode } from 'react';
import { DEFAULT_SEASON, getSeason, type Season } from './lib/seasons';

// v2: choices saved while 2025-26 was the default are dropped once, so everyone opens on the current season.
const KEY = 'nba-hub-season-v2';

interface SeasonCtx {
  season: Season;
  setSeasonYear: (year: number) => void;
}

const Ctx = createContext<SeasonCtx | null>(null);

function initialYear(): number {
  try {
    const stored = Number(localStorage.getItem(KEY));
    if (stored) return getSeason(stored).year;
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_SEASON;
}

export function SeasonProvider({ children }: { children: ReactNode }) {
  const [year, setYear] = useState(initialYear);
  const setSeasonYear = (y: number) => {
    setYear(y);
    try {
      localStorage.setItem(KEY, String(y));
    } catch {
      /* storage unavailable */
    }
  };
  return <Ctx.Provider value={{ season: getSeason(year), setSeasonYear }}>{children}</Ctx.Provider>;
}

export function useSeason(): SeasonCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSeason must be used inside SeasonProvider');
  return ctx;
}
