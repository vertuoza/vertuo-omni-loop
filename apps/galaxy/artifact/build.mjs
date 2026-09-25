// pnpm galaxy:artifact — bundle the arcade into a single self-contained HTML page
// (artifact/dist/omni-loop.html) for sharing without a server. React loads from cdnjs
// (the 18.x UMD build; the app uses nothing React 19 adds); everything else is inlined.
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const GLOBALS = { react: 'React', 'react-dom': 'ReactDOM', 'react-dom/client': 'ReactDOM' };

const umdGlobals = {
  name: 'umd-globals',
  setup(b) {
    b.onResolve({ filter: /^react(-dom)?(\/client)?$/ }, (args) => ({ path: args.path, namespace: 'umd' }));
    b.onLoad({ filter: /.*/, namespace: 'umd' }, (args) => ({ contents: `module.exports = window.${GLOBALS[args.path]};`, loader: 'js' }));
  },
};

const result = await build({
  entryPoints: [here('./entry.tsx')],
  bundle: true,
  minify: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  jsx: 'transform',
  tsconfigRaw: { compilerOptions: { jsx: 'react' } }, // classic createElement, so React 18's global is used
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [umdGlobals],
  logLevel: 'warning',
});
const js = result.outputFiles[0].text.replaceAll('</script', '<\\/script');
const css = readFileSync(here('../src/arcade/arcade.css'), 'utf8');

const html = `<title>Omni Loop Galaxy</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jersey+10&family=Press+Start+2P&display=swap">
<style>
${css}
</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>
${js}
</script>
`;
mkdirSync(here('./dist'), { recursive: true });
writeFileSync(here('./dist/omni-loop.html'), html);
console.log(`artifact/dist/omni-loop.html: ${(html.length / 1024).toFixed(0)} KB`);
