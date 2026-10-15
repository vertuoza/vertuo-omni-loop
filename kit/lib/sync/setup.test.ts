// The newcomer's setup facts (PRD 1990), with `claude` replaced by a fake and the sign-in read from a
// folder of the test's own: the two plugins, `not Claude: skipped`, a list that fails or runs out of
// time, and a sign-in missing, kept, expired and renewable. No test starts `claude` or reads a real home.
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import type { GatherIo } from './facts.ts';
import { claudePlugins, isSignedIn, setupFactsOf } from './setup.ts';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const ASK = 'https://omni.example.com';

type Call = { file: string; args: string; options: ExecFileSyncOptionsWithStringEncoding };

/** A gather for a repository whose `claude plugin list --json` answers `answer` (text, or an error thrown). */
function gather(answer: string | Error, overrides: Record<string, unknown> = {}): { io: GatherIo; calls: Call[] } {
  const { root, ctx } = makeRepo({ config: overrides });
  const calls: Call[] = [];
  const exec = (file: string, args: readonly string[], options: ExecFileSyncOptionsWithStringEncoding): string => {
    calls.push({ file, args: args.join(' '), options });
    if (answer instanceof Error) throw answer;
    return answer;
  };
  return { io: { cwd: root, root, config: ctx.config, exec, now: NOW }, calls };
}

const failure = (code: string): Error => Object.assign(new Error('claude failed'), { code });
const LIST = JSON.stringify([
  { id: 'omni@omni-loop', version: '0.0.423', scope: 'user' },
  { id: 'omni-hud@omni-loop', version: '0.0.423', scope: 'user' },
  { id: 'other@elsewhere', version: '1.0.0' },
  null,
]);

/** A home whose credentials hold `entry` for the page's host. */
function homeWith(entry: unknown): string {
  const home = mkdtempSync(join(tmpdir(), 'omni-sync-home-'));
  mkdirSync(join(home, '.config', 'omni'), { recursive: true });
  writeFileSync(join(home, '.config', 'omni', 'credentials.json'), JSON.stringify({ 'omni.example.com': entry }));
  return home;
}

describe('claudePlugins', () => {
  it('lists the installed plugins by id with their versions, asking claude once for the whole run', () => {
    const { io, calls } = gather(LIST);
    const first = claudePlugins(io);
    expect(first).toEqual({ installed: new Map([['omni@omni-loop', '0.0.423'], ['omni-hud@omni-loop', '0.0.423'], ['other@elsewhere', '1.0.0']]) });
    expect(claudePlugins(io)).toBe(first);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ file: 'claude', args: 'plugin list --json' });
    expect(calls[0]?.options.timeout).toBe(10_000);
  });

  it('keeps a plugin whose list gives no version as installed with none', () => {
    const { io } = gather(JSON.stringify([{ id: 'omni@omni-loop' }]));
    expect(claudePlugins(io)).toEqual({ installed: new Map([['omni@omni-loop', null]]) });
  });

  it('is null without a claude command, and says why it could not read one that failed', () => {
    expect(claudePlugins(gather(failure('ENOENT')).io)).toBeNull();
    expect(claudePlugins(gather(failure('ETIMEDOUT')).io)).toEqual({ notChecked: 'timed out' });
    expect(claudePlugins(gather(new Error('boom')).io)).toEqual({ notChecked: 'claude plugin list failed' });
    expect(claudePlugins(gather('not json').io)).toEqual({ notChecked: 'claude plugin list failed' });
    expect(claudePlugins(gather('{"id":"omni@omni-loop"}').io)).toEqual({ notChecked: 'claude plugin list was unreadable' });
  });
});

describe('isSignedIn', () => {
  it('is signed in with a stored sign-in that has not expired, in seconds or milliseconds', () => {
    const soon = (NOW + 3_600_000) / 1000;
    expect(isSignedIn({ askUrl: ASK, home: homeWith({ access_token: 'a', expires_at: soon }), now: NOW })).toBe(true);
    expect(isSignedIn({ askUrl: ASK, home: homeWith({ access_token: 'a', expires_at: NOW + 3_600_000 }), now: NOW })).toBe(true);
    expect(isSignedIn({ askUrl: ASK, home: homeWith({ access_token: 'a' }), now: NOW })).toBe(true);
  });

  it('is not signed in with no stored sign-in, or an expired one nothing can renew', () => {
    expect(isSignedIn({ askUrl: ASK, home: mkdtempSync(join(tmpdir(), 'omni-sync-home-')), now: NOW })).toBe(false);
    expect(isSignedIn({ askUrl: ASK, home: homeWith({ access_token: 'a', expires_at: (NOW - 1000) / 1000 }), now: NOW })).toBe(false);
  });

  it('keeps an expired access token signed in while a refresh token can renew it', () => {
    expect(isSignedIn({ askUrl: ASK, home: homeWith({ access_token: 'a', refresh_token: 'r', expires_at: (NOW - 1000) / 1000 }), now: NOW })).toBe(true);
  });

  it('counts a repository with no page address as signed in: there is nothing to sign in to', () => {
    expect(isSignedIn({ askUrl: null, home: homeWith({}), now: NOW })).toBe(true);
  });
});

describe('setupFactsOf', () => {
  const home = homeWith({ access_token: 'a', expires_at: (NOW + 3_600_000) / 1000 });
  const config = { ask: { url: ASK } };

  it('reads the two plugins done and the sign-in held', () => {
    const { io } = gather(LIST, config);
    expect(setupFactsOf(io, { home })).toEqual({
      claude: true,
      plugin: { done: true, fix: '/plugin install omni@omni-loop' },
      hud: { done: true, fix: '/plugin install omni-hud@omni-loop' },
      signedIn: true,
    });
  });

  it('reads each missing plugin open, with the line that installs it, and a missing sign-in open', () => {
    const { io } = gather(JSON.stringify([{ id: 'omni@omni-loop', version: '0.0.423' }]), config);
    expect(setupFactsOf(io, { home: mkdtempSync(join(tmpdir(), 'omni-sync-home-')) })).toEqual({
      claude: true,
      plugin: { done: true, fix: '/plugin install omni@omni-loop' },
      hud: { done: false, fix: '/plugin install omni-hud@omni-loop' },
      signedIn: false,
    });
  });

  it('says no claude without the command, so the plugin steps read skipped', () => {
    const { io } = gather(failure('ENOENT'), config);
    expect(setupFactsOf(io, { home })).toMatchObject({ claude: false, plugin: { done: true }, hud: { done: true } });
  });

  it('never holds a person in setup on a claude that fails or runs out of time', () => {
    for (const error of [failure('ETIMEDOUT'), new Error('boom')]) {
      const { io } = gather(error, config);
      expect(setupFactsOf(io, { home })).toMatchObject({ claude: true, plugin: { done: true }, hud: { done: true } });
    }
  });
});
