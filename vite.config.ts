import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { type Plugin, defineConfig } from 'vitest/config';

/** Strict CSP for the built page (dev needs Vite's websocket, so it is added only at build time). */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

function csp(): Plugin {
  return {
    name: 'sudoku-csp',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace('<meta charset="UTF-8">', `<meta charset="UTF-8">\n  <meta http-equiv="Content-Security-Policy" content="${CSP}">`),
  };
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** Writes dist/sw.js with a precache list of every built file and a content hash as cache version. */
function serviceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'sudoku-sw',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const files = walk(outDir)
        .map((f) => relative(outDir, f).split(sep).join('/'))
        .filter((f) => f !== 'sw.js' && !f.endsWith('.txt'))
        .sort();
      const hash = createHash('sha256');
      for (const f of files) hash.update(f).update(readFileSync(join(outDir, f)));
      const template = readFileSync('src/sw-template.js', 'utf8');
      const assets = ['./', ...files.filter((f) => f !== 'index.html').map((f) => `./${f}`)];
      // info.html is precached like any other page
      writeFileSync(
        join(outDir, 'sw.js'),
        template.replace('__VERSION__', hash.digest('hex').slice(0, 12)).replace('__ASSETS__', JSON.stringify(assets)),
      );
    },
  };
}

// Relative base: the game is served under lernspiele.aufner.org/teens/sudoku/ and must work in any subfolder.
export default defineConfig({
  base: './',
  plugins: [csp(), serviceWorker()],
  build: {
    target: 'es2023',
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: { main: 'index.html', info: 'info.html' },
    },
  },
  worker: {
    format: 'es',
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
