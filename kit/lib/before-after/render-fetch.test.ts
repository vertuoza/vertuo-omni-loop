// Bug #3315: a repository without Playwright (a PHP back-end, for one) still gets its before/after
// diagrams drawn. The kit fetches a pinned Playwright into its own cache, outside the repository, and
// the browser it needs, instead of asking anyone to install either. The fetch is a fake `exec` that
// writes a fake Playwright package: no test reaches npm, the network or a real browser.
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repositoryLaunch } from './render.ts';

/** A fake Playwright package in `dir`: `chromium.launch()` fails like Playwright's own until `browser-installed` exists, when `needsBrowser`. */
function writeFakePlaywright(dir: string, needsBrowser: boolean): void {
  const home = join(dir, 'node_modules', 'playwright');
  mkdirSync(home, { recursive: true });
  writeFileSync(join(home, 'package.json'), JSON.stringify({ name: 'playwright', main: 'index.mjs' }));
  writeFileSync(join(home, 'cli.js'), '');
  const marker = JSON.stringify(join(home, 'browser-installed'));
  writeFileSync(
    join(home, 'index.mjs'),
    `import { existsSync } from 'node:fs';\n` +
      `export const chromium = { launch: async () => {\n` +
      `  if (${String(needsBrowser)} && !existsSync(${marker})) throw new Error("browserType.launch: Executable doesn't exist at /x/chrome-headless-shell");\n` +
      `  return { newPage: async () => ({}), close: async () => {}, fake: 'fetched' };\n` +
      `} };\n`,
  );
}

/** An `exec` that plays npm and Playwright's CLI on the fake package, logging each call. */
function fakeExec({ npmFails = false, needsBrowser = false } = {}) {
  const calls: string[] = [];
  const exec = (file: string, args: readonly string[]): string => {
    calls.push([file, ...args].join(' '));
    const prefix = args.indexOf('--prefix');
    if (file === 'npm') {
      if (npmFails) throw new Error('Command failed: npm install\nnpm error code ENOTFOUND\nnpm error network request failed');
      writeFakePlaywright(args[prefix + 1] ?? '', needsBrowser);
      return '';
    }
    const cli = args[0] ?? '';
    if (args.includes('install')) writeFileSync(join(cli, '..', 'browser-installed'), '');
    return '';
  };
  return { exec, calls };
}

const emptyRepo = (): string => mkdtempSync(join(tmpdir(), 'omni-3315-repo-'));
const emptyCache = (): string => join(mkdtempSync(join(tmpdir(), 'omni-3315-cache-')), 'playwright');

describe('repositoryLaunch, in a repository without Playwright (#3315)', () => {
  it('fetches a pinned Playwright into the kit cache, never the repository, and starts its browser', async () => {
    const repo = emptyRepo();
    const cache = emptyCache();
    const { exec, calls } = fakeExec();
    const browser = await repositoryLaunch(repo, { cache, exec })();
    expect(browser).toMatchObject({ fake: 'fetched' });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(/^npm install .*--prefix .*playwright@\d+\.\d+\.\d+$/);
    expect(existsSync(join(repo, 'node_modules'))).toBe(false);
  });

  it('fetches nothing the second time: the cached Playwright is used', async () => {
    const cache = emptyCache();
    const first = fakeExec();
    await repositoryLaunch(emptyRepo(), { cache, exec: first.exec })();
    const second = fakeExec();
    await repositoryLaunch(emptyRepo(), { cache, exec: second.exec })();
    expect(second.calls).toEqual([]);
  });

  it("installs Chromium through Playwright's own CLI when its browser is missing, then starts it", async () => {
    const cache = emptyCache();
    const { exec, calls } = fakeExec({ needsBrowser: true });
    const browser = await repositoryLaunch(emptyRepo(), { cache, exec })();
    expect(browser).toMatchObject({ fake: 'fetched' });
    expect(calls[1]).toMatch(/cli\.js install chromium$/);
  });

  it('says why the fetch failed, never asking anyone to install Playwright', async () => {
    const { exec } = fakeExec({ npmFails: true });
    const launched = repositoryLaunch(emptyRepo(), { cache: emptyCache(), exec })();
    await expect(launched).rejects.toThrow('could not fetch Playwright: npm error network request failed');
    await expect(launched).rejects.not.toThrow(/install/i);
  });
});
