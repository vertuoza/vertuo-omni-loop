// What the runner reads of T3 Code's own files (PRD 2537, s4), on a fixture T3 home in
// `../fixtures/t3/home/`, shaped as T3 0.1.3 keeps it: `userdata/settings.json` (the provider
// instances), `userdata/server-runtime.json` (the running server, its pid and origin) and
// `caches/<instance>.json` (each instance's status, its sign-in among it). No test runs T3.
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { t3ClaudeProjects, t3HomeOf, t3Instance, t3Origin } from './t3-home.ts';

const FIXTURE = join(import.meta.dirname, '..', 'fixtures', 't3', 'home');
const HOME = '/home/runner';
const alive = (pid: number): boolean => pid === 4242;

/** A copy of the fixture T3 home, to change. */
function copy(): string {
  const t3Home = mkdtempSync(join(tmpdir(), 'omni-t3-home-'));
  cpSync(FIXTURE, t3Home, { recursive: true });
  return t3Home;
}

describe('the T3 home', () => {
  it('is ~/.t3', () => {
    expect(t3HomeOf(HOME)).toBe('/home/runner/.t3');
  });
});

describe('the running server', () => {
  it('is the origin its runtime file names while its process lives', () => {
    expect(t3Origin(FIXTURE, alive)).toBe('http://127.0.0.1:3799');
  });

  it('is none when its process is gone, its file is missing or does not parse', () => {
    expect(t3Origin(FIXTURE, () => false)).toBeNull();
    const t3Home = copy();
    rmSync(join(t3Home, 'userdata', 'server-runtime.json'));
    expect(t3Origin(t3Home, alive)).toBeNull();
    expect(t3Origin(join(tmpdir(), 'omni-t3-none'), alive)).toBeNull();
  });
});

describe('a provider instance', () => {
  it('reads a Claude instance: its driver, its sign-in, and the Claude folder its homePath names', () => {
    expect(t3Instance(FIXTURE, HOME, 'claude-b')).toEqual({ id: 'claude-b', driver: 'claudeAgent', claude: true, enabled: true, signedIn: true, projects: '/home/runner/.claude-b/projects' });
  });

  it("reads T3's default Claude instance, its id its driver's, in the machine's own Claude folder", () => {
    expect(t3Instance(FIXTURE, HOME, 'claudeAgent')).toEqual({ id: 'claudeAgent', driver: 'claudeAgent', claude: true, enabled: true, signedIn: true, projects: '/home/runner/.claude/projects' });
  });

  it('reads a Codex instance that is not signed in, and an OpenCode one that is: neither keeps Claude transcripts', () => {
    expect(t3Instance(FIXTURE, HOME, 'codex-1')).toEqual({ id: 'codex-1', driver: 'codex', claude: false, enabled: true, signedIn: false, projects: null });
    expect(t3Instance(FIXTURE, HOME, 'opencode')).toMatchObject({ driver: 'opencode', claude: false, signedIn: true });
  });

  it('reads a disabled instance as such, and one T3 never checked as not signed in', () => {
    expect(t3Instance(FIXTURE, HOME, 'claude-off')).toMatchObject({ enabled: false, signedIn: false });
  });

  it('is none when T3 knows no such instance, or holds no settings at all', () => {
    expect(t3Instance(FIXTURE, HOME, 'claude-9')).toBeNull();
    expect(t3Instance(join(tmpdir(), 'omni-t3-none'), HOME, 'claude-b')).toBeNull();
  });

  it('takes an absolute homePath as it is, and expands ~ with the home given', () => {
    const t3Home = copy();
    writeFileSync(join(t3Home, 'userdata', 'settings.json'), JSON.stringify({ providerInstances: { 'claude-c': { driver: 'claudeAgent', config: { homePath: '/srv/claude-c' } } } }));
    expect(t3Instance(t3Home, HOME, 'claude-c')?.projects).toBe('/srv/claude-c/projects');
    expect(t3Instance(FIXTURE, '/elsewhere', 'claude-b')?.projects).toBe('/elsewhere/.claude-b/projects');
  });
});

describe("the Claude folders of a runner's T3 accounts", () => {
  it('lists the folder of each Claude instance named, once, and none for another agent or an unknown one', () => {
    expect(t3ClaudeProjects(FIXTURE, HOME, ['claude-b', 'codex-1', 'claudeAgent', 'claude-b', 'claude-9'])).toEqual(['/home/runner/.claude-b/projects', '/home/runner/.claude/projects']);
  });
});
