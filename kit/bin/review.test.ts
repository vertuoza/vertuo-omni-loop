// PRD 2871, s1: `omni review post` posts the Reviewer's verdict as one COMMENT review on PRD n's
// feature PR, once per round; `omni review read` prints the latest round and verdict it finds there;
// `omni review look-for` prints what the Reviewer looks for. Every call goes to a fake `gh`.
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExecFileSyncOptions } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { makeRepo, realExec } from '../test/fixture.ts';
import type { Repo } from '../test/fixture.ts';
import { main } from './omni.ts';

const CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\n';
const PR_URL = 'https://github.com/acme/widgets/pull/9';
const PULL = { number: 9, html_url: PR_URL, head: { sha: 'abc1234', ref: 'feat/widgets' } };

type Review = { id: number; body: string; html_url: string; state?: string };

/** A posted review, as GitHub lists it. */
const posted = (id: number, body: string): Review => ({ id, body, html_url: `${PR_URL}#pullrequestreview-${String(id)}`, state: 'COMMENTED' });

/** A fake `gh`: the feature branch's open pull requests, its reviews, and every review posted. */
function fakeGh({ pulls = [PULL], reviews = [] as Review[], refusePost = false } = {}) {
  const calls: string[] = [];
  const bodies: unknown[] = [];
  const exec = (cmd: string, args: readonly string[], options?: ExecFileSyncOptions) => {
    if (cmd !== 'gh') return realExec(cmd, args, options);
    const line = args.join(' ');
    calls.push(line);
    if (line === 'api -X GET repos/acme/widgets/pulls -f state=open -f head=acme:feat/widgets') return JSON.stringify(pulls);
    if (line === 'api repos/acme/widgets/pulls/9') return JSON.stringify(PULL);
    if (line === 'api repos/acme/widgets/pulls/9/reviews --paginate') return JSON.stringify(reviews);
    if (line === 'api repos/acme/widgets/pulls/9/reviews --input -') {
      if (refusePost) throw Object.assign(new Error('Command failed: gh api'), { stderr: 'gh: Unprocessable Entity (HTTP 422)\nline must be part of the diff' });
      bodies.push(JSON.parse(typeof options?.input === 'string' ? options.input : 'null'));
      return JSON.stringify({ id: 501, html_url: `${PR_URL}#pullrequestreview-501` });
    }
    throw new Error(`unexpected gh call: ${line}`);
  };
  return { exec, calls, bodies };
}

const repos: Repo[] = [];
function repo(): Repo {
  const made = makeRepo({ git: true, files: { '.omni-loop/config.yml': CONFIG, '.omni-loop/delivery/inbox/0042-widgets/spec.md': 'x\n' } });
  repos.push(made);
  return made;
}
afterEach(() => {
  for (const made of repos.splice(0)) rmSync(made.root, { recursive: true, force: true });
});

async function omni(r: Repo, args: string[], gh = fakeGh()) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['review', ...args], { cwd: r.root, exec: gh.exec, env: {}, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } });
  return { code, out: out.join(''), err: err.join('') };
}

const FINDING = { file: 'src/widget.ts', line: 12, severity: 'major', rule: 'default › Correctness', problem: 'An empty list reads as an error.', fix: 'Return an empty page.' };

/** Writes `verdict` to a file of `r` and returns its path. */
function verdictFile(r: Repo, verdict: unknown): string {
  const path = join(r.root, 'verdict.json');
  writeFileSync(path, JSON.stringify(verdict));
  return path;
}

describe('omni review post', () => {
  it('posts one COMMENT review on the feature PR, with one inline thread per finding, at its head commit', async () => {
    const r = repo();
    const gh = fakeGh();
    const file = verdictFile(r, { round: 1, verdict: 'changes', findings: [FINDING, { ...FINDING, line: 30, severity: 'blocker' }] });
    const { code, out, err } = await omni(r, ['post', '42', '--file', file], gh);
    expect(err).toBe('');
    expect(code).toBe(0);
    expect(gh.bodies).toHaveLength(1);
    const [review] = gh.bodies as { event: string; commit_id: string; body: string; comments: { path: string; line: number; side: string; body: string }[] }[];
    expect(review?.event).toBe('COMMENT');
    expect(review?.commit_id).toBe('abc1234');
    expect(review?.body).toMatch(/^<!-- omni-review: 1 changes -->\n\*\*Round 1 of 2: 2 findings\*\*/);
    expect(review?.comments.map(({ path, line, side }) => `${path}:${String(line)}:${side}`)).toEqual(['src/widget.ts:30:RIGHT', 'src/widget.ts:12:RIGHT']);
    expect(out).toBe(`omni review: posted round 1 (changes, 2 findings) on PR #9: ${PR_URL}#pullrequestreview-501\n`);
  });

  it('never approves and never requests changes, a pass included', async () => {
    const r = repo();
    const gh = fakeGh();
    expect((await omni(r, ['post', '42', '--file', verdictFile(r, { round: 2, verdict: 'pass' })], gh)).code).toBe(0);
    const [review] = gh.bodies as { event: string; comments: unknown[]; body: string }[];
    expect(review).toMatchObject({ event: 'COMMENT', comments: [] });
    expect(review?.body).toMatch(/^<!-- omni-review: 2 pass -->/);
    expect(JSON.stringify(gh.bodies)).not.toMatch(/APPROVE|REQUEST_CHANGES/);
  });

  it('posts nothing when the feature PR already carries that round’s marker', async () => {
    const r = repo();
    const gh = fakeGh({ reviews: [posted(400, '<!-- omni-review: 1 changes -->\n**Round 1 of 2: 1 finding**')] });
    const { code, out } = await omni(r, ['post', '42', '--file', verdictFile(r, { round: 1, verdict: 'pass' })], gh);
    expect(code).toBe(0);
    expect(gh.bodies).toEqual([]);
    expect(gh.calls.filter((call) => call.endsWith('--input -'))).toEqual([]);
    expect(out).toBe(`omni review: round 1 is already posted on PR #9: ${PR_URL}#pullrequestreview-400. Nothing posted.\n`);
  });

  it('posts round 2 beside round 1', async () => {
    const r = repo();
    const gh = fakeGh({ reviews: [posted(400, '<!-- omni-review: 1 changes -->')] });
    expect((await omni(r, ['post', '42', '--file', verdictFile(r, { round: 2, verdict: 'pass' })], gh)).code).toBe(0);
    expect(gh.bodies).toHaveLength(1);
  });

  it('refuses a verdict the schema refuses, naming each field, and calls GitHub not at all', async () => {
    const r = repo();
    const gh = fakeGh();
    const { code, err } = await omni(r, ['post', '42', '--file', verdictFile(r, { round: 1, verdict: 'changes', findings: [{ ...FINDING, rule: '' }] })], gh);
    expect(code).toBe(1);
    expect(err).toMatch(/^omni review: the verdict is refused, nothing posted:\n {2}findings\.0\.rule: /);
    expect(gh.calls).toEqual([]);
  });

  it('refuses a file that is not JSON', async () => {
    const r = repo();
    const path = join(r.root, 'verdict.json');
    writeFileSync(path, 'pass');
    const gh = fakeGh();
    const { code, err } = await omni(r, ['post', '42', '--file', path], gh);
    expect(code).toBe(1);
    expect(err).toMatch(/verdict\.json is not JSON/);
    expect(gh.calls).toEqual([]);
  });

  it('takes the pull request from --pr, when given, in place of the feature branch’s', async () => {
    const r = repo();
    const gh = fakeGh();
    expect((await omni(r, ['post', '42', '--pr', '9', '--file', verdictFile(r, { round: 1, verdict: 'pass' })], gh)).code).toBe(0);
    expect(gh.calls[0]).toBe('api repos/acme/widgets/pulls/9');
  });

  it('says so, and posts nothing, when the feature branch has no open pull request', async () => {
    const r = repo();
    const gh = fakeGh({ pulls: [] });
    const { code, err } = await omni(r, ['post', '42', '--file', verdictFile(r, { round: 1, verdict: 'pass' })], gh);
    expect(code).toBe(1);
    expect(err).toBe('omni review: feat/widgets has no open pull request in acme/widgets.\n');
    expect(gh.bodies).toEqual([]);
  });

  it('exits 1 with GitHub’s first line when GitHub refuses the review', async () => {
    const r = repo();
    const { code, err } = await omni(r, ['post', '42', '--file', verdictFile(r, { round: 1, verdict: 'changes', findings: [FINDING] })], fakeGh({ refusePost: true }));
    expect(code).toBe(1);
    expect(err).toBe('omni review: GitHub refused the review: gh: Unprocessable Entity (HTTP 422)\n');
  });

  it('prints what it did as JSON with --json', async () => {
    const r = repo();
    const { out } = await omni(r, ['post', '42', '--json', '--file', verdictFile(r, { round: 1, verdict: 'pass' })]);
    expect(JSON.parse(out)).toEqual({ posted: true, pr: 9, round: 1, verdict: 'pass', url: `${PR_URL}#pullrequestreview-501` });
  });
});

describe('omni review read', () => {
  it('prints the latest round and verdict the feature PR carries', async () => {
    const r = repo();
    const reviews = [posted(400, '<!-- omni-review: 1 changes -->'), posted(401, 'A person’s review.'), posted(402, '<!-- omni-review: 2 pass -->')];
    const { code, out } = await omni(r, ['read', '42'], fakeGh({ reviews }));
    expect(code).toBe(0);
    expect(out).toBe(`round 2 pass · PR #9 · ${PR_URL}#pullrequestreview-402\n`);
  });

  it('reads the highest round, whatever order GitHub lists them in', async () => {
    const r = repo();
    const reviews = [posted(402, '<!-- omni-review: 2 changes -->'), posted(400, '<!-- omni-review: 1 changes -->')];
    const { out } = await omni(r, ['read', '42', '--json'], fakeGh({ reviews }));
    expect(JSON.parse(out)).toEqual({ pr: 9, round: 2, verdict: 'changes', url: `${PR_URL}#pullrequestreview-402` });
  });

  it('prints none when no review carries the marker', async () => {
    const r = repo();
    const reviews = [posted(401, 'LGTM')];
    expect((await omni(r, ['read', '42'], fakeGh({ reviews }))).out).toBe('none · PR #9 has no Reviewer review yet\n');
    expect(JSON.parse((await omni(r, ['read', '42', '--json'], fakeGh({ reviews }))).out)).toEqual({ pr: 9, round: null, verdict: null, url: null });
  });
});

describe('omni review look-for', () => {
  it('prints the kit default’s six items, numbered, in order of harm', async () => {
    const r = repo();
    const gh = fakeGh();
    const { code, out } = await omni(r, ['look-for'], gh);
    expect(code).toBe(0);
    expect(out.split('\n').filter(Boolean).map((line) => /^(\d+)\. \*\*(.+?):\*\*/.exec(line)?.slice(1).join(' '))).toEqual([
      '1 Correctness',
      '2 Security and data',
      '3 Tests that prove it',
      '4 Scope',
      '5 Laws and conventions',
      '6 Design and complexity',
    ]);
    expect(gh.calls).toEqual([]);
  });
});

describe('omni review — its usage', () => {
  it('refuses an unknown subcommand, and post without --file', async () => {
    const r = repo();
    expect((await omni(r, ['approve', '42'])).code).toBe(2);
    expect((await omni(r, ['post', '42'])).code).toBe(2);
    expect((await omni(r, ['read'])).code).toBe(2);
  });
});
