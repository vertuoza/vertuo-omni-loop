// @ts-nocheck
import { execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { makeMarkers } from '../lib/markers.ts';
import { formatNumbersMarker } from '../lib/outbox/comment.ts';
import { main } from './omni.ts';

const markers = makeMarkers('omni-outbox');
const OUTBOX = '.omni-loop/delivery/outbox/0042-widgets';

function itemText(id, rank, letters = ['A', 'B']) {
  const body = rank === 'human-action'
    ? ['## What a person must do', '', '1. Add the secret to the project.', '']
    : ['## The options, in plain words', '', ...letters.map((letter) => `${letter}. Option ${letter} for ${id}.`), ''];
  return [
    '---', `id: ${id}`, 'prd: 42', `slice: ${id.split('-')[0]}`, `rank: ${rank}`, 'bears-on: none',
    'raised: 2026-09-27', 'wave: 1', '---', '',
    '## The question, in plain words', '', `Which way for ${id}?`, '',
    '## The decision, in plain words', '', 'We kept the first way.', '',
    ...body,
    '## What I had to decide', '', 'x', '',
    '## What I did meanwhile', '', 'Kept the first way.', '',
    '## What it costs to change later', '', 'z', '',
    '## What I could not know', '', '(author) w', '',
  ].join('\n');
}

const ITEMS = {
  's1-01-list': 'high',
  's1-02-order': 'high',
  's1-03-label': 'high',
  's1-04-copy': 'high',
  's1-05-color': 'high',
  's2-01-secret': 'human-action',
  's2-02-width': 'medium',
};
const NUMBERING = [
  { number: 1, id: 's1-01-list' },
  { number: 2, id: 's1-02-order' },
  { number: 3, id: 's1-03-label' },
  { number: 4, id: 's1-04-copy' },
  { number: 5, id: 's2-02-width' },
  { number: 6, id: 's1-05-color' },
  { number: 19, id: 's2-01-secret' },
].map((entry) => ({ ...entry, since: '2026-09-27T08:00:00Z' }));

function files({ items = ITEMS, config = '' } = {}) {
  const out = {
    '.omni-loop/config.yml': `kit: 1\nrepo:\n  slug: acme/widgets\n${config}`,
    '.omni-loop/delivery/inbox/0042-widgets/spec.md': 'x\n',
  };
  for (const [id, rank] of Object.entries(items)) out[`${OUTBOX}/wave-1/${id}.md`] = itemText(id, rank);
  return out;
}

const PR_COMMENT = {
  id: 1,
  body: `${markers.prComment}\n${formatNumbersMarker(NUMBERING, markers)}\n\n## Outbox questions`,
  user: { login: 'omni-loop[bot]' },
  author_association: 'NONE',
  created_at: '2026-09-27T08:00:00Z',
  html_url: 'https://github.com/acme/widgets/pull/9#issuecomment-1',
};

/** A fake `gh`: lists `comments`, records every comment posted, and fails to post when told to. */
function fakeGh({ comments = [PR_COMMENT], failPost = false } = {}) {
  const posted = [];
  const calls = [];
  const exec = (cmd, args, options) => {
    if (cmd !== 'gh') return execFileSync(cmd, args, options);
    calls.push(args);
    if (args.includes('--paginate')) return JSON.stringify(comments);
    if (args.includes('--input')) {
      if (failPost) throw new Error('HTTP 403: Resource not accessible');
      posted.push(JSON.parse(options.input).body);
      return JSON.stringify({ id: 77, html_url: 'https://github.com/acme/widgets/pull/9#issuecomment-77' });
    }
    throw new Error(`unexpected gh call: ${args.join(' ')}`);
  };
  return { exec, posted, calls };
}

const repos = [];
function repo(options) {
  const r = makeRepo({ files: files(options), git: true });
  repos.push(r);
  return r;
}
afterEach(() => {
  while (repos.length) rmSync(repos.pop().root, { recursive: true, force: true });
});

async function omni(r, args, gh = fakeGh()) {
  const out = [];
  const err = [];
  const code = await main(['answers', ...args], {
    cwd: r.root,
    exec: gh.exec,
    env: {},
    stdout: { write: (s) => out.push(s) },
    stderr: { write: (s) => err.push(s) },
  });
  return { code, out: out.join(''), err: err.join('') };
}

describe('omni answers ask (PRD 251)', () => {
  it('prints the open human actions and highs in batches of four, human action first, numbered as the pull request shows', async () => {
    const r = repo();
    const { code, out, err } = await omni(r, ['ask', '42', '--pr', '9', '--json']);
    expect(err).toBe('');
    expect(code).toBe(0);
    const printed = JSON.parse(out);
    expect(printed).toMatchObject({ prd: 42, pr: 9 });
    expect(printed.batches.map((batch) => batch.map((question) => question.number))).toEqual([[19, 1, 2, 3], [4, 6]]);
    expect(printed.batches[0][0]).toMatchObject({
      number: 19,
      id: 's2-01-secret',
      header: 'Q19 · action',
      options: [{ pick: 'done', label: 'Done' }, { pick: 'not-done', label: 'Not done' }],
    });
    expect(printed.batches[0][1]).toMatchObject({
      number: 1,
      header: 'Q1 · high',
      text: 'Which way for s1-01-list? We kept the first way.',
      options: [{ pick: 'A', label: 'A · built' }, { pick: 'B', label: 'B' }],
    });
    expect(out).not.toContain('s2-02-width');
  });

  it('prints the same questions as text without --json', async () => {
    const r = repo();
    const { code, out } = await omni(r, ['ask', '42', '--pr', '9']);
    expect(code).toBe(0);
    expect(out).toContain('Batch 1 of 2');
    expect(out).toContain('Q19 · action (s2-01-secret)');
    expect(out).toContain('  A · built — Option A for s1-01-list.');
    expect(out).not.toContain('Q5 ');
  });

  it('exits 1 with one line when nothing is open', async () => {
    const r = repo({ items: { 's2-02-width': 'medium' } });
    const { code, out, err } = await omni(r, ['ask', '42', '--pr', '9']);
    expect(code).toBe(1);
    expect(out).toBe('');
    expect(err.trim().split('\n')).toEqual(['omni answers: nothing to ask on PRD 42 — no open human-action or high question.']);
  });

  it('exits 1 with one line when the pull request carries no outbox comment yet', async () => {
    const r = repo();
    const { code, err } = await omni(r, ['ask', '42', '--pr', '9'], fakeGh({ comments: [] }));
    expect(code).toBe(1);
    expect(err.trim().split('\n')).toHaveLength(1);
  });

  it('exits 1 with one line when the switch is off, and reads no comment', async () => {
    const r = repo({ config: 'answers:\n  enabled: false\n' });
    const gh = fakeGh();
    const { code, err } = await omni(r, ['ask', '42', '--pr', '9'], gh);
    expect(code).toBe(1);
    expect(err.trim().split('\n')).toEqual(['omni answers: answers.enabled is false in .omni-loop/config.yml — answer on the pull request.']);
    expect(gh.calls).toEqual([]);
  });

  it('exits 2 on a usage error', async () => {
    const r = repo();
    expect((await omni(r, ['ask', '--pr', '9'])).code).toBe(2);
    expect((await omni(r, ['ask', '42'])).code).toBe(2);
    expect((await omni(r, ['nope'])).code).toBe(2);
  });
});

describe('omni answers post (PRD 251)', () => {
  const answersFile = (r, picks) => {
    const path = join(r.root, 'answers.json');
    writeFileSync(path, JSON.stringify(picks));
    return path;
  };

  it('posts the reply once and prints its link', async () => {
    const r = repo();
    const gh = fakeGh();
    const file = answersFile(r, [{ number: 19, pick: 'done' }, { number: 2, pick: 'B', reason: 'shorter\nlist' }]);
    const { code, out, err } = await omni(r, ['post', '--prd', '42', '--pr', '9', '--answers', file], gh);
    expect(err).toBe('');
    expect(code).toBe(0);
    expect(gh.posted).toEqual(['2: B because shorter list\n19: ok\n\n_answered in the terminal · PRD 42_']);
    expect(out.trim()).toBe('https://github.com/acme/widgets/pull/9#issuecomment-77');
    expect(gh.calls.filter((args) => args.includes('--input'))[0]).toContain('repos/acme/widgets/issues/9/comments');
  });

  it('prints the reply and posts nothing with --print', async () => {
    const r = repo();
    const gh = fakeGh();
    const file = answersFile(r, [{ number: 1, pick: 'A' }]);
    const { code, out } = await omni(r, ['post', '--prd', '42', '--pr', '9', '--answers', file, '--print'], gh);
    expect(code).toBe(0);
    expect(out).toBe('1: A\n\n_answered in the terminal · PRD 42_\n');
    expect(gh.posted).toEqual([]);
  });

  it('exits 1 and posts nothing when a pick is refused', async () => {
    const r = repo();
    const gh = fakeGh();
    const file = answersFile(r, [{ number: 1, pick: 'A' }, { number: 19, pick: 'not-done' }]);
    const { code, out, err } = await omni(r, ['post', '--prd', '42', '--pr', '9', '--answers', file], gh);
    expect(code).toBe(1);
    expect(out).toBe('');
    expect(err.trim()).toBe('omni answers: refused — question 19: not-done needs a reason');
    expect(gh.posted).toEqual([]);
  });

  it('exits 1 and prints the reply to paste when the post fails', async () => {
    const r = repo();
    const file = answersFile(r, [{ number: 1, pick: 'A' }]);
    const { code, out, err } = await omni(r, ['post', '--prd', '42', '--pr', '9', '--answers', file], fakeGh({ failPost: true }));
    expect(code).toBe(1);
    expect(err).toMatch(/^omni answers: the reply was not posted \(HTTP 403: Resource not accessible\)/);
    expect(out).toBe('1: A\n\n_answered in the terminal · PRD 42_\n');
  });

  it('exits 1 on an answers file that is not JSON, and 2 on one it cannot read', async () => {
    const r = repo();
    const path = join(r.root, 'answers.json');
    writeFileSync(path, 'not json');
    const bad = await omni(r, ['post', '--prd', '42', '--pr', '9', '--answers', path]);
    expect(bad.code).toBe(1);
    expect(bad.err).toMatch(/not JSON/);
    expect((await omni(r, ['post', '--prd', '42', '--pr', '9', '--answers', 'missing.json'])).code).toBe(2);
    expect((await omni(r, ['post', '--prd', '42', '--pr', '9'])).code).toBe(2);
  });
});
