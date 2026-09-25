import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { ConfigSchema } from '../lib/config.mjs';
import { createContext } from '../lib/context.mjs';

export function deepMerge(base, over) {
  if (Array.isArray(over) || over === null || typeof over !== 'object') return over;
  const out = { ...base };
  for (const [key, value] of Object.entries(over)) {
    out[key] = base && typeof base[key] === 'object' && base[key] !== null && !Array.isArray(base[key])
      ? deepMerge(base[key], value)
      : value;
  }
  return out;
}

export function testContext(root, overrides = {}) {
  const config = ConfigSchema.parse(deepMerge({ kit: 1, repo: { slug: 'acme/widgets' } }, overrides));
  return createContext(root, config);
}

export function makeRepo({ files = {}, config = {}, git = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'omni-'));
  const write = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  for (const [path, text] of Object.entries(files)) write(path, text);
  if (git) {
    const run = (...args) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
    run('init', '-q', '-b', 'main');
    run('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'root');
    if (Object.keys(files).length) {
      run('add', '-A');
      run('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'fixture');
    }
  }
  return { root, ctx: testContext(root, config), write, read: (path) => readFileSync(join(root, path), 'utf8') };
}
