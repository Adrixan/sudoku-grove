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

/** Inserts tested tutorial code (regions of tutorial/sudoku-tutorial.js) into pages: <!--snippet:name-->. */
function snippets(): Plugin {
  const escape = (t: string): string => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return {
    name: 'sudoku-snippets',
    transformIndexHtml(html) {
      if (!html.includes('<!--snippet:')) return html;
      const source = readFileSync('tutorial/sudoku-tutorial.js', 'utf8');
      return html.replace(/<!--snippet:(\w+)-->/g, (_, name: string) => {
        const match = new RegExp(`// #region ${name}\\n([\\s\\S]*?)// #endregion ${name}`).exec(source);
        if (!match?.[1]) throw new Error(`Tutorial snippet "${name}" fehlt`);
        return `<pre tabindex="0" aria-label="Code ${name.replace('schritt', 'Schritt ')}"><code>${escape(match[1].trimEnd())}</code></pre>`;
      });
    },
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
  plugins: [snippets(), csp(), serviceWorker()],
  build: {
    target: 'es2023',
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: { main: 'index.html', info: 'info.html', techniken: 'techniken.html', programmieren: 'programmieren.html' },
    },
  },
  worker: {
    format: 'es',
  },
  test: {
    include: ['src/**/*.test.ts', 'tutorial/**/*.test.ts'],
    environment: 'node',
  },
});
