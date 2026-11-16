// PRD 2896 s9: `omni committee check` prints what the fleet's committee reads before any member runs — the PRD's files by
// hash, who sits, what the escalation list names — and `omni committee record` takes the members' verdicts to a decision
// and its record line, the one line of the job's log the App reads back. Neither touches the network.
import { rmSync } from 'node:fs';
import type { ExecFileSyncOptions } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { answerOf, committeeOf } from '../lib/committee/record.ts';
import { sha256 } from '../lib/dossier/folder.ts';
import { parsePrd } from '../lib/ids.ts';
import { makeRepo, realExec } from '../test/fixture.ts';
import type { Repo } from '../test/fixture.ts';
import { main } from './omni.ts';

const CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\n';
const DIR = '.omni-loop/delivery/inbox/0042-widgets';
const SERVER_SPEC = '---\nprd: 42\nphase0: server\n---\n\n## Problem\n\nWidgets.\n';
const PLAN = '# Plan\n\n| id | slice | territory | blocked by | wave |\n|---|---|---|---|---|\n| s1 | one | `src/` | — | 1 |\n';

const repos: Repo[] = [];
function repo(spec = SERVER_SPEC): Repo {
  const made = makeRepo({ git: true, files: { '.omni-loop/config.yml': CONFIG, [`${DIR}/spec.md`]: spec, [`${DIR}/plan.md`]: PLAN, [`${DIR}/before-after.html`]: '<html></html>\n' } });
  repos.push(made);
  return made;
}
afterEach(() => {
  for (const made of repos.splice(0)) rmSync(made.root, { recursive: true, force: true });
});

/** git as the repository's own, but the branch's diff against the default branch and the files it shows, given here. */
function gitWith(migrations: Record<string, string>) {
  return (cmd: string, args: readonly string[], options?: ExecFileSyncOptions) => {
    if (cmd === 'git' && args.includes('diff') && args.includes('--name-only')) return `${Object.keys(migrations).join('\n')}\n`;
    const shown = cmd === 'git' && args[2] === 'show' ? migrations[(args[3] ?? '').replace(/^HEAD:/, '')] : undefined;
    if (shown !== undefined) return shown;
    return realExec(cmd, args, options);
  };
}

async function omni(r: Repo, args: string[], exec = gitWith({})) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['committee', ...args], { cwd: r.root, exec, env: {}, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } });
  return { code, out: out.join(''), err: err.join('') };
}

const votes = (r: Repo, verdicts: unknown[]): string => {
  const path = `${r.root}/votes.json`;
  r.write('votes.json', JSON.stringify({ verdicts }));
  return path;
};
const yes = (role: string) => ({ role, answer: 'yes', sentence: 'In scope and reversible.' });

describe('omni committee check', () => {
  it('names the files read by hash, the three members with their models, and nothing escalated for a PRD born on the server', async () => {
    const r = repo();
    const { code, out } = await omni(r, ['check', '42', '--approve']);
    expect(code).toBe(0);
    expect(out).toContain(`read: spec ${sha256(SERVER_SPEC).slice(0, 7)} · plan ${sha256(PLAN).slice(0, 7)} · before-after`);
    expect(out).toContain('sits: pm (claude opus), architect (claude opus), reviewer (claude opus)');
    expect(out).toContain('escalates: nothing by rule: the members vote');
  });

  it('lets the author sit out, and says so', async () => {
    const { out } = await omni(repo(), ['check', '42', '--approve', '--author', 'pm']);
    expect(out).toContain('sits: architect (claude opus), reviewer (claude opus) · the pm sits out: its job wrote it');
  });

  it('escalates a PRD whose spec does not say phase0: server, and one naming a Legal entry', async () => {
    const { out } = await omni(repo('---\nprd: 42\n---\n\nKeeps L-GDPR-4.\n'), ['check', '42', '--approve', '--json']);
    const read = JSON.parse(out) as { escalations: string[]; read: { kind: string }[] };
    expect(read.escalations).toEqual(['it is approved by its phase-0 pull request, which only a person merges', 'it bears on the Legal entry L-GDPR-4']);
    expect(read.read.map((file) => file.kind)).toEqual(['spec', 'plan', 'before-after']);
  });

  it('escalates a migration of the branch that drops or rewrites data, and lets one that only adds through', async () => {
    const exec = gitWith({ 'supabase/migrations/1_add.sql': 'create table x (id int);', 'supabase/migrations/2_drop.sql': 'drop table y;', 'src/a.ts': 'x' });
    const { out } = await omni(repo(), ['check', '42', '--approve'], exec);
    expect(out).toContain('escalates: the migration supabase/migrations/2_drop.sql drops or rewrites data');
    expect(out).not.toContain('1_add.sql');
  });

  it('refuses no --approve, an unknown author, and a PRD with no folder', async () => {
    const r = repo();
    expect((await omni(r, ['check', '42'])).code).toBe(2);
    expect((await omni(r, ['check', '42', '--approve', '--author', 'engineer'])).code).toBe(2);
    expect((await omni(r, ['check', '43', '--approve'])).code).toBe(2);
  });
});

describe('omni committee record', () => {
  it('carries three yes and ends on the record line the App reads, the files read by hash', async () => {
    const r = repo();
    const { code, out } = await omni(r, ['record', '42', '--approve', '--file', votes(r, [yes('pm'), yes('architect'), yes('reviewer')])]);
    expect(code).toBe(0);
    expect(out).toContain('omni committee: PRD 42 carried');
    const last = out.trimEnd().split('\n').at(-1) ?? '';
    const record = committeeOf(last, parsePrd(42));
    expect(record).toMatchObject({ outcome: 'carried', escalations: [], author: null });
    expect(record?.read).toContainEqual({ kind: 'spec', sha256: sha256(SERVER_SPEC) });
  });

  it('escalates a no with its reason, and records the verdicts', async () => {
    const r = repo();
    const { out } = await omni(r, ['record', '42', '--approve', '--file', votes(r, [yes('pm'), { role: 'architect', answer: 'no', sentence: 'It changes a stored shape.' }, yes('reviewer')])]);
    expect(out).toContain('escalated: it goes to a person');
    expect(out).toContain('  the Architect answered no: It changes a stored shape.');
    expect(committeeOf(out, parsePrd(42))?.verdicts.map((v) => v.answer)).toEqual(['yes', 'no', 'yes']);
  });

  it('escalates by rule although three members answer yes', async () => {
    const r = repo('---\nprd: 42\n---\n');
    const { out } = await omni(r, ['record', '42', '--approve', '--file', votes(r, [yes('pm'), yes('architect'), yes('reviewer')])]);
    expect(committeeOf(out, parsePrd(42))).toMatchObject({ outcome: 'escalated', escalations: ['it is approved by its phase-0 pull request, which only a person merges'] });
  });

  it('refuses a votes file it cannot read, and records nothing', async () => {
    const r = repo();
    const bad = await omni(r, ['record', '42', '--approve', '--file', votes(r, [{ role: 'pm', answer: 'maybe', sentence: 'x' }])]);
    expect(bad.code).toBe(1);
    expect(bad.err).toContain('the votes are refused, nothing recorded');
    expect(bad.out).toBe('');
  });
});

// PRD 2896 s10: the committee answers a high outbox item, open on the feature branch.
const OUTBOX = '.omni-loop/delivery/outbox/0042-widgets';
const item = (decide = 'Decided by: Jev (hardToRevert 0.3) · agent said true', body = 'Should the cap stay at five?'): string =>
  [
    '---', 'id: s1-01-keep-the-cap', 'prd: 42', 'slice: s1', 'rank: high', 'bears-on: none', 'raised: 2026-11-16', 'wave: 1', '---', '',
    '## The question, in plain words', '', body, '',
    '## The decision, in plain words', '', 'It stays.', '',
    '## The options, in plain words', '', 'A. Keep five (built).', 'B. Ten.', '',
    '## What I had to decide', '', `Whether.\n${decide}`, '',
    '## What I did meanwhile', '', 'y', '',
    '## What it costs to change later', '', 'z', '',
    '## What I could not know', '', '(author) w', '',
  ].join('\n');

function itemRepo(text = item()): Repo {
  const made = repo();
  made.write(`${OUTBOX}/s1-01-keep-the-cap.md`, text);
  return made;
}

describe('omni committee, on an item', () => {
  it('reads the item by its hash, and lets through one Jev scored under the bound that bears on nothing', async () => {
    const text = item();
    const { code, out } = await omni(itemRepo(text), ['check', '42', '--item', 's1-01-keep-the-cap', '--bound', '0.6', '--json']);
    expect(code).toBe(0);
    expect(JSON.parse(out)).toMatchObject({ item: 's1-01-keep-the-cap', read: [{ kind: 'item', sha256: sha256(text) }], escalations: [] });
  });

  it('escalates an item with no hard-to-revert score, one at the bound, and one bearing on a business law', async () => {
    const unknown = await omni(itemRepo(item('')), ['check', '42', '--item', 's1-01-keep-the-cap']);
    expect(unknown.out).toContain('escalates: its hard-to-revert score is unknown');
    const at = await omni(itemRepo(), ['check', '42', '--item', 's1-01-keep-the-cap', '--bound', '0.3']);
    expect(at.out).toContain("escalates: its hard-to-revert score 0.3 is at or above the mission's bound 0.3");
    const law = await omni(itemRepo(item(undefined, 'Keeps BL-GATE-1.')), ['check', '42', '--item', 's1-01-keep-the-cap']);
    expect(law.out).toContain('escalates: it bears on the business law BL-GATE-1: a person decides');
  });

  it('records three yes as an answer with option A, for that item', async () => {
    const r = itemRepo();
    const { code, out } = await omni(r, ['record', '42', '--item', 's1-01-keep-the-cap', '--file', votes(r, [yes('pm'), yes('architect'), yes('reviewer')])]);
    expect(code).toBe(0);
    expect(out).toContain('carried: the fleet answers s1-01-keep-the-cap with option A once the App records it');
    expect(answerOf(out, parsePrd(42), 's1-01-keep-the-cap')).toMatchObject({ kind: 'answer', option: 'A', outcome: 'carried' });
    expect(committeeOf(out, parsePrd(42))).toBeNull();
  });

  it('refuses an item not open here, both --approve and --item, and a bound out of 0 to 1', async () => {
    const r = itemRepo();
    expect((await omni(r, ['check', '42', '--item', 's1-09-gone'])).code).toBe(2);
    expect((await omni(r, ['check', '42', '--approve', '--item', 's1-01-keep-the-cap'])).code).toBe(2);
    expect((await omni(r, ['check', '42', '--item', 's1-01-keep-the-cap', '--bound', '2'])).code).toBe(2);
  });
});
