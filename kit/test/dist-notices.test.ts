// Legal L-LICENSE-2 (#2220): the built kit keeps the copyright and permission notice of every library
// it bundles. esbuild is asked here, on its own, which packages each entry of kit/build.ts pulls in,
// and every committed file of kit/dist that carries a package must carry that package's licence text,
// verbatim, under its name. `kit/dist/omni.mjs`, the only file the package ships, carries them all.
import { build } from 'esbuild';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const kit = join(repoRoot, 'kit');

/** The package roots (under node_modules) whose files esbuild bundles from these options. */
async function bundledPackages(options: Parameters<typeof build>[0]): Promise<string[]> {
  const result = await build({ ...options, bundle: true, write: false, metafile: true, logLevel: 'silent', absWorkingDir: repoRoot, outfile: join(repoRoot, 'out.js') });
  const roots = new Set<string>();
  for (const input of Object.keys(result.metafile.inputs)) {
    const at = input.lastIndexOf('node_modules/');
    if (at < 0) continue;
    const parts = input.slice(at + 'node_modules/'.length).split('/');
    const name = parts[0]?.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? '');
    roots.add(join(repoRoot, input.slice(0, at), 'node_modules', name));
  }
  return [...roots].sort();
}

const DEFINES = { __OMNI_BUNDLE__: 'null', __OMNI_TEMPLATES__: '"{}"', __OMNI_SKILLS__: '"{}"', __OMNI_PITCH_ENGINE__: '"{}"' };
const cli = () =>
  bundledPackages({
    stdin: { contents: "export * from './bin/omni.ts'; export * from './lib/playbook/templates.ts'; export * from './lib/agents/skills.ts';", resolveDir: kit, loader: 'js' },
    platform: 'node',
    format: 'esm',
    define: DEFINES,
  });
const engine = () =>
  bundledPackages({ entryPoints: [join(kit, 'pitch-engine/page.tsx')], platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' } });

/** A package's licence file, as it ships it. */
function licenceText(root: string): string {
  const file = readdirSync(root).find((name) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(name));
  expect(file, `${root} ships no licence file`).toBeDefined();
  return readFileSync(join(root, file ?? ''), 'utf8');
}

/**
 * True when the notices comment that ends `bundle` names the package as `name@version`, and its
 * licence file follows that line, verbatim (line endings made `\n`, a `*` `/` split so the comment
 * stays open).
 */
function carries(bundle: string, root: string): boolean {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { name: string; version: string };
  const comment = bundle.lastIndexOf('/*! Third-party notices');
  if (comment < 0 || !bundle.trimEnd().endsWith('*/')) return false;
  const at = bundle.indexOf(`\n${pkg.name}@${pkg.version} `, comment);
  if (at < 0) return false;
  const text = licenceText(root).replaceAll('\r\n', '\n').trimEnd().replaceAll('*/', '* /');
  return bundle.startsWith(`\n\n${text}\n`, bundle.indexOf('\n', at + 1));
}

const read = (path: string) => readFileSync(join(repoRoot, path), 'utf8');

describe('the built kit keeps the notice of every library it bundles (L-LICENSE-2, #2220)', () => {
  it('bundles zod and yaml into the CLI, and React into the pitch engine', async () => {
    const names = (roots: string[]) => roots.map((r) => r.slice(r.lastIndexOf('node_modules/') + 'node_modules/'.length));
    expect(names(await cli())).toEqual(expect.arrayContaining(['yaml', 'zod']));
    expect(names(await engine())).toEqual(expect.arrayContaining(['react', 'react-dom', 'scheduler']));
  });

  it('kit/dist/omni.mjs carries the licence of every package the CLI or the pitch engine bundles', async () => {
    const bundle = read('kit/dist/omni.mjs');
    const roots = [...new Set([...(await cli()), ...(await engine())])];
    expect(roots.length).toBeGreaterThan(0);
    for (const root of roots) expect(carries(bundle, root), `kit/dist/omni.mjs lacks the notice of ${relative(repoRoot, root)}`).toBe(true);
  });

  it('kit/dist/pitch-engine/engine.js carries the licence of every package it bundles', async () => {
    const bundle = read('kit/dist/pitch-engine/engine.js');
    for (const root of await engine()) expect(carries(bundle, root), `engine.js lacks the notice of ${relative(repoRoot, root)}`).toBe(true);
  });
});
