import { createContext, useContext, useState, type ReactNode } from 'react';

const KEY = 'nba-hub-favourite';

interface FavouriteCtx {
  favouriteId?: string;
  toggleFavourite: (teamId: string) => void;
}

const Ctx = createContext<FavouriteCtx | null>(null);

function read(): string | undefined {
  try {
    return localStorage.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function FavouriteProvider({ children }: { children: ReactNode }) {
  const [favouriteId, setFavouriteId] = useState(read);
  const toggleFavourite = (teamId: string) => {
    const next = favouriteId === teamId ? undefined : teamId;
    setFavouriteId(next);
    try {
      if (next) localStorage.setItem(KEY, next);
      else localStorage.removeItem(KEY);
    } catch {
      /* storage unavailable */
    }
  };
  return <Ctx.Provider value={{ favouriteId, toggleFavourite }}>{children}</Ctx.Provider>;
}

export function useFavourite(): FavouriteCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFavourite must be used inside FavouriteProvider');
  return ctx;
}
