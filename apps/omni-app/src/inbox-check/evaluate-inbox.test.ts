// @ts-nocheck
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCanon } from '../canon/canon.ts';
import { readCanonMarker } from './canon-actions.ts';
import { evaluateInbox, inboxPrd, phase0Topic } from './evaluate-inbox.ts';

const FIXTURES = fileURLToPath(new URL('../../test/fixtures/', import.meta.url));
const fixture = (name) => join(FIXTURES, name);

const TRAILER = 'Co-authored-by: Omni-man <333776611+omni-loop-invader[bot]@users.noreply.github.com>';
const FOLDER = '.omni-loop/delivery/inbox/0042-widget';
const COMPLETE_CHANGES = ['spec.md', 'plan.md', 'before-after.html'].map((file) => ({ path: `${FOLDER}/${file}`, status: 'A' }));
const SIGNED = [{ sha: 'c1', message: `docs(phase-0): widget\n\n${TRAILER}` }];
const OPEN_ISSUE = { number: 42, state: 'open', labels: ['omni:prd'], isPullRequest: false };

const BUSINESS = Object.freeze({
  state: 'ok',
  business: { name: 'Acme' },
  product: null,
  claims: [
    { id: 'size#1', kind: 'size', value: '2-20', source: 'pick', state: 'confirmed' },
    { id: 'never#4', kind: 'never', value: 'Never: build for groups of companies', source: 'pick', state: 'confirmed' },
  ],
  personas: [{ name: 'Marc', stance: 'skeptic', trade: 'plumbing', who: 'runs five plumbers', usage: 'phone' }],
  updatedAt: '2026-09-30T10:00:00Z',
});
const FITS = { findings: [], persona: { name: '', line: '' } };
// The fixture's spec.md reads "A phase-0 fixture: a complete PRD folder."
const BREAKS = {
  findings: [{ quote: 'a complete PRD   folder', claims: ['never#4'], why: 'a group' }],
  persona: { name: 'Marc', line: 'Not for my five plumbers.' },
};

/** The canon gate on a stubbed business and a stubbed model answering `reply`. */
function stubbedCanon({ business = BUSINESS, reply = FITS, answer } = {}) {
  const readBusiness = vi.fn(async () => business);
  const ask = vi.fn(async ({ check }) => answer ?? { ok: true, error: null, reply: check(reply).reply, reason: null });
  return { canon: createCanon({ readBusiness, ask }), readBusiness, ask };
}

const input = (over = {}) => ({
  base: fixture('inbox-base'),
  head: fixture('inbox-head-complete'),
  pr: { headRef: 'docs/phase-0-widget' },
  repo: 'acme/widgets',
  changes: COMPLETE_CHANGES,
  commits: SIGNED,
  issue: OPEN_ISSUE,
  canon: stubbedCanon().canon,
  ...over,
});

describe('phase0Topic — the topic a head branch names through branches.phase0', () => {
  it('reads the topic back from the template', () => {
    expect(phase0Topic('docs/phase-0-widget', 'docs/phase-0-{topic}')).toBe('widget');
    expect(phase0Topic('p0/widget/x', 'p0/{topic}/x')).toBe('widget');
  });

  it('is null for a branch of another shape, an empty topic, or a template without {topic}', () => {
    expect(phase0Topic('feat/widget', 'docs/phase-0-{topic}')).toBeNull();
    expect(phase0Topic('docs/phase-0-', 'docs/phase-0-{topic}')).toBeNull();
    expect(phase0Topic('docs/phase-0-widget', 'docs/phase-0')).toBeNull();
    expect(phase0Topic(undefined, 'docs/phase-0-{topic}')).toBeNull();
  });
});

describe('inboxPrd — the PRD whose inbox folder carries the topic', () => {
  it('finds the number in the head snapshot, or null', async () => {
    const { parseConfig } = await import('vertuo-omni-plan/kit/lib/config.ts');
    const config = parseConfig('kit: 1\nrepo:\n  slug: acme/widgets\n', 'config.yml');
    expect(inboxPrd({ head: fixture('inbox-head-complete'), config, topic: 'widget' })).toBe(42);
    expect(inboxPrd({ head: fixture('inbox-head-complete'), config, topic: 'gadget' })).toBeNull();
  });
});

describe('evaluateInbox — silent where it is not a phase-0 PR', () => {
  let empty;
  afterEach(() => empty && rmSync(empty, { recursive: true, force: true }));

  it('is null for a head branch of another shape', async () => {
    expect(await evaluateInbox(input({ pr: { headRef: 'feat/widget' } }))).toBeNull();
    expect(await evaluateInbox(input({ pr: { headRef: 'feat/widget--s1' } }))).toBeNull();
  });

  it('is null when the base branch has no config', async () => {
    empty = mkdtempSync(join(tmpdir(), 'inbox-empty-'));
    expect(await evaluateInbox(input({ base: empty }))).toBeNull();
  });
});

describe('evaluateInbox — the four gates', () => {
  it('a complete phase-0 PR is success, with five ok lines', async () => {
    const verdict = await evaluateInbox(input());
    expect(verdict.conclusion).toBe('success');
    expect(verdict.prd).toBe(42);
    expect(verdict.gates.map((gate) => [gate.name, gate.ok])).toEqual([
      ['phase-0 verdict', true],
      ['inbox folder', true],
      ['plan', true],
      ['PRD issue', true],
      ['canon', true],
    ]);
    expect(verdict.summary.match(/^- ok — /gm)).toHaveLength(5);
    expect(verdict.title).toBe('Phase-0 PR complete: 5 of 5 gates ok · canon ✓ · 2 claims read');
  });

  it('a broken inbox folder of another PRD changes nothing', async () => {
    // inbox-head-complete also holds 0043-broken, whose spec is malformed.
    expect((await evaluateInbox(input())).conclusion).toBe('success');
  });

  it('a missing plan.md is failure, naming the plan', async () => {
    const verdict = await evaluateInbox(
      input({ head: fixture('inbox-head-no-plan'), changes: COMPLETE_CHANGES.filter((c) => !c.path.endsWith('plan.md')) }),
    );
    expect(verdict.conclusion).toBe('failure');
    expect(failed(verdict)).toEqual(['phase-0 verdict', 'plan']);
    expect(verdict.summary).toContain(`not ok — plan: no plan.md in ${FOLDER}`);
    expect(verdict.summary).toContain('nothing in it is the plan');
    expect(verdict.title).toBe('Not ok: phase-0 verdict, plan');
  });

  it('a source file is failure, naming the file', async () => {
    const verdict = await evaluateInbox(input({ changes: [...COMPLETE_CHANGES, { path: 'src/widget.mjs', status: 'A' }] }));
    expect(verdict.conclusion).toBe('failure');
    expect(failed(verdict)).toEqual(['phase-0 verdict']);
    expect(verdict.summary).toContain('src/widget.mjs');
  });

  it('an unsigned commit is failure, naming the commit', async () => {
    const verdict = await evaluateInbox(input({ commits: [...SIGNED, { sha: 'c2', message: 'docs: unsigned' }] }));
    expect(verdict.conclusion).toBe('failure');
    expect(failed(verdict)).toEqual(['phase-0 verdict']);
    expect(verdict.summary).toContain('unsigned: c2');
  });

  it('a spec that breaks the inbox rules is failure, naming the inbox folder', async () => {
    const verdict = await evaluateInbox(input({ head: fixture('inbox-head-bad-spec') }));
    expect(failed(verdict)).toEqual(['inbox folder']);
    expect(verdict.summary).toContain('does not agree with its folder');
  });

  it('a plan the kit refuses is failure, naming the plan', async () => {
    const verdict = await evaluateInbox(input({ head: fixture('inbox-head-bad-plan') }));
    expect(failed(verdict)).toEqual(['plan']);
    expect(verdict.summary).toContain('a blocker must sit in an earlier wave');
  });

  it.each([
    ['closed', { ...OPEN_ISSUE, state: 'closed' }, 'issue #42 is closed'],
    ['unlabelled', { ...OPEN_ISSUE, labels: ['bug'] }, 'issue #42 does not carry the label omni:prd'],
    ['missing', null, 'issue #42 does not exist'],
    ['a pull request', { ...OPEN_ISSUE, isPullRequest: true }, '#42 is a pull request, not an issue'],
  ])('a PRD issue that is %s is failure, saying so', async (_, issue, reason) => {
    const verdict = await evaluateInbox(input({ issue }));
    expect(verdict.conclusion).toBe('failure');
    expect(failed(verdict)).toEqual(['PRD issue']);
    expect(verdict.summary).toContain(`not ok — PRD issue: ${reason}`);
  });

  it('a topic with no inbox folder is failure: no inbox folder for topic', async () => {
    const verdict = await evaluateInbox(input({ pr: { headRef: 'docs/phase-0-gadget' } }));
    expect(verdict.conclusion).toBe('failure');
    expect(verdict.prd).toBeNull();
    expect(verdict.title).toBe('no inbox folder for topic `gadget`');
  });

  it('reads the phase-0 shape from the base config', async () => {
    expect((await evaluateInbox(input({ base: fixture('inbox-base-renamed') }))).name).toBe('phase-0 shape');
    expect((await evaluateInbox(input())).name).toBe('inbox');
  });
});

describe('evaluateInbox — the canon gate, fifth', () => {
  it('green: "canon ✓ · N claims read", read by the PR\'s repository against its spec.md', async () => {
    const { canon, readBusiness, ask } = stubbedCanon();
    const verdict = await evaluateInbox(input({ canon }));
    expect(readBusiness).toHaveBeenCalledWith('acme/widgets');
    expect(ask.mock.calls[0][0].user).toContain('A phase-0 fixture: a complete PRD folder.');
    expect(verdict.summary).toContain('- ok — canon: canon ✓ · 2 claims read');
    expect(verdict.canon).toMatchObject({ state: 'green', claimsRead: 2 });
    expect(readCanonMarker(verdict.summary)).toBeNull();
  });

  it('red: "canon ✗ N", listing the claim, the quoted spec line and one persona line', async () => {
    const { canon } = stubbedCanon({ reply: BREAKS });
    const verdict = await evaluateInbox(input({ canon }));
    expect(verdict.conclusion).toBe('failure');
    expect(failed(verdict)).toEqual(['canon']);
    expect(verdict.title).toBe('Not ok: canon ✗ 1');
    expect(verdict.summary).toContain('- not ok — canon: canon ✗ 1');
    expect(verdict.summary).toContain('  - never#4 "Never: build for groups of companies" — the spec: "a complete PRD   folder"');
    expect(verdict.summary).toContain('  - Marc: "Not for my five plumbers."');
    expect(verdict.canon).toMatchObject({ state: 'red', persona: { name: 'Marc' } });
    expect(verdict.canon.findings).toHaveLength(1);
  });

  it('red: the summary hides the facts a canon button needs — the PRD, the persona, the cited claims', async () => {
    const verdict = await evaluateInbox(input({ canon: stubbedCanon({ reply: BREAKS }).canon }));
    expect(readCanonMarker(verdict.summary)).toEqual({ prd: 42, persona: 'Marc', claims: ['never#4'] });
    expect(verdict.summary.split('\n')[0]).toBe('PRD 42 (`0042-widget`)');
  });

  it('a finding without a word-for-word quote is dropped', async () => {
    const invented = { findings: [{ quote: 'a holding of six entities', claims: ['never#4'], why: 'made up' }], persona: BREAKS.persona };
    const verdict = await evaluateInbox(input({ canon: stubbedCanon({ reply: invented }).canon }));
    expect(verdict.conclusion).toBe('success');
    expect(verdict.summary).not.toContain('six entities');
  });

  it.each([
    ['no business', { business: { state: 'none', business: null, claims: [], personas: [], updatedAt: null } }, 'no business: no workspace tracking acme/widgets has one'],
    ['no product claims', { business: { ...BUSINESS, state: 'none', claims: [] } }, "no confirmed claim for this repository's product"],
    ['no key', { answer: { ok: false, error: 'no-key', reply: null, reason: 'OPENROUTER_API_KEY is not set' } }, 'model not configured (OPENROUTER_API_KEY is not set)'],
    ['a model error', { answer: { ok: false, error: 'unavailable', reply: null, reason: 'model unavailable (503)' } }, 'model error: model unavailable (503)'],
  ])('neutral, never red, for %s, with its line', async (_, stub, reason) => {
    const verdict = await evaluateInbox(input({ canon: stubbedCanon(stub).canon }));
    expect(verdict.conclusion).toBe('success');
    expect(verdict.summary).toContain(`- neutral — canon: ${reason}`);
    expect(verdict.title).toBe('Phase-0 PR complete: 4 of 4 gates ok · canon neutral');
    expect(verdict.canon).toMatchObject({ state: 'neutral', reason });
  });

  it('neutral does not hide another gate\'s failure', async () => {
    const verdict = await evaluateInbox(input({ issue: null, canon: stubbedCanon({ business: null }).canon }));
    expect(verdict.conclusion).toBe('failure');
    expect(verdict.title).toBe('Not ok: PRD issue');
  });

  it('a re-run with an unchanged spec and claims does not call the model', async () => {
    const { canon, ask } = stubbedCanon({ reply: BREAKS });
    const first = await evaluateInbox(input({ canon }));
    const again = await evaluateInbox(input({ canon }));
    expect(ask).toHaveBeenCalledTimes(1);
    expect(again.summary).toBe(first.summary);
  });

  it('without a canon gate wired, it is neutral and the four gates decide', async () => {
    const verdict = await evaluateInbox(input({ canon: undefined }));
    expect(verdict.conclusion).toBe('success');
    expect(verdict.summary).toContain('- neutral — canon: the canon gate is not wired here');
  });
});

const failed = (verdict) =>verdict.gates.filter((gate) => !gate.ok).map((gate) => gate.name);
