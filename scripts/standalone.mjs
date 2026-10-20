// Inlines the built JS and CSS into one HTML file that opens by double-click
// (file://), so the app can be used without installing Node.js.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
let html = readFileSync(join(dist, 'index.html'), 'utf8');

html = html.replace(/<script type="module" crossorigin src="\.\/([^"]+)"><\/script>/g, (_, src) => {
  const js = readFileSync(join(dist, src), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script type="module">${js}</script>`;
});
html = html.replace(/<link rel="stylesheet" crossorigin href="\.\/([^"]+)">/g, (_, href) => {
  return `<style>${readFileSync(join(dist, href), 'utf8')}</style>`;
});
if (/src="\.\/assets|href="\.\/assets/.test(html)) throw new Error('Unhandled asset reference in dist/index.html');

mkdirSync('standalone', { recursive: true });
writeFileSync('standalone/NBA-Stats-Hub.html', html);
console.log('Wrote standalone/NBA-Stats-Hub.html');
