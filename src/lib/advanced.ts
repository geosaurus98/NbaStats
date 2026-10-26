// Team and player advanced stats built from every game's player lines:
// team and opponent box totals, Dean Oliver's four factors, Hollinger's PER,
// Basketball-Reference's Win Shares and a Pythagorean "luck" check.
import { L, P, type BoxTotals, type SeasonLines } from './boxTotals';

export interface Box {
  g: number;
  min: number;
  pts: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
}

const KEYS = ['min', 'pts', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'oreb', 'dreb', 'ast', 'stl', 'blk', 'tov', 'pf'] as const;
export const emptyBox = (): Box => ({ g: 0, min: 0, pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 });
const addBox = (a: Box, b: Box) => {
  a.g += b.g;
  for (const k of KEYS) a[k] += b[k];
};

export interface TeamGame {
  gameId: string;
  date: string;
  teamId: string;
  oppId: string;
  home: boolean;
  own: Box;
  opp: Box;
}

export interface TeamSeason {
  teamId: string;
  own: Box;
  opp: Box;
  wins: number;
  losses: number;
  /** Games decided by 5 points or fewer. */
  closeW: number;
  closeL: number;
}

/** Both sides' box score for one game: [home, away]. */
export function gameBoxes(game: SeasonLines['games'][number]): [TeamGame, TeamGame] {
  const [gameId, date, , homeId, awayId, , lines] = game;
  const home = emptyBox();
  const away = emptyBox();
  home.g = away.g = 1;
  for (const l of lines) {
    const b = l[L.home] ? home : away;
    for (const k of KEYS) b[k] += l[L[k]];
  }
  return [
    { gameId, date, teamId: homeId, oppId: awayId, home: true, own: home, opp: away },
    { gameId, date, teamId: awayId, oppId: homeId, home: false, own: away, opp: home },
  ];
}

/** Both sides' box score for every game of one season type (standings games only). */
export function teamGames(data: SeasonLines, seasonType = 2): TeamGame[] {
  return data.games.filter(([, , type, , , counts]) => type === seasonType && (seasonType !== 2 || counts)).flatMap(gameBoxes);
}

export function teamSeasons(games: TeamGame[]): Map<string, TeamSeason> {
  const out = new Map<string, TeamSeason>();
  for (const g of games) {
    const t = out.get(g.teamId) ?? { teamId: g.teamId, own: emptyBox(), opp: emptyBox(), wins: 0, losses: 0, closeW: 0, closeL: 0 };
    addBox(t.own, g.own);
    addBox(t.opp, g.opp);
    const won = g.own.pts > g.opp.pts;
    if (won) t.wins++;
    else t.losses++;
    if (Math.abs(g.own.pts - g.opp.pts) <= 5) {
      if (won) t.closeW++;
      else t.closeL++;
    }
    out.set(g.teamId, t);
  }
  return out;
}

/** Possessions, averaging both teams' estimates. */
export function possessions(own: Box, opp: Box): number {
  const one = (a: Box, b: Box) => a.fga + 0.4 * a.fta - 1.07 * (a.oreb / Math.max(1, a.oreb + b.dreb)) * (a.fga - a.fgm) + a.tov;
  return 0.5 * (one(own, opp) + one(opp, own));
}

export interface FourFactors {
  efg: number;
  tov: number;
  orb: number;
  ftr: number;
}

/** A side's four factors: its own shooting, turnovers, offensive rebounding and free throws. */
export function fourFactors(own: Box, opp: Box): FourFactors {
  return {
    efg: own.fga ? (own.fgm + 0.5 * own.tpm) / own.fga : 0,
    tov: own.tov / Math.max(1, own.fga + 0.44 * own.fta + own.tov),
    orb: own.oreb / Math.max(1, own.oreb + opp.dreb),
    ftr: own.fga ? own.ftm / own.fga : 0,
  };
}

/** Dean Oliver's weights: shooting 40%, turnovers 25%, rebounding 20%, free throws 15%. */
export const FACTOR_WEIGHTS: Record<keyof FourFactors, number> = { efg: 0.4, tov: 0.25, orb: 0.2, ftr: 0.15 };

/**
 * Which factor decided a game: each factor's gap between the two teams,
 * scaled by how much that factor usually varies from game to game, then weighted.
 * Positive favours `own`. Turnovers are flipped so positive is always good.
 */
export function factorEdges(own: Box, opp: Box, spread: FourFactors): FourFactors {
  const a = fourFactors(own, opp);
  const b = fourFactors(opp, own);
  const edge = (k: keyof FourFactors) => (FACTOR_WEIGHTS[k] * (k === 'tov' ? b[k] - a[k] : a[k] - b[k])) / Math.max(1e-6, spread[k]);
  return { efg: edge('efg'), tov: edge('tov'), orb: edge('orb'), ftr: edge('ftr') };
}

/** Standard deviation of each factor across single games. */
export function factorSpread(games: TeamGame[]): FourFactors {
  const vals = games.map((g) => fourFactors(g.own, g.opp));
  const sd = (k: keyof FourFactors) => {
    const m = vals.reduce((s, v) => s + v[k], 0) / Math.max(1, vals.length);
    return Math.sqrt(vals.reduce((s, v) => s + (v[k] - m) ** 2, 0) / Math.max(1, vals.length));
  };
  return { efg: sd('efg'), tov: sd('tov'), orb: sd('orb'), ftr: sd('ftr') };
}

/** Pythagorean expected wins (Daryl Morey's exponent for the NBA, 13.91). */
export function pythagWins(pf: number, pa: number, games: number): number {
  if (!pf && !pa) return 0;
  const e = 13.91;
  return (games * pf ** e) / (pf ** e + pa ** e);
}

export interface PlayerAdvanced {
  id: string;
  team: string;
  g: number;
  min: number;
  per: number;
  ows: number;
  dws: number;
  ws: number;
  ws48: number;
  ortg: number;
  drtg: number;
  ts: number;
  usg: number;
}

/**
 * PER (Hollinger) and Win Shares (Basketball-Reference) for every player in
 * the box totals, using their current team's context.
 */
export function playerAdvanced(box: BoxTotals, seasons: Map<string, TeamSeason>): PlayerAdvanced[] {
  const lg = emptyBox();
  const lgOpp = emptyBox();
  let lgPoss = 0;
  for (const t of seasons.values()) {
    addBox(lg, t.own);
    addBox(lgOpp, t.opp);
    lgPoss += possessions(t.own, t.opp);
  }
  if (!lg.g || !lg.fga) return [];
  const lgTrb = lg.oreb + lg.dreb;
  const lgMin = lg.min;
  const lgPace = (48 * lgPoss) / (lgMin / 5);
  const lgPPP = lg.pts / lgPoss;
  // PER constants.
  const factor = 2 / 3 - (0.5 * (lg.ast / lg.fgm)) / (2 * (lg.fgm / lg.ftm));
  const vop = lg.pts / (lg.fga - lg.oreb + lg.tov + 0.44 * lg.fta);
  const drbPct = (lgTrb - lg.oreb) / lgTrb;
  // Win Shares: points per marginal win.
  const ptsPerGame = lg.pts / lg.g;

  const raw: (PlayerAdvanced & { aPer: number })[] = [];
  for (const r of box.players) {
    const v = (k: keyof typeof P) => r[P[k]] as number;
    const t = seasons.get(r[1]);
    const mp = v('min');
    if (!t || mp <= 0) continue;
    const tm = t.own;
    const op = t.opp;
    const tmPoss = possessions(tm, op);
    const tmPace = (48 * tmPoss) / (tm.min / 5);
    const [fgm, fga, tpm, ftm, fta, orb, drb, ast, stl, blk, tov, pf, pts] = [v('fgm'), v('fga'), v('tpm'), v('ftm'), v('fta'), v('oreb'), v('dreb'), v('ast'), v('stl'), v('blk'), v('tov'), v('pf'), v('pts')];
    const trb = orb + drb;

    // PER
    const tmAstFg = tm.ast / Math.max(1, tm.fgm);
    const uPer =
      (1 / mp) *
      (tpm +
        (2 / 3) * ast +
        (2 - factor * tmAstFg) * fgm +
        ftm * 0.5 * (1 + (1 - tmAstFg) + (2 / 3) * tmAstFg) -
        vop * tov -
        vop * drbPct * (fga - fgm) -
        vop * 0.44 * (0.44 + 0.56 * drbPct) * (fta - ftm) +
        vop * (1 - drbPct) * (trb - orb) +
        vop * drbPct * orb +
        vop * stl +
        vop * drbPct * blk -
        pf * (lg.ftm / lg.pf - 0.44 * (lg.fta / lg.pf) * vop));
    const aPer = (lgPace / tmPace) * uPer;

    // Offence: points produced and possessions used (Dean Oliver).
    const tmMP = tm.min;
    const ftPct = fta ? ftm / fta : 0;
    const tmFtPct = tm.fta ? tm.ftm / tm.fta : 0;
    const share = mp / (tmMP / 5);
    const qAst = share * (1.14 * ((tm.ast - ast) / Math.max(1, tm.fgm))) + (((tm.ast / tmMP) * mp * 5 - ast) / Math.max(1e-6, (tm.fgm / tmMP) * mp * 5 - fgm)) * (1 - share);
    const ptsFromFg = fga ? (pts - ftm) / (2 * fga) : 0;
    const fgPart = fgm * (1 - 0.5 * ptsFromFg * qAst);
    const otherFga = Math.max(1, tm.fga - fga);
    const astPart = 0.5 * ((tm.pts - tm.ftm - (pts - ftm)) / (2 * otherFga)) * ast;
    const ftPart = (1 - (1 - ftPct) ** 2) * 0.4 * fta;
    const tmScPoss = tm.fgm + (1 - (1 - tmFtPct) ** 2) * tm.fta * 0.4;
    const tmPlayPct = tmScPoss / Math.max(1, tm.fga + tm.fta * 0.4 + tm.tov);
    const tmOrbPct = tm.oreb / Math.max(1, tm.oreb + op.dreb);
    const tmOrbWeight = ((1 - tmOrbPct) * tmPlayPct) / Math.max(1e-6, (1 - tmOrbPct) * tmPlayPct + tmOrbPct * (1 - tmPlayPct));
    const orbPart = orb * tmOrbWeight * tmPlayPct;
    const orbAdj = 1 - (tm.oreb / Math.max(1, tmScPoss)) * tmOrbWeight * tmPlayPct;
    const scPoss = (fgPart + astPart + ftPart) * orbAdj + orbPart;
    const fgxPoss = (fga - fgm) * (1 - 1.07 * tmOrbPct);
    const ftxPoss = (1 - ftPct) ** 2 * 0.4 * fta;
    const totPoss = scPoss + fgxPoss + ftxPoss + tov;
    const otherFgm = Math.max(1, tm.fgm - fgm);
    const pprodFg = 2 * (fgm + 0.5 * tpm) * (1 - 0.5 * ptsFromFg * qAst);
    const pprodAst = 2 * ((tm.fgm - fgm + 0.5 * (tm.tpm - tpm)) / otherFgm) * 0.5 * ((tm.pts - tm.ftm - (pts - ftm)) / (2 * otherFga)) * ast;
    const pprodOrb = orb * tmOrbWeight * tmPlayPct * (tm.pts / Math.max(1, tmScPoss));
    const pprod = (pprodFg + pprodAst + ftm) * orbAdj + pprodOrb;
    const ortg = totPoss > 0 ? (100 * pprod) / totPoss : 0;

    // Defence: stops and individual defensive rating.
    const dorPct = op.oreb / Math.max(1, op.oreb + tm.dreb);
    const dfgPct = op.fgm / Math.max(1, op.fga);
    const fmWt = (dfgPct * (1 - dorPct)) / Math.max(1e-6, dfgPct * (1 - dorPct) + (1 - dfgPct) * dorPct);
    const stops1 = stl + blk * fmWt * (1 - 1.07 * dorPct) + drb * (1 - fmWt);
    const opFtPct = op.fta ? op.ftm / op.fta : 0;
    const stops2 = (((op.fga - op.fgm - tm.blk) / tmMP) * fmWt * (1 - 1.07 * dorPct) + (op.tov - tm.stl) / tmMP) * mp + (pf / Math.max(1, tm.pf)) * 0.4 * op.fta * (1 - opFtPct) ** 2;
    const stopPct = ((stops1 + stops2) * op.min) / Math.max(1e-6, tmPoss * mp);
    const tmDrtg = (100 * op.pts) / tmPoss;
    const dPtsPerScPoss = op.pts / Math.max(1, op.fgm + (1 - (1 - opFtPct) ** 2) * op.fta * 0.4);
    const drtg = tmDrtg + 0.2 * (100 * dPtsPerScPoss * (1 - stopPct) - tmDrtg);

    const ptsPerWin = 0.32 * ptsPerGame * (tmPace / lgPace);
    const ows = (pprod - 0.92 * lgPPP * totPoss) / ptsPerWin;
    const dws = ((mp / tmMP) * tmPoss * (1.08 * lgPPP - drtg / 100)) / ptsPerWin;
    const ws = ows + dws;
    const usg = ((fga + 0.44 * fta + tov) * (tmMP / 5)) / (mp * Math.max(1, tm.fga + 0.44 * tm.fta + tm.tov));
    raw.push({ id: r[0], team: r[1], g: v('gp'), min: mp, per: 0, aPer, ows, dws, ws, ws48: (48 * ws) / mp, ortg, drtg, ts: pts / Math.max(1, 2 * (fga + 0.44 * fta)), usg });
  }
  // Scale PER so the league average (minutes-weighted) is 15.
  const lgAPer = raw.reduce((s, p) => s + p.aPer * p.min, 0) / Math.max(1, raw.reduce((s, p) => s + p.min, 0));
  return raw.map(({ aPer, ...p }) => ({ ...p, per: lgAPer ? (aPer * 15) / lgAPer : 0 }));
}
