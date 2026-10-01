#!/usr/bin/env node
// The rename of PRD 725 (s2): every `.mjs` file of the repository becomes `.ts`, opened with
// `// @ts-nocheck`, and every import and path naming one of them is rewritten to name the `.ts`
// file. Node runs the `.ts` files as they are (type stripping, Node >= 22.18); the typing slices then
// remove the `@ts-nocheck` folder by folder.
//
// `node scripts/ts-rename.mjs [root]`, from a checkout (the root defaults to the current folder). It
// stays `.mjs`, and is the one source file that does, so it still runs on a branch that was cut before
// the rename: such a branch merges the default branch, then runs it again, and its own `.mjs` files
// follow. A second run changes nothing.
//
// Not renamed: `kit/dist/` (the bundle other repositories carry is still `kit/dist/omni.mjs`),
// `.omni-loop/bin/` (where a repository carries it; here, the shim onto the source) and this file.
// Not rewritten: the records that say what was true when they were written (the delivery records and
// the knowledge under `.omni-loop/`, the kit's porting notes, the design specs and plans under
// `docs/superpowers/`, the migrations, the recorded fixtures under a `fixtures/` folder) and the bundle, which only a build writes.
//
// A path is rewritten only when it names a file this run renames (or renamed before): read from the
// folder of the file that names it, from the repository root, from the folder of the package.json it
// sits under, or through a workspace package's name (`vertuo-omni-plan/kit/lib/config.mjs`). A glob or
// a template (`game/cli/*.mjs`, `./commands/${name}.mjs`) is rewritten when it matches a renamed file.
// A path no rule resolves (`.omni-loop/bin/omni.mjs`, another repository's file) stays as written.
// A declaration file naming a module that has its own hand-written `.d.mts` keeps naming it.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const KEEP = [/^kit\/dist\//, /^\.omni-loop\/bin\//, /^scripts\/ts-rename\.mjs$/];
const FROZEN = [/^kit\/dist\//, /^kit\/porting\//, /^docs\/superpowers\//, /^\.omni-loop\/delivery\//, /^\.omni-loop\/knowledge\//, /^supabase\/migrations\//, /(^|\/)fixtures\//];
const SKIP = [/(^|\/)node_modules\//, /^\.claude\/worktrees\//];
// This script and its test, whose fixture names `.mjs` paths on purpose.
const SELF = /^scripts\/ts-rename\.(mjs|test\.ts)$/;
const BINARY = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|eot|pdf|zip|gz|mp3|mp4|wav|ogg|webm|wasm)$/i;
const NOCHECK = '// @ts-nocheck';
// A run of path characters ending in `.mjs`, templates and globs included: `${…}` and `*` stand for
// any name.
const TOKEN = /(?:\$\{[^}\n]*\}|[A-Za-z0-9_@.\/*\-])*\.mjs(?![A-Za-z0-9_])/g;

function listFiles(root) {
  const out = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 });
  return [...new Set(out.split('\0').filter(Boolean))]
    .filter((path) => !SKIP.some((re) => re.test(path)))
    .filter((path) => existsSync(join(root, path)) && statSync(join(root, path)).isFile());
}

// Every workspace package by name, mapped to its folder relative to the root ('' for the root).
function packageDirs(files, root) {
  const names = new Map();
  for (const path of files) {
    if (posix.basename(path) !== 'package.json') continue;
    try {
      const { name } = JSON.parse(readFileSync(join(root, path), 'utf8'));
      if (typeof name === 'string') names.set(name, posix.dirname(path) === '.' ? '' : posix.dirname(path));
    } catch {
      // Not a package: a fixture or a template, named package.json.
    }
  }
  return names;
}

function globToRegExp(pattern) {
  let re = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === '$' && pattern[i + 1] === '{') {
      i = pattern.indexOf('}', i);
      re += '[^/]+';
    } else if (ch === '*' && pattern[i + 1] === '*') {
      i += 1;
      if (pattern[i + 1] === '/') i += 1;
      re += '(?:.*/)?';
    } else if (ch === '*') re += '[^/]*';
    else re += ch.replace(/[.+?^()|[\]\\{}]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

export function renameRepository(root) {
  const files = listFiles(root);
  const renames = new Map();
  for (const path of files) if (path.endsWith('.mjs') && !KEEP.some((re) => re.test(path))) renames.set(path, path.replace(/\.mjs$/, '.ts'));

  // A file renamed by an earlier run still answers to its old name, so a second run (or a branch that
  // merged the rename) resolves the same paths: the targets are every `.ts` file whose `.mjs` name is
  // free.
  const fileSet = new Set(files);
  const targets = new Set(renames.keys());
  for (const path of files) if (path.endsWith('.ts') && !path.endsWith('.d.ts') && !fileSet.has(path.replace(/\.ts$/, '.mjs'))) targets.add(path.replace(/\.ts$/, '.mjs'));
  const packages = packageDirs(files, root);
  const packageRoots = [...new Set(packages.values())].filter(Boolean).sort((a, b) => b.length - a.length);

  const bases = (from, token) => {
    const dir = posix.dirname(from) === '.' ? '' : posix.dirname(from);
    const out = [];
    if (token.startsWith('./') || token.startsWith('../')) return [posix.normalize(posix.join(dir, token))];
    if (token.startsWith('/')) return [];
    out.push(posix.normalize(posix.join(dir, token)), posix.normalize(token));
    const pkg = packageRoots.find((p) => from.startsWith(`${p}/`));
    if (pkg) out.push(posix.normalize(posix.join(pkg, token)));
    for (const [name, pdir] of packages) if (token.startsWith(`${name}/`)) out.push(posix.normalize(posix.join(pdir, token.slice(name.length + 1))));
    return out;
  };

  const names = (from, token) => {
    const wild = token.includes('*') || token.includes('${');
    // A pattern that starts with a wildcard (`*.test.mjs`, `${dir}/bin/omni.mjs`) names no folder of
    // its own: it may mean any repository's files, so it stays as written.
    if (wild && (token.startsWith('*') || token.startsWith('${'))) return null;
    for (const base of bases(from, token)) {
      if (base.startsWith('../')) continue;
      if (!wild && targets.has(base)) return base;
      if (wild) {
        const re = globToRegExp(base);
        for (const target of targets) if (re.test(target)) return base;
      }
    }
    return null;
  };

  const rewrite = (from, text) => {
    const declaration = /\.d\.(m|c)?ts$/.test(from);
    return text.replace(TOKEN, (token) => {
      if (token === '.mjs' || token.startsWith('.mjs')) return token;
      const base = names(from, token);
      if (!base) return token;
      if (declaration && fileSet.has(base.replace(/\.mjs$/, '.d.mts'))) return token;
      return token.replace(/\.mjs$/, '.ts');
    });
  };

  let changed = 0;
  for (const path of files) {
    if ((!renames.has(path) && FROZEN.some((re) => re.test(path))) || BINARY.test(path) || SELF.test(path)) continue;
    const target = renames.get(path) ?? path;
    const abs = join(root, path);
    const text = readFileSync(abs, 'utf8');
    if (text.includes('\0')) continue;
    let next = text.includes('.mjs') ? rewrite(target, text) : text;
    if (renames.has(path)) next = withNocheck(next);
    if (next !== text) {
      writeFileSync(abs, next);
      changed += 1;
    }
  }
  for (const [from, to] of renames) renameSync(join(root, from), join(root, to));
  return { renamed: renames.size, changed };
}

function withNocheck(text) {
  const lines = text.split('\n');
  const at = lines[0]?.startsWith('#!') ? 1 : 0;
  if (lines[at] === NOCHECK) return text;
  lines.splice(at, 0, NOCHECK);
  return lines.join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] ?? '.');
  const { renamed, changed } = renameRepository(root);
  process.stdout.write(`ts-rename: ${renamed} file(s) renamed, ${changed} file(s) rewritten in ${root}\n`);
}
