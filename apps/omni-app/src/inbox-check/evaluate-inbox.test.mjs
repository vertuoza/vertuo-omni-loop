import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { evaluateInbox, inboxPrd, phase0Topic } from './evaluate-inbox.mjs';

const FIXTURES = fileURLToPath(new URL('../../test/fixtures/', import.meta.url));
const fixture = (name) => join(FIXTURES, name);

const TRAILER = 'Co-authored-by: Omni-man <333776611+omni-loop-invader[bot]@users.noreply.github.com>';
const FOLDER = '.omni-loop/delivery/inbox/0042-widget';
const COMPLETE_CHANGES = ['spec.md', 'plan.md', 'before-after.html'].map((file) => ({ path: `${FOLDER}/${file}`, status: 'A' }));
const SIGNED = [{ sha: 'c1', message: `docs(phase-0): widget\n\n${TRAILER}` }];
const OPEN_ISSUE = { number: 42, state: 'open', labels: ['omni:prd'], isPullRequest: false };

const input = (over = {}) => ({
  base: fixture('inbox-base'),
  head: fixture('inbox-head-complete'),
  pr: { headRef: 'docs/phase-0-widget' },
  changes: COMPLETE_CHANGES,
  commits: SIGNED,
  issue: OPEN_ISSUE,
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
    const { parseConfig } = await import('vertuo-omni-plan/kit/lib/config.mjs');
    const config = parseConfig('kit: 1\nrepo:\n  slug: acme/widgets\n', 'config.yml');
    expect(inboxPrd({ head: fixture('inbox-head-complete'), config, topic: 'widget' })).toBe(42);
    expect(inboxPrd({ head: fixture('inbox-head-complete'), config, topic: 'gadget' })).toBeNull();
  });
});

describe('evaluateInbox — silent where it is not a phase-0 PR', () => {
  let empty;
  afterEach(() => empty && rmSync(empty, { recursive: true, force: true }));

  it('is null for a head branch of another shape', () => {
    expect(evaluateInbox(input({ pr: { headRef: 'feat/widget' } }))).toBeNull();
    expect(evaluateInbox(input({ pr: { headRef: 'feat/widget--s1' } }))).toBeNull();
  });

  it('is null when the base branch has no config', () => {
    empty = mkdtempSync(join(tmpdir(), 'inbox-empty-'));
    expect(evaluateInbox(input({ base: empty }))).toBeNull();
  });
});

describe('evaluateInbox — the four gates', () => {
  it('a complete phase-0 PR is success, with four ok lines', () => {
    const verdict = evaluateInbox(input());
    expect(verdict.conclusion).toBe('success');
    expect(verdict.prd).toBe(42);
    expect(verdict.gates.map((gate) => [gate.name, gate.ok])).toEqual([
      ['phase-0 verdict', true],
      ['inbox folder', true],
      ['plan', true],
      ['PRD issue', true],
    ]);
    expect(verdict.summary.match(/^- ok — /gm)).toHaveLength(4);
    expect(verdict.title).toBe('Phase-0 PR complete: 4 of 4 gates ok');
  });

  it('a broken inbox folder of another PRD changes nothing', () => {
    // inbox-head-complete also holds 0043-broken, whose spec is malformed.
    expect(evaluateInbox(input()).conclusion).toBe('success');
  });

  it('a missing plan.md is failure, naming the plan', () => {
    const verdict = evaluateInbox(
      input({ head: fixture('inbox-head-no-plan'), changes: COMPLETE_CHANGES.filter((c) => !c.path.endsWith('plan.md')) }),
    );
    expect(verdict.conclusion).toBe('failure');
    expect(failed(verdict)).toEqual(['phase-0 verdict', 'plan']);
    expect(verdict.summary).toContain(`not ok — plan: no plan.md in ${FOLDER}`);
    expect(verdict.summary).toContain('nothing in it is the plan');
    expect(verdict.title).toBe('Not ok: phase-0 verdict, plan');
  });

  it('a source file is failure, naming the file', () => {
    const verdict = evaluateInbox(input({ changes: [...COMPLETE_CHANGES, { path: 'src/widget.mjs', status: 'A' }] }));
    expect(verdict.conclusion).toBe('failure');
    expect(failed(verdict)).toEqual(['phase-0 verdict']);
    expect(verdict.summary).toContain('src/widget.mjs');
  });

  it('an unsigned commit is failure, naming the commit', () => {
    const verdict = evaluateInbox(input({ commits: [...SIGNED, { sha: 'c2', message: 'docs: unsigned' }] }));
    expect(verdict.conclusion).toBe('failure');
    expect(failed(verdict)).toEqual(['phase-0 verdict']);
    expect(verdict.summary).toContain('unsigned: c2');
  });

  it('a spec that breaks the inbox rules is failure, naming the inbox folder', () => {
    const verdict = evaluateInbox(input({ head: fixture('inbox-head-bad-spec') }));
    expect(failed(verdict)).toEqual(['inbox folder']);
    expect(verdict.summary).toContain('does not agree with its folder');
  });

  it('a plan the kit refuses is failure, naming the plan', () => {
    const verdict = evaluateInbox(input({ head: fixture('inbox-head-bad-plan') }));
    expect(failed(verdict)).toEqual(['plan']);
    expect(verdict.summary).toContain('a blocker must sit in an earlier wave');
  });

  it.each([
    ['closed', { ...OPEN_ISSUE, state: 'closed' }, 'issue #42 is closed'],
    ['unlabelled', { ...OPEN_ISSUE, labels: ['bug'] }, 'issue #42 does not carry the label omni:prd'],
    ['missing', null, 'issue #42 does not exist'],
    ['a pull request', { ...OPEN_ISSUE, isPullRequest: true }, '#42 is a pull request, not an issue'],
  ])('a PRD issue that is %s is failure, saying so', (_, issue, reason) => {
    const verdict = evaluateInbox(input({ issue }));
    expect(verdict.conclusion).toBe('failure');
    expect(failed(verdict)).toEqual(['PRD issue']);
    expect(verdict.summary).toContain(`not ok — PRD issue: ${reason}`);
  });

  it('a topic with no inbox folder is failure: no inbox folder for topic', () => {
    const verdict = evaluateInbox(input({ pr: { headRef: 'docs/phase-0-gadget' } }));
    expect(verdict.conclusion).toBe('failure');
    expect(verdict.prd).toBeNull();
    expect(verdict.title).toBe('no inbox folder for topic `gadget`');
  });

  it('reads the phase-0 shape from the base config', () => {
    expect(evaluateInbox(input({ base: fixture('inbox-base-renamed') })).name).toBe('phase-0 shape');
    expect(evaluateInbox(input()).name).toBe('inbox');
  });
});

const failed = (verdict) => verdict.gates.filter((gate) => !gate.ok).map((gate) => gate.name);
