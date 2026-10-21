import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the build works from any path (e.g. GitHub Pages /<repo>/).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react()],
  build: {
    // The double-click standalone file must be a single script, so it can't
    // load data chunks on demand; the hosted site splits them out.
    rollupOptions: mode === 'standalone' ? { output: { inlineDynamicImports: true } } : {},
  },
}));
