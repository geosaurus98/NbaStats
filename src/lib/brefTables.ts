// Reads Basketball-Reference tables: every row as { data-stat: text }, with
// the first link in each cell kept as `<stat>_href`. Some tables are shipped
// inside HTML comments, so comment markers are removed first.

export type BrefRow = Record<string, string>;

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();

/** All tables on the page, by id: header-free data rows only. */
export function brefTables(html: string): Map<string, BrefRow[]> {
  const page = html.replace(/<!--|-->/g, '');
  const out = new Map<string, BrefRow[]>();
  const tableRe = /<table\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/table>/g;
  for (const [, id, body] of page.matchAll(tableRe)) {
    const rows: BrefRow[] = [];
    const tbody = /<tbody[^>]*>([\s\S]*?)<\/tbody>/.exec(body)?.[1] ?? body;
    for (const [, tr] of tbody.matchAll(/<tr\b(?![^>]*class="[^"]*thead)[^>]*>([\s\S]*?)<\/tr>/g)) {
      const row: BrefRow = {};
      for (const [, , stat, cell] of tr.matchAll(/<(th|td)\b[^>]*\bdata-stat="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/g)) {
        row[stat] = text(cell);
        const href = /href="([^"]+)"/.exec(cell)?.[1];
        if (href) row[`${stat}_href`] = href;
      }
      if (Object.keys(row).length) rows.push(row);
    }
    out.set(id, rows);
  }
  return out;
}
