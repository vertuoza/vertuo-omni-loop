// PRD 2896 s9: `omni committee check` prints what the fleet's committee reads before any member runs — the PRD's files by
// hash, who sits, what the escalation list names — and `omni committee record` takes the members' verdicts to a decision
// and its record line, the one line of the job's log the App reads back. Neither touches the network.
import { rmSync } from 'node:fs';
import type { ExecFileSyncOptions } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { committeeOf } from '../lib/committee/record.ts';
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
