// `omni conventions` (PRD 2049, s1): the index of the files where a directory writes its conventions,
// through `main()` on fixture directories. Nothing here calls git, GitHub or any process.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readConventions } from '../lib/conventions/conventions.ts';
import { main } from './omni.ts';

/** A fresh directory holding `files` (path -> content). */
function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'omni-conventions-'));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

async function run(argv: readonly string[], cwd: string) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } });
  return { code, out: out.join(''), err: err.join('') };
}

const paths = (root: string) => readConventions(root).map((entry) => entry.path);

/** A directory shaped like vertuo-backend-php. */
const BACKEND = {
  'CLAUDE.md': '# Backend\n\n| Task | Read |\n| --- | --- |\n| Migration | [migrations](docs/migrations.md) |\n',
  'docs/readme.md': '# Docs\n',
  'docs/migrations.md': '# Migrations\n\nAudit timestamps use `_created_at`.\n',
  'docs/adr/readme.md': '# Decisions\n',
};

describe('omni conventions', () => {
  it('prints the index of a directory shaped like vertuo-backend-php, with title and origin (the PRD 278 regression)', async () => {
    const root = fixture(BACKEND);
    const { code, out } = await run(['conventions', '--root', root], process.cwd());
    expect(code).toBe(0);
    expect(out).toContain('CLAUDE.md  Backend  (from .)');
    expect(out).toContain('docs/readme.md  Docs  (from docs/)');
    expect(out).toContain('docs/adr/readme.md  Decisions  (from docs/adr/)');
    expect(out).toContain('docs/migrations.md  Migrations  (from CLAUDE.md)');
  });

  it('reads the current directory by default, with no .omni-loop folder', async () => {
    const root = fixture(BACKEND);
    const { code, out } = await run(['conventions'], root);
    expect(code).toBe(0);
    expect(out).toContain('docs/migrations.md');
  });

  it('refuses a --root that does not exist with one line and a non-zero exit', async () => {
    const root = fixture({});
    const { code, out } = await run(['conventions', '--root', join(root, 'nope')], root);
    expect(code).toBe(1);
    expect(out.trim().split('\n')).toHaveLength(1);
    expect(out).toContain('is not a directory');
  });

  it('prints the same entries as an array with --json', async () => {
    const root = fixture({ 'CLAUDE.md': '# Rules\n[gone](docs/gone.md)\n' });
    const { code, out } = await run(['conventions', '--root', root, '--json'], root);
    expect(code).toBe(0);
    expect(JSON.parse(out)).toEqual([
      { path: 'CLAUDE.md', title: 'Rules', from: '.', missing: false },
      { path: 'docs/gone.md', title: 'gone.md', from: 'CLAUDE.md', missing: true },
    ]);
  });

  it('says so when a directory writes no conventions', async () => {
    const root = fixture({ 'a.txt': 'x' });
    const { code, out } = await run(['conventions'], root);
    expect(code).toBe(0);
    expect(out).toContain('no written conventions found');
  });

  it('refuses a stray argument and an unknown flag as usage errors', async () => {
    const root = fixture({});
    expect((await run(['conventions', 'extra'], root)).code).toBe(2);
    expect((await run(['conventions', '--nope'], root)).code).toBe(2);
  });

  it('is described by omni help conventions', async () => {
    const { code, out } = await run(['help', 'conventions'], process.cwd());
    expect(code).toBe(0);
    expect(out).toContain('omni conventions [--root <dir>] [--json]');
  });
});

describe('readConventions', () => {
  it('follows an @ import of CLAUDE.md to AGENTS.md', () => {
    const root = fixture({ 'CLAUDE.md': '@AGENTS.md\n', 'AGENTS.md': '# Agents\n' });
    expect(readConventions(root)).toEqual([
      { path: 'CLAUDE.md', title: 'CLAUDE.md', from: '.', missing: false },
      { path: 'AGENTS.md', title: 'Agents', from: 'CLAUDE.md', missing: false },
    ]);
  });

  it('reads paths.context from .omni-loop/config.yml', () => {
    const root = fixture({
      '.omni-loop/config.yml': 'paths:\n  context:\n    - notes/rules.md\n    - notes/absent.md\n',
      'notes/rules.md': '# Rules\n',
    });
    expect(readConventions(root)).toEqual([
      { path: 'notes/rules.md', title: 'Rules', from: '.omni-loop/config.yml', missing: false },
      { path: 'notes/absent.md', title: 'absent.md', from: '.omni-loop/config.yml', missing: true },
    ]);
  });

  it.each(['readme.md', 'README.md', 'index.md'])('finds the docs readme as %s', (name) => {
    expect(paths(fixture({ [`docs/${name}`]: '# Docs\n' }))).toEqual([`docs/${name}`]);
  });

  it('lists each ADR with its title when docs/adr has no readme', () => {
    const entries = readConventions(fixture({ 'docs/adr/0001-a.md': '# One\n', 'docs/adr/0002-b.md': '# Two\n', 'docs/adr/img.png': 'x' }));
    expect(entries.map((entry) => [entry.path, entry.title])).toEqual([
      ['docs/adr/0001-a.md', 'One'],
      ['docs/adr/0002-b.md', 'Two'],
    ]);
  });

  it('leaves out a link outside the directory, a non-Markdown link, a URL and a page two links away', () => {
    const root = fixture({
      'CLAUDE.md': '# C\n[out](../elsewhere.md) [img](docs/a.png) [web](https://x.dev/a.md) [one](docs/one.md#top)\n',
      'docs/one.md': '# One\n[two](two.md)\n',
      'docs/two.md': '# Two\n',
    });
    expect(paths(root)).toEqual(['CLAUDE.md', 'docs/one.md']);
  });

  it('lists a file once, whoever links to it', () => {
    const root = fixture({
      'CLAUDE.md': '# C\n[r](docs/readme.md) [m](docs/m.md)\n',
      'docs/readme.md': '# Docs\n[m](m.md)\n',
      'docs/m.md': '# M\n',
    });
    expect(paths(root)).toEqual(['CLAUDE.md', 'docs/readme.md', 'docs/m.md']);
  });

  it('ignores links inside fenced code blocks', () => {
    const root = fixture({ 'CLAUDE.md': '# C\n```\n[x](docs/x.md)\n```\n', 'docs/x.md': '# X\n' });
    expect(paths(root)).toEqual(['CLAUDE.md']);
  });
});
