import { useState } from 'react';
import type { TeamRef } from '../api/types';

export function TeamLogo({ team, size = 28 }: { team: TeamRef; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (!team.logo || broken) {
    return <span className="logo-fallback" style={{ width: size, height: size }}>{team.abbr}</span>;
  }
  return <img className="logo" src={team.logo} alt="" width={size} height={size} loading="lazy" onError={() => setBroken(true)} />;
}
