// `omni sync --fix`'s steps that act through another command (PRD 1990, spec section 7): which of
// the plugins, the kit and the page's copy a run's record leaves open for `--fix`, and what the
// steps print, with the three actions replaced by fakes. The steps on `git` are tested through the
// command, on fixture repositories (`kit/bin/sync-fix.test.ts`).
import { describe, expect, it } from 'vitest';
import { parseConfig } from '../config.ts';
import type { Config } from '../types.ts';
import type { KitFacts, PageFacts, SyncFacts } from './facts.ts';
import { fixOthers, openFixes } from './fix.ts';
import type { FixActions, FixStep } from './fix.ts';
import { syncStatus } from './status.ts';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const HOUR = 3_600_000;
const syncOf = (yaml = ''): Config['sync'] => parseConfig(`kit: 1\n${yaml}`).sync;

const PLUGIN = { name: 'omni@omni-loop', label: 'plugin', version: '0.0.423', fix: '/plugin install omni@omni-loop' };
const HUD = { name: 'omni-hud@omni-loop', label: 'HUD plugin', version: '0.0.423', fix: '/plugin install omni-hud@omni-loop' };
const KIT = { latest: '0.0.423', repo: '0.0.423', plugins: [PLUGIN, HUD], targets: [] } satisfies KitFacts;
const PAGE = { signedIn: true, syncedAt: NOW - HOUR, answering: true } satisfies PageFacts;

/** A record from facts in sync but for `over`, under `yaml`'s `sync` block. */
function recordOf(over: Partial<SyncFacts> = {}, yaml = '') {
  const facts: SyncFacts = {
    now: NOW,
    setupDoneAt: '2026-10-01T09:00:00.000Z',
    defaultBranch: 'main',
    main: { remote: 'origin', defaultBranch: 'main', linked: false, branch: 'main', behind: { count: 0, oldestAt: null }, changed: 0, unpushed: 0 },
    kit: KIT,
    knowledge: { staleEvidence: 0, targets: null, changed: 0 },
    page: PAGE,
    setup: { claude: true, plugin: { done: true, fix: PLUGIN.fix }, hud: { done: true, fix: HUD.fix }, signedIn: true },
    ...over,
  };
  return syncStatus(facts, syncOf(yaml));
}

/** Fake actions: each records its call and answers `done`. */
function fakes(done: Partial<Record<FixStep, boolean>> = {}) {
  const calls: FixStep[] = [];
  const act = (step: FixStep) => () => {
    calls.push(step);
    return done[step] === false ? { done: false, lines: [`${step} said no`, 'its second line'] } : { done: true, lines: [`${step} said yes`] };
  };
  const actions: FixActions = { plugins: act('plugins'), kit: act('kit'), page: act('page') };
  return { actions, calls };
}

describe('openFixes', () => {
  it('finds nothing to do when everything is in sync', () => {
    expect(openFixes(recordOf())).toEqual([]);
  });

  it('finds the plugins, the kit and the page, in the order --fix runs them', () => {
    const record = recordOf({
      kit: { ...KIT, repo: '0.0.418', plugins: [{ ...PLUGIN, version: '0.0.420' }, HUD] },
      page: { ...PAGE, syncedAt: NOW - 30 * HOUR },
    });
    expect(openFixes(record)).toEqual(['plugins', 'kit', 'page']);
  });

  it('finds the HUD plugin behind alone, and the repository kit alone', () => {
    expect(openFixes(recordOf({ kit: { ...KIT, plugins: [PLUGIN, { ...HUD, version: '0.0.1' }] } }))).toEqual(['plugins']);
    expect(openFixes(recordOf({ kit: { ...KIT, repo: '0.0.1' } }))).toEqual(['kit']);
  });

  it('leaves what --fix does not fix: a plugin not installed, a target kit, no sign-in', () => {
    const record = recordOf({
      kit: { ...KIT, plugins: [{ ...PLUGIN, version: null }, HUD], targets: [{ repo: 'acme/api', version: '0.0.1' }] },
      page: { ...PAGE, signedIn: false },
    });
    expect(record.status).toBe('orange');
    expect(openFixes(record)).toEqual([]);
  });

  it('finds nothing in a check whose level is off', () => {
    const record = recordOf({ kit: null, page: null }, 'sync:\n  levels:\n    kit: off\n    page: off\n');
    expect(openFixes(record)).toEqual([]);
  });

  it('finds the page when it never synced, and when it did not answer', () => {
    expect(openFixes(recordOf({ page: { ...PAGE, syncedAt: null } }))).toEqual(['page']);
    expect(openFixes(recordOf({ page: { ...PAGE, answering: false } }))).toEqual(['page']);
  });
});

describe('fixOthers', () => {
  const behind = recordOf({ kit: { ...KIT, repo: '0.0.418', plugins: [{ ...PLUGIN, version: '0.0.420' }, HUD] }, page: { ...PAGE, syncedAt: null } });

  it('runs nothing when nothing is open', () => {
    const { actions, calls } = fakes();
    expect(fixOthers({ record: recordOf(), kitRepo: false, actions })).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('runs the plugins, the kit and the page in order, a ✓ line for each, with what each said', () => {
    const { actions, calls } = fakes();
    expect(fixOthers({ record: behind, kitRepo: false, actions })).toEqual([
      '✓ updated the plugins: a new session loads them',
      '    plugins said yes',
      '✓ ran omni update',
      '    kit said yes',
      "✓ refreshed the page's copy",
      '    page said yes',
    ]);
    expect(calls).toEqual(['plugins', 'kit', 'page']);
  });

  it('prints why it left each step that did not go through, and carries on', () => {
    const { actions, calls } = fakes({ plugins: false, kit: false, page: false });
    expect(fixOthers({ record: behind, kitRepo: false, actions })).toEqual([
      '· the plugins not updated:',
      '    plugins said no',
      '    its second line',
      '· the kit not updated:',
      '    kit said no',
      '    its second line',
      "· the page's copy not refreshed:",
      '    page said no',
      '    its second line',
    ]);
    expect(calls).toEqual(['plugins', 'kit', 'page']);
  });

  it("never updates the kit in the kit's own repository, and says so", () => {
    const { actions, calls } = fakes();
    const lines = fixOthers({ record: recordOf({ kit: { ...KIT, repo: '0.0.1' } }), kitRepo: true, actions });
    expect(lines).toEqual(["· the kit not updated: this is the kit's own repository, where it is built, not installed"]);
    expect(calls).toEqual([]);
  });
});
