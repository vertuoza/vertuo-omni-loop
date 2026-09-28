import { describe, expect, it } from 'vitest';
import { cpSync, existsSync as exists, mkdirSync as mkdir, mkdtempSync, readFileSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeRepo } from '../test/fixture.mjs';
import { main, prdNamedBy } from './omni.mjs';
import { sliceTimeGuardCommand } from '../lib/policy/outbox-policy.mjs';

function io() {
  const out = [];
  const err = [];
  return { out, err, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } };
}
const CONFIG = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n' };

describe('omni', () => {
  it('exits 2 with one line outside a git repository', async () => {
    const s = io();
    expect(await main(['status', '1'], { cwd: mkdtempSync(join(tmpdir(), 'x-')), ...s })).toBe(2);
    expect(s.err.join('')).toMatch(/^.*not inside a git repository\.\n$/);
  });

  it('exits 2 in a repository that is not installed', async () => {
    const { root } = makeRepo({ git: true });
    const s = io();
    expect(await main(['status', '1'], { cwd: root, ...s })).toBe(2);
    expect(s.err.join('')).toMatch(/not installed/);
  });

  it('prints one config value', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const s = io();
    expect(await main(['config', 'labels.outboxGo'], { cwd: root, ...s })).toBe(0);
    expect(s.out.join('')).toBe('omni:outbox-go\n');
  });

  it('status is 0 with nothing open and 1 with an open item', async () => {
    const { root, write } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    expect(await main(['status', '42'], { cwd: root, ...io() })).toBe(0);
    write('.omni-loop/delivery/outbox/0042-a/s1-01-x.md', 'open');
    expect(await main(['status', '42'], { cwd: root, ...io() })).toBe(1);
  });

  it('status writes open_items and unreworked to GITHUB_OUTPUT', async () => {
    const settled = ['<!-- omni-outbox-settled: s1-01-x -->', '## s1-01-x — drifted', '- Verdict: drifted', '- Closed: no — x', '<!-- /omni-outbox-settled: s1-01-x -->', ''].join('\n');
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x', '.omni-loop/delivery/outbox/0042-a/settled.md': settled } });
    const out = join(root, 'gh-output');
    expect(await main(['status', '42'], { cwd: root, ...io(), env: { GITHUB_OUTPUT: out } })).toBe(1);
    expect(readFileSync(out, 'utf8')).toBe('open_items=false\nunreworked=true\nunaccounted=false\n');
  });

  it('prints usage and exits 2 for an unknown command', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const s = io();
    expect(await main(['nope'], { cwd: root, ...s })).toBe(2);
    expect(s.err.join('')).toMatch(/usage: omni <command>/);
  });
});

describe('omni — flags, lookups and guards', () => {
  it('exits 2 with one line for a flag a command does not take', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const s = io();
    expect(await main(['status', '42', '--nope'], { cwd: root, ...s })).toBe(2);
    expect(s.err.join('')).toMatch(/^[^\n]*--nope[^\n]*\n$/);
  });

  it('exits 2 when a flag that takes a value has none', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const s = io();
    expect(await main(['status', '42', '--labels'], { cwd: root, ...s })).toBe(2);
    expect(s.err.join('')).toMatch(/--labels/);
  });

  it('prints the whole config as JSON with no key', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const s = io();
    expect(await main(['config'], { cwd: root, ...s })).toBe(0);
    expect(JSON.parse(s.out.join('')).repo.slug).toBe('acme/widgets');
  });

  it('exits 2 for a config key that does not exist', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const s = io();
    expect(await main(['config', 'labels.nope'], { cwd: root, ...s })).toBe(2);
    expect(s.err.join('')).toMatch(/labels\.nope/);
  });

  it('prd prints where a PRD lives, and exits 1 for one that is nowhere', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    const s = io();
    expect(await main(['prd', '42'], { cwd: root, ...s })).toBe(0);
    expect(s.out.join('')).toMatch(/state: inbox/);
    expect(s.out.join('')).toMatch(/\.omni-loop\/delivery\/inbox\/0042-a\/spec\.md/);
    const t = io();
    expect(await main(['prd', '7'], { cwd: root, ...t })).toBe(1);
    expect(t.err.join('')).toMatch(/PRD 7/);
  });

  it('status with --labels carrying the override label is green', async () => {
    const { root } = makeRepo({
      git: true,
      files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x', '.omni-loop/delivery/outbox/0042-a/s1-01-x.md': 'open' },
    });
    expect(await main(['status', '42', '--labels', 'a,omni:outbox-go'], { cwd: root, ...io() })).toBe(0);
  });

  it('settle exits 2 without an item and 1 when the answer is refused', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    expect(await main(['settle'], { cwd: root, ...io() })).toBe(2);
    const s = io();
    expect(await main(['settle', 'nowhere.md', '--by', 'me', '--at', '2026-01-01', '--channel', 'prd-issue', '--number', '3', '--answer', 'A'], { cwd: root, ...s })).toBe(1);
    expect(s.err.join('')).toMatch(/nothing was written/);
  });

  it('ship refuses a PRD that is not in the inbox, exit 1', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const s = io();
    expect(await main(['ship', '9'], { cwd: root, ...s })).toBe(1);
    expect(s.err.join('')).toMatch(/Cannot ship PRD 9/);
  });

  it('ship names each rewritten file at its new path, not its old one', async () => {
    const { root } = makeRepo({
      git: true,
      files: {
        ...CONFIG,
        '.omni-loop/delivery/inbox/0042-a/spec.md': '---\nprd: 42\ntitle: A\nblocked-by: none\nspec: file\n---\n\nSee .omni-loop/delivery/inbox/0042-a/plan.md\n',
        '.omni-loop/delivery/inbox/0042-a/plan.md': 'x\n',
      },
    });
    const s = io();
    expect(await main(['ship', '42'], { cwd: root, ...s })).toBe(0);
    const out = s.out.join('');
    expect(out).toContain('rewrote paths in .omni-loop/delivery/shipped/0042-a/spec.md');
    expect(out).not.toContain('rewrote paths in .omni-loop/delivery/inbox/');
  });

  it('knowledge exits 1 for an id nothing claims', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const s = io();
    expect(await main(['knowledge', 'P-PRODUCT-1'], { cwd: root, ...s })).toBe(1);
    expect(s.err.join('')).toMatch(/P-PRODUCT-1/);
  });

  it('check inbox is red on a malformed spec', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    const s = io();
    expect(await main(['check', 'inbox'], { cwd: root, ...s })).toBe(1);
    expect(s.out.join('')).toMatch(/0042-a\/spec\.md/);
  });

  it('check outbox is green with no outbox', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const s = io();
    expect(await main(['check', 'outbox'], { cwd: root, ...s })).toBe(0);
    expect(s.out.join('')).toMatch(/0 open item/);
  });

  it('check knowledge passes with a note when there is no knowledge folder and laws do not need one', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const s = io();
    expect(await main(['check', 'knowledge'], { cwd: root, ...s })).toBe(0);
    expect(s.out.join('')).toMatch(/no knowledge folder/);
  });

  it('check knowledge is red when laws.source is knowledge and the folder is missing', async () => {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\nlaws:\n  source: knowledge\n' } });
    const s = io();
    expect(await main(['check', 'knowledge'], { cwd: root, ...s })).toBe(1);
    expect(s.out.join('')).toMatch(/\.omni-loop\/knowledge/);
  });

  it('check coverage alone exits 2 naming the missing base ref', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const s = io();
    expect(await main(['check', 'coverage'], { cwd: root, ...s })).toBe(2);
    expect(s.err.join('')).toMatch(/origin\/main/);
  });

  it('check coverage grades against --base', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const s = io();
    expect(await main(['check', 'coverage', '--base', 'HEAD'], { cwd: root, ...s })).toBe(0);
  });

  it('check all skips coverage when the base ref is missing and runs the rest', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const s = io();
    expect(await main(['check', 'all'], { cwd: root, ...s })).toBe(0);
    const out = s.out.join('');
    expect(out).toMatch(/coverage: skipped — no origin\/main/);
    expect(out).toMatch(/inbox/);
    expect(out).toMatch(/outbox/);
    expect(out).toMatch(/knowledge/);
    expect(out).toMatch(/^check kb — /m);
  });

  it('check kb is green, with a warning per missing form, in a repository with no forms', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const s = io();
    expect(await main(['check', 'kb'], { cwd: root, ...s })).toBe(0);
    expect(s.out.join('')).toBe('check kb — 13 form(s): 13 missing; 13 warning(s).\n');
    expect(s.err.join('')).toMatch(/^warning: \.omni-loop\/knowledge\/playbook\/briefing\.md: missing/);
  });

  it('the slice-time guard command runs as emitted', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    execFileSync('git', ['branch', 'feat/topic'], { cwd: root, stdio: 'ignore' });
    const command = sliceTimeGuardCommand({ base: 'feat/topic', prd: 42 });
    const [, script, ...argv] = command.split(' ');
    expect(script).toBe('.omni-loop/bin/omni.mjs');
    const s = io();
    const code = await main(argv, { cwd: root, ...s });
    expect(s.err.join('')).toBe('');
    expect(code).toBe(0);
    expect(s.out.join('')).toMatch(/PRD #42, range feat\/topic|PRD #42: 0 risky/);
  });

  it('check with an unknown guard exits 2', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    expect(await main(['check', 'nope'], { cwd: root, ...io() })).toBe(2);
  });
});

const STRAY_MEDIUM = [
  '---', 'id: s7-01-t', 'prd: 999', 'slice: s7', 'rank: medium', 'bears-on: none', 'raised: 2026-09-22', 'wave: 4', '---', '',
  '## The question, in plain words', '', 'How long should we wait before giving up on a slow call?', '',
  '## The decision, in plain words', '', 'We wait five seconds, which is generous without being unbounded.', '',
  '## The options, in plain words', '', 'A. Wait five seconds, the option built.', 'B. Wait one second, so a stuck call is caught sooner.', '',
  '## What I had to decide', '', 'How long a slow call gets before it is treated as stuck.', '',
  '## What I did meanwhile', '', 'Five seconds, a constant with no migration to undo it.', '',
  '## What it costs to change later', '', 'One constant.', '',
  '## What I could not know', '', '(author) Whether five seconds is measured against a real incident.', '',
].join('\n');
const STRAY_HIGH = STRAY_MEDIUM.replace('rank: medium', 'rank: high');

describe('omni — user-caused errors are one line, exit 2', () => {
  const oneLine = (s) => expect(s.err.join('')).toMatch(/^[^\n]+\n$/);

  it('check all with an explicit --base that does not exist', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const s = io();
    expect(await main(['check', 'all', '--base', 'nope/branch'], { cwd: root, ...s })).toBe(2);
    expect(s.err.join('')).toMatch(/nope\/branch/);
  });

  it('check says --prd was ignored when coverage does not run', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const s = io();
    expect(await main(['check', 'inbox', '--prd', '3'], { cwd: root, ...s })).toBe(0);
    expect(s.out.join('') + s.err.join('')).toMatch(/--prd 3 ignored/);
    const t = io();
    expect(await main(['check', 'all', '--prd', '3'], { cwd: root, ...t })).toBe(0);
    expect(t.out.join('') + t.err.join('')).toMatch(/--prd 3 ignored/);
  });

  it('comment and replies with a --repo that is not owner/name', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    for (const argv of [['comment', '--prd', '3', '--branch', 'feat/x', '--repo', 'nope'], ['replies', '--prd', '3', '--pr', '4', '--repo', 'nope']]) {
      const s = io();
      expect(await main(argv, { cwd: root, ...s, env: {} })).toBe(2);
      oneLine(s);
      expect(s.err.join('')).toMatch(/owner\/name.*nope|nope.*owner\/name/);
    }
  });

  it('comment with a --base that does not exist', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const s = io();
    expect(await main(['comment', '--prd', '3', '--branch', 'feat/x', '--base', 'nope/branch'], { cwd: root, ...s, env: {} })).toBe(2);
    oneLine(s);
    expect(s.err.join('')).toMatch(/nope\/branch/);
  });

  it('adopt with a file that does not exist', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const s = io();
    expect(await main(['adopt', 'missing.md'], { cwd: root, ...s })).toBe(2);
    oneLine(s);
    expect(s.err.join('')).toMatch(/missing\.md/);
  });

  it('settle with an --answer-file that does not exist', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const s = io();
    expect(await main(['settle', 'x.md', '--answer-file', 'gone.txt'], { cwd: root, ...s })).toBe(2);
    oneLine(s);
    expect(s.err.join('')).toMatch(/gone\.txt/);
  });

  it('adopt of an item whose PRD has no inbox or shipped folder', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, 'stray.md': STRAY_MEDIUM } });
    const s = io();
    expect(await main(['adopt', 'stray.md'], { cwd: root, ...s })).toBe(2);
    oneLine(s);
    expect(s.err.join('')).toMatch(/PRD 999 has no inbox or shipped folder/);
  });

  it('settle of an item whose PRD has no inbox or shipped folder', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, 'stray.md': STRAY_HIGH } });
    const s = io();
    const args = ['settle', 'stray.md', '--by', 'me', '--at', '2026-01-01', '--channel', 'prd-issue', '--number', '3', '--answer', 'A'];
    expect(await main(args, { cwd: root, ...s })).toBe(2);
    oneLine(s);
    expect(s.err.join('')).toMatch(/PRD 999 has no inbox or shipped folder/);
  });
});

describe('omni bundle', () => {
  it('the bundle runs in a repository with no node_modules', () => {
    const kitRoot = fileURLToPath(new URL('..', import.meta.url));
    execFileSync('node', [join(kitRoot, 'build.mjs')], { stdio: 'ignore' });
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    mkdir(join(root, '.omni-loop/bin'), { recursive: true });
    cpSync(join(kitRoot, 'dist/omni.mjs'), join(root, '.omni-loop/bin/omni.mjs'));
    expect(exists(join(root, 'node_modules'))).toBe(false);
    const out = execFileSync('node', ['.omni-loop/bin/omni.mjs', 'prd', '42'], { cwd: root, encoding: 'utf8' });
    expect(out).toMatch(/0042-a/);
  }, 30000);
});

// PRD #324, slice s5: a command that names one PRD records it for the Claude session it runs in, in
// the main checkout, before it runs; its output and exit code stay exactly as they were. The session
// id is always passed in `env`, so the session running these tests never records into them.
describe('omni — the PRD a command names, recorded for the Claude session', () => {
  const SESSION = { CLAUDE_CODE_SESSION_ID: 'abc' };
  const RECORD = '.omni-loop/local/sessions/abc.json';
  const SPEC_7 = '---\nprd: 7\ntitle: Bravo\nblocked-by: none\nspec: file\n---\n\n# Bravo\n';
  const PLAN_7 = ['# A plan', '', '| id | slice | territory | blocked by | wave |', '| --- | --- | --- | --- | --- |', '| s1 | Alpha | `a/` | — | 1 |', ''].join('\n');
  const FILES = { ...CONFIG, '.omni-loop/delivery/inbox/0007-bravo/spec.md': SPEC_7, '.omni-loop/delivery/inbox/0007-bravo/plan.md': PLAN_7 };
  /** An empty sign-in store: `omni dossier` never reads the real one. */
  const NO_SIGN_IN = { read: () => null, write() {} };

  /** `execFileSync` for git; `gh pr list` lists nothing, and any other `gh` call fails: no test calls GitHub. */
  const noGitHub = (file, args, options) => {
    if (file !== 'gh') return execFileSync(file, args, options);
    if (args[0] === 'pr' && args[1] === 'list') return '[]';
    throw new Error(`no gh here: ${args.join(' ')}`);
  };

  /** `omni <argv>` in `cwd` with `env`: its exit code and its output, the fixture's own folder written `<root>`. */
  async function omni(argv, { root, cwd = root, env = {} }) {
    const s = io();
    const code = await main(argv, { cwd, ...s, exec: noGitHub, env, tokens: NO_SIGN_IN });
    const clean = (text) => text.split(realpathSync(root)).join('<root>').split(root).join('<root>');
    return { code, out: clean(s.out.join('')), err: clean(s.err.join('')) };
  }

  const FORMS = [
    ['prd', '7'],
    ['board', '7'],
    ['status', '7'],
    ['phase0', '7'],
    ['ship', '7'],
    ['harvest', '7', '--pr', '3'],
    ['dossier', 'push', '7'],
    ['plan', 'check', '7'],
    ['rework', 'plan', '7'],
    ['check', '--prd', '7'],
    ['rework', 'close', 's1-01-x', '--prd', '7', '--pr', '3'],
    ['item', 'new', '--prd', '7', '--slice', 's1', '--file', 'missing.json'],
  ];

  it.each(FORMS.map((argv) => [argv.join(' '), argv]))('`omni %s` records PRD 7, and prints and exits as it does without', async (_name, argv) => {
    const without = makeRepo({ git: true, files: FILES });
    const within = makeRepo({ git: true, files: FILES });
    const before = Date.now();
    const recorded = await omni(argv, { root: within.root, env: SESSION });
    const after = Date.now();
    expect(recorded).toEqual(await omni(argv, { root: without.root }));
    const { prd, at, ...rest } = JSON.parse(within.read(RECORD));
    expect({ prd, rest }).toEqual({ prd: 7, rest: {} });
    expect(new Date(Date.parse(at)).toISOString()).toBe(at);
    expect(Date.parse(at)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(at)).toBeLessThanOrEqual(after);
    expect(exists(join(without.root, '.omni-loop/local'))).toBe(false);
  });

  it('records in the main checkout when the command runs in one of its worktrees', async () => {
    const { root, read } = makeRepo({ git: true, files: FILES });
    const worktree = join(mkdtempSync(join(tmpdir(), 'omni-worktree-')), 'wt');
    execFileSync('git', ['worktree', 'add', '-q', '-b', 'feat/bravo--s1', worktree], { cwd: root, stdio: 'ignore' });
    const run = await omni(['prd', '7'], { root, cwd: worktree, env: SESSION });
    expect(run.code).toBe(0);
    expect(JSON.parse(read(RECORD)).prd).toBe(7);
    expect(exists(join(worktree, '.omni-loop/local'))).toBe(false);
  });

  it('lets the latest command win, whatever it returns', async () => {
    const { root, read } = makeRepo({ git: true, files: FILES });
    expect((await omni(['prd', '7'], { root, env: SESSION })).code).toBe(0);
    expect((await omni(['prd', '42'], { root, env: SESSION })).code).toBe(1);
    expect(JSON.parse(read(RECORD)).prd).toBe(42);
  });

  it('records nothing without the variable, with an id that is not safe, or for a number that is no PRD', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    const runs = [
      [['prd', '7'], {}],
      [['prd', '7'], { CLAUDE_CODE_SESSION_ID: '' }],
      [['prd', '7'], { CLAUDE_CODE_SESSION_ID: '../abc' }],
      [['prd', '7'], { CLAUDE_CODE_SESSION_ID: 'a b' }],
      [['prd', 'seven'], SESSION],
      [['prd', '0'], SESSION],
      [['prd', '-7'], SESSION],
      [['prd', '7.5'], SESSION],
      [['check', '--prd', 'seven'], SESSION],
      [['config'], SESSION],
      [['nope', '--prd', '7'], SESSION],
    ];
    for (const [argv, env] of runs) await omni(argv, { root, env });
    expect(exists(join(root, '.omni-loop/local'))).toBe(false);
  });

  it('runs the command exactly as before when the record cannot be written', async () => {
    const without = makeRepo({ git: true, files: FILES });
    const within = makeRepo({ git: true, files: { ...FILES, '.omni-loop/local': 'a file where the folder would be\n' } });
    const recorded = await omni(['prd', '7'], { root: within.root, env: SESSION });
    expect(recorded).toEqual(await omni(['prd', '7'], { root: without.root }));
    expect(recorded.code).toBe(0);
  });
});

describe('prdNamedBy: the one PRD a command names', () => {
  it('reads the number after the command', () => {
    for (const name of ['prd', 'board', 'status', 'phase0', 'ship', 'harvest']) expect(prdNamedBy([name, '7'])).toBe(7);
    expect(prdNamedBy(['board', '7', '--json'])).toBe(7);
    expect(prdNamedBy(['harvest', '7', '--pr', '12'])).toBe(7);
    expect(prdNamedBy(['status', '324', '--labels', 'a,b'])).toBe(324);
  });

  it('reads the number after the subcommand for `dossier push`, `plan check` and `rework plan`', () => {
    expect(prdNamedBy(['dossier', 'push', '7'])).toBe(7);
    expect(prdNamedBy(['plan', 'check', '7'])).toBe(7);
    expect(prdNamedBy(['rework', 'plan', '7', '--json'])).toBe(7);
    expect(prdNamedBy(['dossier', 'open', '7'])).toBeNull();
    expect(prdNamedBy(['dossier', '7'])).toBeNull();
    expect(prdNamedBy(['plan', '7'])).toBeNull();
    expect(prdNamedBy(['rework', 'close', '7'])).toBeNull();
  });

  it('reads the value of `--prd`, for any command', () => {
    expect(prdNamedBy(['check', '--prd', '7'])).toBe(7);
    expect(prdNamedBy(['check', 'coverage', '--base', 'origin/feat/x', '--prd', '324'])).toBe(324);
    expect(prdNamedBy(['comment', '--prd', '7', '--branch', 'feat/x'])).toBe(7);
    expect(prdNamedBy(['item', 'new', '--prd', '7', '--slice', 's1', '--file', 'x.json'])).toBe(7);
    expect(prdNamedBy(['replies', '--prd', '7', '--pr', '12'])).toBe(7);
    expect(prdNamedBy(['rework', 'close', 's1-01-x', '--prd', '7', '--pr', '12'])).toBe(7);
    expect(prdNamedBy(['board', '--prd', '7'])).toBe(7);
  });

  it('reads nothing where no argument names a PRD, or where the number is no positive integer', () => {
    for (const argv of [[], ['config'], ['prd'], ['board', '--json', '7'], ['harvest', '--pr', '12', '7'], ['check', '--prd'], ['check', '--prd', '--base']]) {
      expect(prdNamedBy(argv)).toBeNull();
    }
    for (const value of ['seven', '0', '-7', '7.5', '', 'NaN']) {
      expect(prdNamedBy(['prd', value])).toBeNull();
      expect(prdNamedBy(['check', '--prd', value])).toBeNull();
    }
  });

  it('reads nothing when a command names two different PRDs, and the one it names twice', () => {
    expect(prdNamedBy(['status', '7', '--prd', '9'])).toBeNull();
    expect(prdNamedBy(['check', '--prd', '7', '--prd', '9'])).toBeNull();
    expect(prdNamedBy(['status', '7', '--prd', '7'])).toBe(7);
  });
});
