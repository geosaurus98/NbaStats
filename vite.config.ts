import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Standalone build only: ship each bundled dataset (src/data/*.json) gzipped
 * and base64-encoded, unpacked in the browser when first used. The file is
 * a fraction of the size of plain JSON.
 */
function gzipData(): Plugin {
  const gunzip = resolve('src/lib/gunzip.ts');
  return {
    name: 'gzip-data',
    enforce: 'post',
    transform(_code, id) {
      if (!/[\\/]src[\\/]data[\\/][^\\/]+\.json$/.test(id)) return;
      const b64 = gzipSync(readFileSync(id), { level: 9 }).toString('base64');
      return { code: `import { gunzipJson } from ${JSON.stringify(gunzip)};\nexport default gunzipJson(${JSON.stringify(b64)});\n`, map: null };
    },
  };
}

// Relative base so the build works from any path (e.g. GitHub Pages /<repo>/).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), ...(mode === 'standalone' ? [gzipData()] : [])],
  build: {
    // The double-click standalone file must be a single script, so it can't
    // load data chunks on demand; the hosted site splits them out.
    rollupOptions: mode === 'standalone' ? { output: { inlineDynamicImports: true } } : {},
  },
}));
