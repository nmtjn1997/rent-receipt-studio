/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `base: './'` keeps asset URLs relative, so the same build works at a domain root,
// under a GitHub Pages sub-path (/repo-name/), behind any reverse proxy, or from a file.
// `--mode single` inlines everything into one HTML file that opens with a double-click.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
}));
