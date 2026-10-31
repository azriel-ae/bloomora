// Bundles tests/browser/entry.tsx for a real-browser test. Dev tooling only; not part of the Next build.
// Needs esbuild (and react/react-dom). In a normal checkout: `pnpm add -D esbuild playwright`.
// In a sandbox where they are installed globally, set ESBUILD_PATH / REACT_NODE_PATH.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const req = createRequire(import.meta.url);
const { build } = req(process.env.ESBUILD_PATH ?? 'esbuild');
const dist = path.join(root, 'tests/browser/dist');
mkdirSync(dist, { recursive: true });
const result = await build({
  entryPoints: [path.join(root, 'tests/browser/entry.tsx')], outfile: path.join(dist, 'app.js'), bundle: true, format: 'iife',
  jsx: 'automatic', alias: { '@': root }, loader: { '.json': 'json' }, define: { 'process.env.NODE_ENV': '"production"' },
  nodePaths: process.env.REACT_NODE_PATH ? [process.env.REACT_NODE_PATH] : [], logLevel: 'warning', metafile: true,
});
writeFileSync(path.join(dist, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="app.css"><style>html,body{margin:0}</style></head><body><div id="root"></div><script src="app.js"></script></body></html>');
console.log('bundle ok', Object.keys(result.metafile.outputs).map((f) => path.basename(f)).join(', '));

// Server render + hydration test inputs: render the demo tree with react-dom/server (like Next does), then hydrate it in the browser.
const shared = { bundle: true, jsx: 'automatic', alias: { '@': root }, loader: { '.json': 'json', '.css': 'empty' }, define: { 'process.env.NODE_ENV': '"production"' }, nodePaths: process.env.REACT_NODE_PATH ? [process.env.REACT_NODE_PATH] : [], logLevel: 'warning' };
await build({ ...shared, entryPoints: [path.join(root, 'tests/browser/entry-ssr.tsx')], outfile: path.join(dist, 'ssr.cjs'), platform: 'node', format: 'cjs' });
await build({ ...shared, loader: { '.json': 'json' }, entryPoints: [path.join(root, 'tests/browser/entry-hydrate.tsx')], outfile: path.join(dist, 'hydrate.js'), format: 'iife' });
const { render } = req(path.join(dist, 'ssr.cjs'));
for (const locale of ['id', 'en']) {
  const html = render(locale);
  writeFileSync(path.join(dist, `ssr-${locale}.html`), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="app.css"><style>html,body{margin:0}</style></head><body><div id="root">${html}</div><script src="hydrate.js"></script></body></html>`);
}
console.log('ssr + hydrate inputs ok');
