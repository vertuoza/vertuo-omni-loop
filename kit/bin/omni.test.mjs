import { describe, expect, it } from 'vitest';
import { cpSync, existsSync as exists, mkdirSync as mkdir, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeRepo } from '../test/fixture.mjs';
import { main } from './omni.mjs';
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

  it('exits 2 in a repository that is not terraformed', async () => {
    const { root } = makeRepo({ git: true });
    const s = io();
    expect(await main(['status', '1'], { cwd: root, ...s })).toBe(2);
    expect(s.err.join('')).toMatch(/not terraformed/);
  });

  it('prints one config value', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const s = io();
    expect(await main(['config', 'labels.outboxGo'], { cwd: root, ...s })).toBe(0);
    expect(s.out.join('')).toBe('outbox:go\n');
  });

  it('status is 0 with nothing open and 1 with an open item', async () => {
    const { root, write } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    expect(await main(['status', '42'], { cwd: root, ...io() })).toBe(0);
    write('.omni-loop/delivery/outbox/0042-a/s1-01-x.md', 'open');
    expect(await main(['status', '42'], { cwd: root, ...io() })).toBe(1);
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
    expect(await main(['status', '42', '--labels', 'a,outbox:go'], { cwd: root, ...io() })).toBe(0);
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
