// The block `omni sync` prints (PRD 1990, spec sections 1 and 3), from a run's record alone.
import { describe, expect, it } from 'vitest';
import { parseConfig } from '../config.ts';
import type { SyncFacts } from './facts.ts';
import { syncLines } from './render.ts';
import { syncStatus } from './status.ts';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const HOUR = 3_600_000;
const SYNC = parseConfig('kit: 1\n').sync;

const facts = (over: Partial<SyncFacts> = {}): SyncFacts => ({
  now: NOW,
  setupDoneAt: '2026-10-01T09:00:00.000Z',
  defaultBranch: 'main',
  main: { remote: 'origin', defaultBranch: 'main', linked: false, branch: 'main', behind: { count: 2, oldestAt: NOW - 3 * HOUR }, changed: 0, unpushed: 0 },
  kit: {
    latest: '0.0.423',
    repo: '0.0.418',
    plugins: [{ name: 'omni@omni-loop', label: 'plugin', version: '0.0.420', fix: 'x' }],
    targets: [],
  },
  knowledge: { staleEvidence: 0, targets: null, changed: 0 },
  page: { signedIn: true, syncedAt: NOW - 5 * 60_000, answering: true },
  setup: { claude: true, plugin: { done: true, fix: 'p' }, hud: { done: true, fix: 'h' }, signedIn: true },
  ...over,
});

describe('syncLines', () => {
  it('prints the status line, one line per check in weight order, and the fix line (spec section 1)', () => {
    expect(syncLines(syncStatus(facts(), SYNC))).toEqual([
      '🟠 Needs action · repo kit v0.0.418, latest v0.0.423',
      '  main       🟢 on main, 2 behind (the oldest 3 h old)',
      '  kit        🟠 repo kit v0.0.418, latest v0.0.423 → omni sync --fix',
      '             🟠 plugin v0.0.420, latest v0.0.423 → omni sync --fix',
      '  knowledge  🟢 in sync',
      '  page       🟢 signed in · synced 5 min ago',
      "fix: omni sync --fix  (updates the plugins, opens the kit's update PR)",
    ]);
  });

  it('prints green with no headline and no fix line, and off for a check whose level is off', () => {
    const sync = parseConfig('kit: 1\nsync:\n  levels:\n    kit: off\n').sync;
    expect(syncLines(syncStatus(facts({ kit: null }), sync))).toEqual([
      '🟢 In sync',
      '  main       🟢 on main, 2 behind (the oldest 3 h old)',
      '  kit        off',
      '  knowledge  🟢 in sync',
      '  page       🟢 signed in · synced 5 min ago',
    ]);
  });

  it('prints red, with the main check heading it', () => {
    const lines = syncLines(syncStatus(facts({ kit: { na: 'not checked yet' }, main: { remote: 'origin', defaultBranch: 'main', linked: false, branch: 'main', behind: { count: 14, oldestAt: NOW - 50 * HOUR }, changed: 0, unpushed: 0 } }), SYNC));
    expect(lines[0]).toBe('🔴 Out of sync · main is 14 behind, the oldest 2 d old');
    expect(lines[1]).toBe('  main       🔴 main is 14 behind, the oldest 2 d old → omni sync --fix');
    expect(lines[2]).toBe('  kit        🟢 n/a · not checked yet');
    expect(lines.at(-1)).toBe('fix: omni sync --fix  (fast-forwards main)');
  });

  it("prints a newcomer's checklist in place of the checks (spec section 3)", () => {
    const setup = { claude: true, plugin: { done: true, fix: 'p' }, hud: { done: true, fix: 'h' }, signedIn: false };
    const main = { remote: 'origin', defaultBranch: 'main', linked: false, branch: 'main', behind: { count: 9, oldestAt: NOW - 30 * HOUR }, changed: 0, unpushed: 0 };
    expect(syncLines(syncStatus(facts({ setupDoneAt: null, setup, main }), SYNC))).toEqual([
      '🔵 Setting up · 2 of 4',
      '  ✓ Omni plugin installed',
      '  ✓ HUD plugin installed',
      '  · Sign in to the Omni page → omni signin',
      '  · Pull main → omni sync --fix',
    ]);
  });
});
