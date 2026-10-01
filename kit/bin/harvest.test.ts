// @ts-nocheck
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gradeKnowledge } from '../lib/knowledge/check-knowledge.ts';
import { prepareHarvest, finishHarvest } from '../lib/knowledge/pipeline.ts';
import { makeMarkers } from '../lib/markers.ts';
import { findOutboxViolations } from '../lib/outbox/check-outbox.ts';
import { parseOutboxItem } from '../lib/outbox/outbox.ts';
import { parseSettledEntries, renderAdoptedEntry, renderSettledEntry, settledHeader } from '../lib/outbox/settle.ts';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

const markers = makeMarkers('omni-outbox');
const K = '.omni-loop/knowledge';
const D = '.omni-loop/delivery';
const INBOX = `${D}/inbox/0042-widgets`;
const OUTBOX = `${D}/outbox/0042-widgets`;
const SHIPPED = `${D}/shipped/0042-widgets`;
const LEDGER = `${SHIPPED}/outbox/settled.md`;
const KEY = 'test-key-not-a-secret';
const TODAY = new Date().toISOString().slice(0, 10);

function itemText({ id, rank, slice = 's1', personSteps = false }) {
  const last = personSteps
    ? ['## What a person must do', '', '1. Set the secret in the console.', '']
    : ['## The options, in plain words', '', 'A. Keep what was built.', 'B. Change it.', ''];
  return [
    '---',
    `id: ${id}`,
    'prd: 42',
    `slice: ${slice}`,
    `rank: ${rank}`,
    'bears-on: none',
    'raised: 2026-09-24',
    'wave: 1',
    '---',
    '',
    '## The question, in plain words',
    '',
    `Should ${id} ship as it is?`,
    '',
    '## The decision, in plain words',
    '',
    'Yes, this is the fixture answer.',
    '',
    ...last,
    '## What I had to decide',
    '',
    `How ${id} is built.`,
    '',
    '## What I did meanwhile',
    '',
    'Built the simple way.',
    '',
    '## What it costs to change later',
    '',
    'One constant.',
    '',
    '## What I could not know',
    '',
    '(author) Nothing settles it.',
    '',
  ].join('\n');
}

function adopted(id) {
  const text = itemText({ id, rank: 'medium', slice: 's0' });
  return renderAdoptedEntry({ item: parseOutboxItem(text).item, itemText: text, markers });
}

function drifted(id) {
  const text = itemText({ id, rank: 'high', slice: 's0' });
  return renderSettledEntry({
    item: parseOutboxItem(text).item,
    itemText: text,
    answer: {
      text: 'No, build it the other way.',
      approvedBy: '@ada',
      approvedAt: '2026-09-25T10:00:00Z',
      channel: { kind: 'feature-pull-request', number: 43 },
    },
    judgement: { verdict: 'drifted', basis: 'stated', reason: 'a human said so' },
    markers,
  });
}

const LEDGER_TEXT = [
  settledHeader(42, { ctx: { config: { paths: { delivery: D } } } }),
  adopted('s0-01-local-name'),
  adopted('s0-02-cited'),
  adopted('s0-03-refused'),
  drifted('s0-04-drift'),
].join('\n');

const FILES = {
  '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n',
  [`${K}/README.md`]: '# Knowledge\n',
  [`${K}/product/principles.md`]: [
    '# Product principles',
    '',
    '## P-PRODUCT-1',
    '',
    'A person reviews every change before it reaches the default branch.',
    '',
    'Why: nothing merges unseen.',
    'Decided: @ada, 2026-09-01',
    'Source: PRD #3',
    '',
  ].join('\n'),
  [`${K}/product/rules.md`]: '# Product rules\n\nNone yet.\n',
  [`${K}/product/invariants.md`]: '# Product invariants\n\nNone yet.\n',
  [`${K}/adr/README.md`]: '# Decisions\n',
  [`${K}/adr/0001-outbox-check-as-app.md`]: '# ADR-0001 — The outbox check runs as an app\n\nBody.\n',
  [`${INBOX}/spec.md`]: '# Widgets\n',
  [`${INBOX}/plan.md`]: `# Plan\n\nThe spec: \`${INBOX}/spec.md\`. The outbox: \`${OUTBOX}\`.\n`,
  [`${OUTBOX}/settled.md`]: LEDGER_TEXT,
  [`${OUTBOX}/s1-01-high-one.md`]: itemText({ id: 's1-01-high-one', rank: 'high' }),
  [`${OUTBOX}/s1-02-set-secret.md`]: itemText({ id: 's1-02-set-secret', rank: 'human-action', personSteps: true }),
};

const REPLIES = {
  's1-01-high-one': { kind: 'adr', title: 'Widgets are built the simple way', statement: 'Widgets are built the simple way.', reason: 'how it is built' },
  's1-02-set-secret': {
    kind: 'rule',
    place: 'product',
    statement: 'A secret is set in the console, never in the repository.',
    serves: 'new',
    principle: { statement: 'Secrets never live in the repository.', why: 'a leaked file leaks the secret.' },
    reason: 'a provable rule with no principle yet',
  },
  's0-01-local-name': { kind: 'stays-here', statement: 'A local naming choice.', reason: 'a local choice, nothing lasting' },
  's0-02-cited': { kind: 'invariant', place: 'product', statement: 'This holds as BR-GHOST-9 says.', reason: 'must always hold' },
  's0-03-refused': { kind: 'nonsense', reason: 'wrong' },
  's0-04-drift': { kind: 'covered', covers: 'ADR-0001', reason: 'the record says it' },
};

const MERGED_PR = {
  number: 43,
  html_url: 'https://github.com/acme/widgets/pull/43',
  merged_at: '2026-09-26T10:30:00Z',
  merged_by: { login: 'octocat' },
  merge_commit_sha: 'abcdef1234567890',
  base: { ref: 'main' },
  head: { ref: 'feat/widgets' },
};

function io() {
  const out = [];
  const err = [];
  return { out, err, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } };
}

function fakeExec(pr, calls = []) {
  return (cmd, args, options) => {
    if (cmd === 'gh') {
      calls.push(args);
      return JSON.stringify(pr);
    }
    return execFileSync(cmd, args, options);
  };
}

/** A fake OpenRouter: the reply the prompt's decision id is given, from `replies`. */
function fakeFetch(replies) {
  return vi.fn(async (_url, init) => {
    const body = JSON.parse(init.body);
    const user = body.messages.find((m) => m.role === 'user').content;
    const id = /^## The decision: (\S+)$/m.exec(user)[1];
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(replies[id]) } }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
}

const repos = [];
function repo(files = FILES) {
  const r = makeRepo({ files, git: true });
  repos.push(r);
  return r;
}
const head = (root) => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const status = (root) => execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });

let fetch;
beforeEach(() => {
  fetch = fakeFetch(REPLIES);
  vi.stubGlobal('fetch', fetch);
});
afterEach(() => {
  vi.unstubAllGlobals();
  while (repos.length) rmSync(repos.pop().root, { recursive: true, force: true });
});

async function harvest(r, { args = ['42', '--pr', '43'], pr = MERGED_PR, env = { OPENROUTER_API_KEY: KEY } } = {}) {
  const streams = io();
  const calls = [];
  const code = await main(['harvest', ...args], { cwd: r.root, exec: fakeExec(pr, calls), env, ...streams });
  return { code, out: streams.out.join(''), err: streams.err.join(''), calls };
}

describe('omni harvest — the happy path, on a PRD merged over red', () => {
  it('settles, ships, writes the knowledge, prints it, commits nothing and exits 0', async () => {
    const r = repo();
    const before = head(r.root);
    const { code, out, err, calls } = await harvest(r);
    expect(err).toBe('');
    expect(code).toBe(0);
    expect(calls).toEqual([['api', 'repos/acme/widgets/pulls/43']]);
    expect(head(r.root)).toBe(before);

    // Settled at merge: the open items adopted by the merger, their files gone.
    expect(existsSync(join(r.root, INBOX))).toBe(false);
    expect(existsSync(join(r.root, OUTBOX))).toBe(false);
    expect(existsSync(join(r.root, `${SHIPPED}/spec.md`))).toBe(true);
    expect(existsSync(join(r.root, `${SHIPPED}/outbox/s1-01-high-one.md`))).toBe(false);
    const ledger = r.read(LEDGER);
    expect(ledger.startsWith(LEDGER_TEXT)).toBe(false); // lines were added inside entries
    const latest = Object.fromEntries(parseSettledEntries(ledger, markers).map((e) => [e.id, e]));
    for (const id of ['s1-01-high-one', 's1-02-set-secret', 's0-04-drift']) {
      expect(latest[id].verdict).toBe('adopted');
      expect(latest[id].fields['Approved by']).toBe('@octocat');
      expect(latest[id].fields.Basis).toMatch(/^merged-over-red/);
    }
    // The plan's paths follow the move.
    expect(r.read(`${SHIPPED}/plan.md`)).toContain(`\`${SHIPPED}/spec.md\``);
    expect(r.read(`${SHIPPED}/plan.md`)).toContain(`\`${SHIPPED}/outbox\``);

    // The knowledge, and the ledger lines.
    expect(r.read(`${K}/adr/0002-widgets-are-built-the-simple-way.md`)).toContain(
      '**Status:** adopted · **Date:** 2026-09-26 · **PRD:** #42 · **Decided:** @octocat — merged over a red outbox, 2026-09-26 · **Merged:** @octocat, 2026-09-26, PR #43',
    );
    expect(r.read(`${K}/product/rules.md`)).toContain('## BR-PRODUCT-1');
    expect(r.read(`${K}/product/rules.md`)).toContain(`Proposed: harvest ${TODAY}`);
    expect(r.read(`${K}/product/principles.md`)).toContain('## P-PRODUCT-2');
    expect(latest['s1-01-high-one'].became).toEqual(['ADR-0002']);
    expect(latest['s1-02-set-secret'].became).toEqual(['BR-PRODUCT-1', 'P-PRODUCT-2']);
    expect(latest['s0-04-drift'].became).toEqual(['ADR-0001']);
    expect(latest['s0-01-local-name'].fields['Stays here']).toBe('a local choice, nothing lasting');

    expect(out).toContain('omni harvest — PRD 42, pull request #43 merged by @octocat on 2026-09-26 (abcdef1):');
    expect(out).toContain('settled at merge: 2 open item(s), 1 drift(s) never reworked, adopted by @octocat');
    expect(out).toContain(`shipped: ${INBOX} → ${SHIPPED}`);
    expect(out).toContain(`wrote ${K}/adr/0002-widgets-are-built-the-simple-way.md`);
    expect(out).toContain('s1-01-high-one → ADR-0002 (new, adopted) — how it is built');
    expect(out).toContain('s1-02-set-secret → BR-PRODUCT-1, P-PRODUCT-2 (new, proposed)');
    expect(out).toContain('s0-04-drift → covered by ADR-0001');
    expect(out).toContain('s0-01-local-name → stays here');
    expect(out).toContain('checks: omni check knowledge ✓ · omni check outbox ✓');

    // Both checks green on the result.
    const ctx = r.ctx;
    const files = ['principles', 'rules', 'invariants'].map((f) => `${K}/product/${f}.md`);
    expect(gradeKnowledge({ ctx, files }).violations).toEqual([]);
    expect(findOutboxViolations({ ctx })).toEqual([]);
    expect(status(r.root)).not.toMatch(/^[AMDR]/m); // nothing staged
  });

  it('prints an entry the checks refuse as not placed, with the message, and gives it no ledger line', async () => {
    const r = repo();
    const { code, out } = await harvest(r);
    expect(code).toBe(0);
    expect(out).toMatch(/s0-02-cited — the checks refused it: .*BR-GHOST-9/);
    const latest = Object.fromEntries(parseSettledEntries(r.read(LEDGER), markers).map((e) => [e.id, e]));
    expect(latest['s0-02-cited'].became).toEqual([]);
    expect(latest['s0-02-cited'].fields['Stays here']).toBeUndefined();
    expect(r.read(`${K}/product/invariants.md`)).not.toContain('BR-GHOST-9');
  });

  it('prints a candidate whose reply is refused twice as not placed', async () => {
    const r = repo();
    const { out } = await harvest(r);
    expect(out).toMatch(/s0-03-refused — the model's reply was refused twice/);
    const latest = Object.fromEntries(parseSettledEntries(r.read(LEDGER), markers).map((e) => [e.id, e]));
    expect(latest['s0-03-refused'].became).toEqual([]);
    const refusedCalls = fetch.mock.calls.filter(([, init]) => init.body.includes('## The decision: s0-03-refused'));
    expect(refusedCalls).toHaveLength(2);
  });
});

describe('omni harvest — refusals', () => {
  it('exits 1 for a pull request that is not merged, writing nothing', async () => {
    const r = repo();
    const { code, err } = await harvest(r, { pr: { ...MERGED_PR, merged_at: null, merged_by: null } });
    expect(code).toBe(1);
    expect(err).toContain('pull request #43 is not merged');
    expect(status(r.root)).toBe('');
  });

  it('exits 1 for a pull request merged into another branch, writing nothing', async () => {
    const r = repo();
    const { code, err } = await harvest(r, { pr: { ...MERGED_PR, base: { ref: 'feat/widgets' } } });
    expect(code).toBe(1);
    expect(err).toContain('merged into feat/widgets, not into main');
    expect(status(r.root)).toBe('');
  });

  it('exits 2 without OPENROUTER_API_KEY, asking nothing and writing nothing', async () => {
    const r = repo();
    const { code, err, calls } = await harvest(r, { env: {} });
    expect(code).toBe(2);
    expect(err).toContain('OPENROUTER_API_KEY is not set');
    expect(calls).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
    expect(status(r.root)).toBe('');
  });

  it.each([
    [['42']],
    [['--pr', '43']],
    [['42', '--pr']],
    [['x', '--pr', '43']],
    [['42', '--pr', '43', '--nope']],
  ])('exits 2 on a usage error: %j', async (args) => {
    const r = repo();
    const { code } = await harvest(r, { args });
    expect(code).toBe(2);
    expect(status(r.root)).toBe('');
  });

  it('exits 2 for a PRD the repository does not hold', async () => {
    const r = repo();
    const { code, err } = await harvest(r, { args: ['7', '--pr', '43'] });
    expect(code).toBe(2);
    expect(err).toContain('PRD 7 has no inbox or shipped folder');
  });
});

describe('the pipeline halves', () => {
  const MERGE = { by: 'octocat', at: '2026-09-26T10:30:00Z', pr: 43, url: 'https://github.com/acme/widgets/pull/43' };

  it('return edits as data, touch no file, and give the same edits for the same input', () => {
    const r = repo();
    const run = () => {
      const prepared = prepareHarvest({ ctx: r.ctx, prd: 42, merge: MERGE });
      const classified = prepared.candidates.map((c) =>
        c.id === 's0-03-refused' ? { id: c.id, reply: null, reason: 'refused' } : { id: c.id, reply: REPLIES[c.id] },
      );
      return { prepared, finished: finishHarvest({ ctx: r.ctx, prepared, classified, merge: MERGE, date: '2026-09-27' }) };
    };
    const first = run();
    expect(status(r.root)).toBe('');
    expect(first.prepared.ok).toBe(true);
    expect(first.prepared.edits.moves).toEqual([
      { from: INBOX, to: SHIPPED },
      { from: OUTBOX, to: `${SHIPPED}/outbox` },
    ]);
    expect(first.prepared.edits.deletes).toEqual([`${OUTBOX}/s1-01-high-one.md`, `${OUTBOX}/s1-02-set-secret.md`]);
    expect(first.prepared.candidates.map((c) => c.id).sort()).toEqual([
      's0-01-local-name',
      's0-02-cited',
      's0-03-refused',
      's0-04-drift',
      's1-01-high-one',
      's1-02-set-secret',
    ]);
    expect(first.prepared.candidates.every((c) => c.ledgerFile === LEDGER)).toBe(true);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(run()).toEqual(first);
  });

  it('prepare refuses a PRD the tree does not hold', () => {
    const r = repo();
    expect(prepareHarvest({ ctx: r.ctx, prd: 7, merge: MERGE })).toEqual({ ok: false, errors: ['PRD 7 has no inbox or shipped folder'] });
  });

  it('with nothing classified, settles and ships, and places nothing', () => {
    const r = repo();
    const prepared = prepareHarvest({ ctx: r.ctx, prd: 42, merge: MERGE });
    const classified = prepared.candidates.map((c) => ({ id: c.id, reply: null, reason: 'OPENROUTER_API_KEY is not set' }));
    const finished = finishHarvest({ ctx: r.ctx, prepared, classified, merge: MERGE, date: '2026-09-27' });
    expect(finished.placed).toEqual([]);
    expect(finished.notPlaced).toHaveLength(prepared.candidates.length);
    expect(finished.edits.moves).toEqual(prepared.edits.moves);
    expect(finished.edits.writes.map((w) => w.path)).toEqual([LEDGER, `${SHIPPED}/plan.md`]);
    expect(finished.checks).toEqual({ knowledge: [], outbox: [] });
  });

  it('a shipped PRD with nothing left to write back gives no edits', async () => {
    const r = repo();
    await harvest(r);
    execFileSync('git', ['add', '-A'], { cwd: r.root });
    const prepared = prepareHarvest({ ctx: r.ctx, prd: 42, merge: MERGE });
    const leftover = prepared.candidates.map((c) => c.id).sort();
    expect(leftover).toEqual(['s0-02-cited', 's0-03-refused']);
    expect(prepared.edits).toEqual({ deletes: [], moves: [], writes: [] });
  });
});
