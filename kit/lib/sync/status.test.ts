// `omni sync`'s rules (PRD 1990), on fact objects alone: each check's findings, the levels, the
// headline, `mainRedAfter`, and the newcomer's four steps.
import { describe, expect, it } from 'vitest';
import { parseConfig } from '../config.ts';
import type { Config } from '../types.ts';
import type { KitFacts, KnowledgeFacts, MainFacts, PageFacts, SetupFacts, SyncFacts } from './facts.ts';
import { durationText, syncStatus } from './status.ts';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const DONE_AT = '2026-10-01T09:00:00.000Z';

const syncOf = (yaml = ''): Config['sync'] => parseConfig(`kit: 1\n${yaml}`).sync;
const DEFAULTS = syncOf();

const MAIN: MainFacts = {
  remote: 'origin',
  defaultBranch: 'main',
  linked: false,
  branch: 'main',
  behind: { count: 0, oldestAt: null },
  changed: 0,
  unpushed: 0,
};
const KIT: KitFacts = { latest: '0.0.423', repo: '0.0.423', plugins: [], targets: [] };
const KNOWLEDGE: KnowledgeFacts = { staleEvidence: 0, targets: null, changed: 0 };
const PAGE: PageFacts = { signedIn: true, syncedAt: NOW - 5 * MINUTE, answering: true };
const SETUP: SetupFacts = { claude: true, plugin: { done: true, fix: '/plugin install omni@omni-loop' }, hud: { done: true, fix: '/plugin install omni-hud@omni-loop' }, signedIn: true };

/** A run's facts: everything in sync and set up, but for what `over` says. */
const facts = (over: Partial<SyncFacts> = {}): SyncFacts => ({
  now: NOW,
  setupDoneAt: DONE_AT,
  defaultBranch: 'main',
  main: MAIN,
  kit: KIT,
  knowledge: KNOWLEDGE,
  page: PAGE,
  setup: SETUP,
  ...over,
});

/** The findings of one check, as `[severity, text, fix]`. */
const of = (record: ReturnType<typeof syncStatus>, check: string) =>
  record.findings.filter((finding) => finding.check === check).map(({ severity, text, fix }) => [severity, text, fix]);

const behind = (count: number, age: number): MainFacts => ({ ...MAIN, behind: { count, oldestAt: NOW - age } });

describe('durationText', () => {
  it('says a span in its largest whole unit', () => {
    expect([0, 40_000, 5 * MINUTE, 3 * HOUR + 59 * MINUTE, 2 * DAY + HOUR, -5].map(durationText)).toEqual(['0 s', '40 s', '5 min', '3 h', '2 d', '0 s']);
  });
});

describe('syncStatus — everything in sync', () => {
  it('is green with no headline and no fix line, one green finding per check in the weight order', () => {
    const record = syncStatus(facts(), DEFAULTS);
    expect(record).toEqual({
      checkedAt: '2026-10-15T12:00:00.000Z',
      status: 'green',
      headline: null,
      setupDoneAt: DONE_AT,
      setup: null,
      fix: null,
      findings: [
        { check: 'main', severity: 'green', text: 'on main, up to date with origin/main', fix: null },
        { check: 'kit', severity: 'green', text: 'in sync', fix: null },
        { check: 'knowledge', severity: 'green', text: 'in sync', fix: null },
        { check: 'page', severity: 'green', text: 'signed in · synced 5 min ago', fix: null },
      ],
    });
  });

  it('reads a check that does not apply as green n/a', () => {
    const record = syncStatus(facts({ kit: { na: 'not checked yet' }, page: { na: 'no Omni page' } }), DEFAULTS);
    expect(of(record, 'kit')).toEqual([['green', 'n/a · not checked yet', null]]);
    expect(of(record, 'page')).toEqual([['green', 'n/a · no Omni page', null]]);
    expect(record.status).toBe('green');
  });
});

describe('syncStatus — the main check', () => {
  it('is green behind by commits younger than mainRedAfter, and red past it: 23 h 59 against 24 h 01', () => {
    const young = syncStatus(facts({ main: behind(2, 23 * HOUR + 59 * MINUTE) }), DEFAULTS);
    expect(of(young, 'main')).toEqual([['green', 'on main, 2 behind (the oldest 23 h old)', null]]);
    expect(young.status).toBe('green');
    const old = syncStatus(facts({ main: behind(14, 24 * HOUR + MINUTE) }), DEFAULTS);
    expect(of(old, 'main')).toEqual([['red', 'main is 14 behind, the oldest 1 d old', 'omni sync --fix']]);
    expect(old).toMatchObject({ status: 'red', headline: 'main is 14 behind, the oldest 1 d old', fix: 'omni sync --fix  (fast-forwards main)' });
  });

  it('takes its hours from sync.mainRedAfter', () => {
    expect(syncStatus(facts({ main: behind(1, 2 * HOUR) }), syncOf('sync:\n  mainRedAfter: 1h\n')).status).toBe('red');
    expect(syncStatus(facts({ main: behind(1, 47 * HOUR) }), syncOf('sync:\n  mainRedAfter: 48h\n')).status).toBe('green');
  });

  it('is orange on another branch, with changed files, and with commits the remote lacks, in the main checkout', () => {
    const record = syncStatus(facts({ main: { ...MAIN, branch: 'feat/x', changed: 3, unpushed: 2 } }), DEFAULTS);
    expect(of(record, 'main')).toEqual([
      ['green', 'on feat/x, up to date with origin/main', null],
      ['orange', 'on feat/x: plans are made on main', 'omni sync --fix'],
      ['orange', '3 changed files on feat/x', null],
      ['orange', 'main has 2 commits not on origin', null],
    ]);
    expect(record).toMatchObject({ status: 'orange', headline: 'on feat/x: plans are made on main', fix: 'omni sync --fix  (switches to main)' });
    expect(of(syncStatus(facts({ main: { ...MAIN, branch: null, changed: 1, unpushed: 1 } }), DEFAULTS), 'main')).toEqual([
      ['green', 'on a detached HEAD, up to date with origin/main', null],
      ['orange', 'on a detached HEAD: plans are made on main', 'omni sync --fix'],
      ['orange', '1 changed file on a detached HEAD', null],
      ['orange', 'main has 1 commit not on origin', null],
    ]);
  });

  it('judges only the behind rule in a linked worktree, naming the branch against the remote', () => {
    const linked: MainFacts = { ...MAIN, linked: true, branch: 'feat/x--s1', changed: 4, unpushed: 9, behind: { count: 3, oldestAt: NOW - 3 * DAY } };
    expect(of(syncStatus(facts({ main: linked }), DEFAULTS), 'main')).toEqual([['red', 'feat/x--s1 is 3 behind origin/main, the oldest 3 d old', null]]);
    expect(of(syncStatus(facts({ main: { ...linked, behind: { count: 0, oldestAt: null } } }), DEFAULTS), 'main')).toEqual([['green', 'on feat/x--s1, up to date with origin/main', null]]);
  });

  it('names the branch against the remote when another branch of the main checkout is behind', () => {
    const record = syncStatus(facts({ main: { ...behind(5, 2 * DAY), branch: 'feat/x' } }), DEFAULTS);
    expect(record.headline).toBe('feat/x is 5 behind origin/main, the oldest 2 d old');
    expect(record.fix).toBe('omni sync --fix  (switches to main, fast-forwards main)');
  });

  it('says not checked, orange and never red, for a fetch that failed or a count it could not read', () => {
    const record = syncStatus(facts({ main: { ...MAIN, behind: { notChecked: 'offline' }, unpushed: { notChecked: 'timed out' } } }), DEFAULTS);
    expect(of(record, 'main')).toEqual([
      ['orange', 'not checked: offline', null],
      ['orange', 'not checked: timed out (main against origin)', null],
    ]);
    expect(record.status).toBe('orange');
    expect(syncStatus(facts({ main: { notChecked: 'no git' } }), syncOf('sync:\n  levels:\n    main: red\n')).findings[0]).toEqual({
      check: 'main', severity: 'orange', text: 'not checked: no git', fix: null,
    });
  });
});

describe('syncStatus — the kit check', () => {
  it('names an older repository kit, an older plugin and an older target kit, each orange', () => {
    const kit: KitFacts = {
      latest: '0.0.423',
      repo: '0.0.418',
      plugins: [
        { name: 'omni@omni-loop', label: 'plugin', version: '0.0.420', fix: 'x' },
        { name: 'omni-hud@omni-loop', label: 'HUD plugin', version: '0.0.423', fix: 'y' },
      ],
      targets: [{ repo: 'acme/back', version: '0.0.400' }, { repo: 'acme/front', version: '0.0.423' }, { repo: 'acme/legacy', version: null }, { repo: 'acme/far', notChecked: 'no gh' }],
    };
    const record = syncStatus(facts({ kit }), DEFAULTS);
    expect(of(record, 'kit')).toEqual([
      ['orange', 'repo kit v0.0.418, latest v0.0.423', 'omni sync --fix'],
      ['orange', 'plugin v0.0.420, latest v0.0.423', 'omni sync --fix'],
      ['orange', 'acme/back kit v0.0.400, latest v0.0.423', 'omni update (in acme/back)'],
      ['orange', 'acme/legacy has no kit', null],
      ['orange', 'not checked: no gh (acme/far)', null],
    ]);
    expect(record).toMatchObject({ status: 'orange', headline: 'repo kit v0.0.418, latest v0.0.423', fix: "omni sync --fix  (updates the plugins, opens the kit's update PR)" });
  });

  it('names a plugin not installed once the setup is done, with its install line', () => {
    const kit: KitFacts = { ...KIT, plugins: [{ name: 'omni-hud@omni-loop', label: 'HUD plugin', version: null, fix: '/plugin install omni-hud@omni-loop' }] };
    expect(of(syncStatus(facts({ kit }), DEFAULTS), 'kit')).toEqual([['orange', 'omni-hud@omni-loop not installed', '/plugin install omni-hud@omni-loop']]);
  });

  it('compares nothing when the latest release could not be read, and skips the plugins without claude', () => {
    const kit: KitFacts = { latest: { notChecked: 'no gh' }, repo: '0.0.1', plugins: null, targets: [{ repo: 'acme/back', version: '0.0.1' }] };
    expect(of(syncStatus(facts({ kit }), DEFAULTS), 'kit')).toEqual([['orange', 'not checked: no gh (the latest release)', null]]);
    const unread: KitFacts = { latest: '0.0.2', repo: { notChecked: 'timed out' }, plugins: { notChecked: 'timed out' }, targets: [] };
    expect(of(syncStatus(facts({ kit: unread }), DEFAULTS), 'kit')).toEqual([
      ['orange', 'not checked: timed out (the repository kit)', null],
      ['orange', 'not checked: timed out (the plugins)', null],
    ]);
    expect(of(syncStatus(facts({ kit: { ...KIT, repo: null } }), DEFAULTS), 'kit')).toEqual([['green', 'in sync', null]]);
  });
});

describe('syncStatus — the knowledge check', () => {
  it('names stale evidence, drifted copies and changed files orange, and a stale copy red before its level', () => {
    const knowledge: KnowledgeFacts = {
      staleEvidence: 3,
      targets: [{ repo: 'acme/back', state: 'stale' }, { repo: 'acme/front', state: 'drifted' }, { repo: 'acme/ok', state: 'ok' }, { repo: 'acme/far', state: 'unreachable' }],
      changed: 1,
    };
    const raw = syncStatus(facts({ knowledge }), syncOf('sync:\n  levels:\n    knowledge: red\n'));
    expect(of(raw, 'knowledge')).toEqual([
      ['orange', '3 playbook entries cite changed files', '/omni:invade --refresh'],
      ['red', 'acme/back knowledge stale', '/omni:mega-invade --refresh'],
      ['orange', 'acme/front knowledge drifted', '/omni:mega-invade --refresh'],
      ['orange', 'not checked: unreachable (acme/far)', null],
      ['orange', '1 knowledge file changed here', null],
    ]);
    expect(raw).toMatchObject({ status: 'red', headline: 'acme/back knowledge stale', fix: '/omni:mega-invade --refresh' });
    const capped = syncStatus(facts({ knowledge }), DEFAULTS);
    expect(capped.findings.filter((finding) => finding.severity === 'red')).toEqual([]);
    expect(capped).toMatchObject({ status: 'orange', headline: '3 playbook entries cite changed files', fix: '/omni:invade --refresh' });
    expect(of(syncStatus(facts({ knowledge: { staleEvidence: 1, targets: { notChecked: 'no gh' }, changed: { notChecked: 'no git' } } }), DEFAULTS), 'knowledge')).toEqual([
      ['orange', '1 playbook entry cites changed files', '/omni:invade --refresh'],
      ['orange', 'not checked: no gh (the target copies)', null],
      ['orange', 'not checked: no git (the knowledge folder)', null],
    ]);
    expect(of(syncStatus(facts({ knowledge: { staleEvidence: { notChecked: 'timed out' }, targets: null, changed: 0 } }), DEFAULTS), 'knowledge')).toEqual([
      ['orange', 'not checked: timed out (the playbook evidence)', null],
    ]);
  });
});

describe('syncStatus — the page check', () => {
  it('is orange without a sign-in, with a copy over 24 hours old, never synced, or a page not answering', () => {
    expect(of(syncStatus(facts({ page: { ...PAGE, signedIn: false } }), DEFAULTS), 'page')).toEqual([['orange', 'not signed in', 'omni signin']]);
    expect(of(syncStatus(facts({ page: { ...PAGE, syncedAt: NOW - DAY - MINUTE } }), DEFAULTS), 'page')).toEqual([['orange', 'the page last synced 1 d ago', 'omni sync --fix']]);
    expect(of(syncStatus(facts({ page: { ...PAGE, syncedAt: NOW - DAY } }), DEFAULTS), 'page')).toEqual([['green', 'signed in · synced 1 d ago', null]]);
    expect(of(syncStatus(facts({ page: { ...PAGE, syncedAt: null } }), DEFAULTS), 'page')).toEqual([['orange', 'the page never synced', 'omni sync --fix']]);
    const silent = syncStatus(facts({ page: { ...PAGE, answering: false } }), DEFAULTS);
    expect(of(silent, 'page')).toEqual([['orange', 'the page last synced 5 min ago', 'omni sync --fix']]);
    expect(silent.fix).toBe("omni sync --fix  (refreshes the page's copy)");
    expect(of(syncStatus(facts({ page: { notChecked: 'no sign-in' } }), DEFAULTS), 'page')).toEqual([['orange', 'not checked: no sign-in', null]]);
  });
});

describe('syncStatus — the levels and the headline', () => {
  const RED_MAIN = behind(14, 2 * DAY);
  const OLD_KIT: KitFacts = { ...KIT, repo: '0.0.1' };

  it('caps a red finding at its check level orange', () => {
    const record = syncStatus(facts({ main: RED_MAIN }), syncOf('sync:\n  levels:\n    main: orange\n'));
    expect(of(record, 'main')).toEqual([['orange', 'main is 14 behind, the oldest 2 d old', 'omni sync --fix']]);
    expect(record.status).toBe('orange');
  });

  it('silences a check whose level is off, as its gatherer left it null', () => {
    const record = syncStatus(facts({ main: null, kit: OLD_KIT }), syncOf('sync:\n  levels:\n    main: off\n    kit: off\n'));
    expect(of(record, 'main')).toEqual([['green', 'off', null]]);
    expect(of(record, 'kit')).toEqual([['green', 'off', null]]);
    expect(record.status).toBe('green');
  });

  it('shows an older kit red when a lead sets the kit level to red, and orange by default', () => {
    const record = syncStatus(facts({ kit: OLD_KIT }), syncOf('sync:\n  levels:\n    kit: red\n'));
    expect(record).toMatchObject({ status: 'red', headline: 'repo kit v0.0.1, latest v0.0.423' });
    expect(syncStatus(facts({ kit: OLD_KIT }), DEFAULTS).status).toBe('orange');
    const target: KitFacts = { ...KIT, targets: [{ repo: 'acme/back', version: '0.0.1' }, { repo: 'acme/legacy', version: null }] };
    expect(syncStatus(facts({ kit: target }), syncOf('sync:\n  levels:\n    kit: red\n')).status).toBe('orange');
  });

  it('heads with the first finding of the status colour in the heaviest check, for a custom order too', () => {
    const page: PageFacts = { ...PAGE, signedIn: false };
    const both = facts({ kit: OLD_KIT, page });
    expect(syncStatus(both, DEFAULTS).headline).toBe('repo kit v0.0.1, latest v0.0.423');
    const pageFirst = syncOf('sync:\n  order: [page, knowledge, kit, main]\n');
    expect(syncStatus(both, pageFirst).headline).toBe('not signed in');
    expect(syncStatus(both, pageFirst).findings.map((finding) => finding.check)).toEqual(['page', 'knowledge', 'kit', 'main']);
    const red = syncStatus(facts({ kit: OLD_KIT, page, main: RED_MAIN }), pageFirst);
    expect(red).toMatchObject({ status: 'red', headline: 'main is 14 behind, the oldest 2 d old' });
  });
});

describe('syncStatus — the newcomer', () => {
  const newcomer = (over: Partial<SyncFacts>) => syncStatus(facts({ setupDoneAt: null, ...over }), DEFAULTS);
  const OPEN: SetupFacts = { claude: true, plugin: { done: false, fix: '/plugin install omni@omni-loop' }, hud: { done: false, fix: '/plugin install omni-hud@omni-loop' }, signedIn: false };
  const RED_MAIN = behind(3, 3 * DAY);

  it('counts 0 to 3 steps done while one is open, blue, with the checklist and no fix line', () => {
    const none = newcomer({ setup: OPEN, main: RED_MAIN });
    expect(none).toMatchObject({ status: 'blue', headline: 'Install the Omni plugin', setupDoneAt: null, fix: null });
    expect(none.setup).toEqual({
      done: 0,
      steps: [
        { step: 'plugin', done: false, text: 'Install the Omni plugin', fix: '/plugin install omni@omni-loop' },
        { step: 'hud', done: false, text: 'Install the HUD plugin', fix: '/plugin install omni-hud@omni-loop' },
        { step: 'signin', done: false, text: 'Sign in to the Omni page', fix: 'omni signin' },
        { step: 'main', done: false, text: 'Pull main', fix: 'omni sync --fix' },
      ],
    });
    expect(newcomer({ setup: { ...OPEN, plugin: { ...OPEN.plugin, done: true } }, main: RED_MAIN }).setup?.done).toBe(1);
    const two = newcomer({ setup: { ...SETUP, signedIn: false }, main: RED_MAIN });
    expect(two).toMatchObject({ status: 'blue', headline: 'Sign in to the Omni page', setup: { done: 2 } });
    expect(two.setup?.steps.slice(0, 2)).toEqual([
      { step: 'plugin', done: true, text: 'Omni plugin installed', fix: null },
      { step: 'hud', done: true, text: 'HUD plugin installed', fix: null },
    ]);
    expect(newcomer({ setup: SETUP, main: RED_MAIN })).toMatchObject({ status: 'blue', headline: 'Pull main', setup: { done: 3 } });
  });

  it('writes setupDoneAt on the first run with all four done, and shows the daily status', () => {
    const four = newcomer({ setup: SETUP, kit: { ...KIT, repo: '0.0.1' } });
    expect(four).toMatchObject({ status: 'orange', setupDoneAt: '2026-10-15T12:00:00.000Z', setup: null });
  });

  it('is never blue once setupDoneAt is written: a step that later breaks is a kit or page finding', () => {
    const later = syncStatus(facts({ setup: OPEN, main: RED_MAIN }), DEFAULTS);
    expect(later).toMatchObject({ status: 'red', setupDoneAt: DONE_AT, setup: null });
  });

  it('counts the plugin steps done, skipped, without claude', () => {
    const record = newcomer({ setup: { ...OPEN, claude: false } });
    expect(record.setup?.steps.slice(0, 2)).toEqual([
      { step: 'plugin', done: true, text: 'Omni plugin: not Claude: skipped', fix: null },
      { step: 'hud', done: true, text: 'HUD plugin: not Claude: skipped', fix: null },
    ]);
    expect(record.setup?.done).toBe(3);
  });

  it('counts main pulled when the main check is red only after its level, or not checked', () => {
    expect(newcomer({ main: { ...MAIN, behind: { notChecked: 'offline' } } }).status).toBe('orange');
    expect(syncStatus(facts({ setupDoneAt: null, main: RED_MAIN }), syncOf('sync:\n  levels:\n    main: orange\n'))).toMatchObject({ status: 'blue', headline: 'Pull main' });
  });
});
