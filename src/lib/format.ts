// Number formatting shared across pages.

/** 0.4567 → "45.7%". */
export const pct1 = (v: number) => `${(v * 100).toFixed(1)}%`;

/** A chance as a whole percentage, with ">99%" and "<1%" at the ends. */
export const oddsPct = (v: number) => (v >= 0.995 ? '>99%' : v > 0 && v < 0.005 ? '<1%' : `${Math.round(v * 100)}%`);

/** 1 → "1st", 22 → "22nd", 13 → "13th". */
export const ordinal = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 >= 11 && n % 100 <= 13 ? 0 : n % 10] ?? 'th'}`;

/** One decimal with a sign: 2.345 → "+2.3". */
export const signed = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}`;
