// The engine page reaches a repository that uses the kit (PRD 1108 s6): such a repository holds only its
// copy of the bundle, so the bundle carries the page, and `omni pitch studio` run from a lone copy of it,
// with no kit beside it, serves the page byte for byte as `pnpm kit:build` wrote it. From source, the
// page is read from kit/dist/pitch-engine/.
import { execFileSync, spawn } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ENGINE_FILES, enginePage, readEnginePage } from './render-page.ts';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const BUILT = join(repoRoot, 'kit/dist/pitch-engine');
const built = (file: string): string => readFileSync(join(BUILT, file), 'utf8');

describe('enginePage', () => {
  it("from source, is the built page's two files", () => {
    const page = enginePage();
    for (const file of ENGINE_FILES) expect(page[file], file).toBe(built(file));
    expect(readEnginePage(BUILT)).toEqual(page);
  });
});

/** The first line a child writes on stdout. */
const firstLine = (child: ReturnType<typeof spawn>): Promise<string> =>
  new Promise((done, fail) => {
    let text = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      text += chunk.toString('utf8');
      if (text.includes('\n')) done(text.slice(0, text.indexOf('\n')));
    });
    let errors = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      errors += chunk.toString('utf8');
    });
    child.on('exit', (code) => {
      fail(new Error(`omni exited ${String(code)} before printing the page's address: ${errors}`));
    });
  });

describe('the committed bundle', () => {
  it('carries the engine page: a lone copy of it serves the page from omni pitch studio', async () => {
    // A repository that installed the kit: its config, and the bundle as its bin, nothing else.
    const home = mkdtempSync(join(tmpdir(), 'pitch-bundle-'));
    execFileSync('git', ['init', '-q'], { cwd: home });
    mkdirSync(join(home, '.omni-loop/bin'), { recursive: true });
    writeFileSync(join(home, '.omni-loop/config.yml'), 'kit: 1\n');
    copyFileSync(join(repoRoot, 'kit/dist/omni.mjs'), join(home, '.omni-loop/bin/omni.mjs'));
    cpSync(join(repoRoot, 'kit/test/fixtures/pitch/run'), join(home, 'run'), { recursive: true });
    const child = spawn('node', [join(home, '.omni-loop/bin/omni.mjs'), 'pitch', 'studio', 'run', '--no-open'], { cwd: home, stdio: ['ignore', 'pipe', 'pipe'] });
    const exited = new Promise<number | null>((done) => child.on('exit', done));
    try {
      const url = await firstLine(child);
      expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/engine\/index\.html\?studio=/);
      expect(await (await fetch(url)).text()).toBe(built('index.html'));
      expect(await (await fetch(new URL('/engine/engine.js', url))).text()).toBe(built('engine.js'));
      expect(((await (await fetch(new URL('/run/input.json', url))).json()) as { look: { preset: string } }).look.preset).toBe('keynote');
    } finally {
      child.kill('SIGINT');
    }
    expect(await exited).toBe(0);
  });
});
