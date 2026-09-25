import { cpSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { gateResult } from 'vertuo-omni-plan/kit/lib/outbox/status.mjs';
import { evaluate } from './evaluate.mjs';

// The kit's gate, wrapped so a test can see evaluate call it — the real one still runs.
vi.mock('vertuo-omni-plan/kit/lib/outbox/status.mjs', async (importOriginal) => {
  const kit = await importOriginal();
  return { ...kit, gateResult: vi.fn(kit.gateResult) };
});

const FIXTURES = fileURLToPath(new URL('../../test/fixtures/', import.meta.url));
const fixture = (name) => join(FIXTURES, name);

const featurePr = (over = {}) => ({
  baseRef: 'main',
  headRef: 'feat/widget',
  headSha: 'abc123',
  labels: [],
  ...over,
});

const NOW = () => '2026-09-25T10:00:00.000Z';

function run({ base = 'base-active', head = 'head-clear', pr = featurePr(), ...rest } = {}) {
  return evaluate({ base: fixture(base), head: fixture(head), pr, now: NOW, ...rest });
}

describe('evaluate — the conclusion table', () => {
  it('skips a repository whose base branch has no .omni-loop/config.yml', () => {
    const verdict = run({ base: 'base-inactive' });
    expect(verdict.conclusion).toBe('skipped');
    expect(verdict.title).toBe('omni-loop is not active on this repo');
    expect(verdict.comment).toBeNull();
  });

  it('skips a pull request whose base is not the default branch (a sub-PR)', () => {
    const verdict = run({ pr: featurePr({ baseRef: 'feat/widget', headRef: 'feat/widget--s1' }) });
    expect(verdict.conclusion).toBe('skipped');
    expect(verdict.title).toBe('omni-loop is not active on this PR');
    expect(verdict.comment).toBeNull();
  });

  it('skips a pull request whose head does not match branches.feature', () => {
    const verdict = run({ pr: featurePr({ headRef: 'chore/bump-deps' }) });
    expect(verdict.conclusion).toBe('skipped');
    expect(verdict.title).toBe('omni-loop is not active on this PR');
  });

  it('skips a feature-shaped pull request with no PRD folder for its topic', () => {
    const verdict = run({ pr: featurePr({ headRef: 'feat/gadget' }) });
    expect(verdict.conclusion).toBe('skipped');
    expect(verdict.title).toBe('omni-loop is not active on this PR');
    expect(verdict.summary).toMatch(/gadget/);
  });

  it('passes a feature pull request whose outbox is clear', () => {
    const verdict = run();
    expect(verdict.conclusion).toBe('success');
    expect(verdict.title).toBe('Outbox clear');
    expect(verdict.summary).toContain('PRD #42: no open item.');
  });

  it('fails a feature pull request with an open item, naming it in the summary and the comment', () => {
    const verdict = run({ head: 'head-open' });
    expect(verdict.conclusion).toBe('failure');
    expect(verdict.title).toBe('1 open outbox item');
    expect(verdict.summary).toContain('s1-01-widget-colour.md (high)');
    expect(verdict.comment.id).toBeNull();
    expect(verdict.comment.body).toContain('<!-- omni-outbox-pr -->');
    expect(verdict.comment.body).toContain('Which colour should the widget be?');
  });

  it('fails a feature pull request with a drifted decision nobody reworked', () => {
    const verdict = run({ head: 'head-drift' });
    expect(verdict.conclusion).toBe('failure');
    expect(verdict.title).toBe('unreworked drift');
    expect(verdict.summary).toMatch(/1 drifted decision not yet reworked/);
  });

  it('is neutral when the override label is on a red pull request', () => {
    const verdict = run({ head: 'head-open', pr: featurePr({ labels: ['outbox:go'] }) });
    expect(verdict.conclusion).toBe('neutral');
    expect(verdict.title).toBe('Override in effect (outbox:go)');
  });

  it('is still success when the override label is on a green pull request', () => {
    const verdict = run({ pr: featurePr({ labels: ['outbox:go'] }) });
    expect(verdict.conclusion).toBe('success');
  });

  it('fails with the schema error, on one line, when the base config is broken', () => {
    const verdict = run({ base: 'base-broken' });
    expect(verdict.conclusion).toBe('failure');
    expect(verdict.title).toMatch(/^\.omni-loop\/config\.yml is not a valid Omni Loop config: /);
    expect(verdict.title).toMatch(/shipIt/);
    expect(verdict.title).not.toContain('\n');
    expect(verdict.comment).toBeNull();
  });
});

describe('evaluate — config from base, delivery from head', () => {
  it('ignores a head that renames the override label', () => {
    const renamed = run({ head: 'head-renames-label', pr: featurePr({ labels: ['ship-it'] }) });
    expect(renamed.conclusion).toBe('failure');
    const real = run({ head: 'head-renames-label', pr: featurePr({ labels: ['outbox:go'] }) });
    expect(real.conclusion).toBe('neutral');
  });

  it('reads items from the head only: the same base with a clear head is green', () => {
    expect(run({ head: 'head-open' }).conclusion).toBe('failure');
    expect(run({ head: 'head-clear' }).conclusion).toBe('success');
  });
});

describe('evaluate — a snapshot holding only config and delivery is enough', () => {
  const copies = [];
  afterEach(() => {
    for (const dir of copies.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function copyOf(name) {
    const dir = mkdtempSync(join(tmpdir(), 'omni-app-'));
    cpSync(fixture(name), dir, { recursive: true });
    copies.push(dir);
    return dir;
  }

  function filesUnder(dir) {
    return readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => relative(dir, join(entry.parentPath, entry.name)));
  }

  it('evaluates from folders outside any git checkout, holding nothing but the listed paths', () => {
    const base = copyOf('base-active');
    const head = copyOf('head-open');
    expect(filesUnder(base)).toEqual(['.omni-loop/config.yml']);
    expect(filesUnder(head).every((file) => file.startsWith('.omni-loop/delivery/'))).toBe(true);
    const verdict = evaluate({ base, head, pr: featurePr(), now: NOW });
    expect(verdict.conclusion).toBe('failure');
  });
});

describe('evaluate — reuses the kit', () => {
  it('asks the kit gate, not a copy of it', () => {
    gateResult.mockClear();
    run({ head: 'head-open' });
    expect(gateResult).toHaveBeenCalledWith(42, expect.objectContaining({ labels: [] }));
  });
});

describe('evaluate — the pull request comment', () => {
  it('rewrites the existing marker comment in place rather than adding one', () => {
    const comments = [
      { id: 7, body: 'unrelated' },
      { id: 9, body: '<!-- omni-outbox-pr -->\n\nold' },
    ];
    const verdict = run({ head: 'head-open', comments });
    expect(verdict.comment.id).toBe(9);
    expect(verdict.comment.body).not.toContain('old');
  });

  it('posts nothing on a clear pull request that never had a comment', () => {
    expect(run().comment).toBeNull();
  });

  it('still rewrites an existing comment once the outbox is clear', () => {
    const comments = [{ id: 9, body: '<!-- omni-outbox-pr -->\n\nold' }];
    const verdict = run({ comments });
    expect(verdict.comment.id).toBe(9);
    expect(verdict.comment.body).toContain('No open items.');
  });
});

describe('evaluate — the range, when changed files are given', () => {
  it('hands the changed files to the gate', () => {
    gateResult.mockClear();
    const changes = [{ path: 'src/a.mjs', status: 'M' }];
    run({ changes });
    expect(gateResult).toHaveBeenCalledWith(42, expect.objectContaining({ changes }));
  });
});
