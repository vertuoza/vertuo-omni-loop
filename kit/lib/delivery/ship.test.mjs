import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { makeRepo } from '../../test/fixture.mjs';
import { makeMarkers } from '../markers.mjs';
import { applyShip, planShip } from './ship.mjs';

const D = '.omni-loop/delivery';
const m = makeMarkers('omni-outbox');
const agreed = (id) => [m.settledOpen(id), `## ${id} — agreed`, '- Verdict: agreed', '- Closed: yes — agreed', `See ${D}/inbox/0042-a/spec.md`, m.settledClose(id), ''].join('\n');

function tracked(root) {
  return execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
}

describe('planShip', () => {
  it('ships a PRD that never raised an outbox item', () => {
    const { root, ctx, read } = makeRepo({ git: true, files: { [`${D}/inbox/0042-a/spec.md`]: 'x', [`${D}/inbox/0042-a/plan.md`]: 'y' } });
    const plan = planShip(ctx, 42, { files: tracked(root), read });
    expect(plan).toEqual({ ok: true, moves: [{ from: `${D}/inbox/0042-a`, to: `${D}/shipped/0042-a` }], rewrites: [] });
  });

  it('moves the outbox inside the shipped folder and rewrites links, but never settled.md', () => {
    const { root, ctx, read } = makeRepo({ git: true, files: {
      [`${D}/inbox/0042-a/spec.md`]: 'x',
      [`${D}/outbox/0042-a/settled.md`]: agreed('s1-01-x'),
      'README.md': `Spec: ${D}/inbox/0042-a/spec.md and ${D}/outbox/0042-a/settled.md\n`,
    } });
    const plan = planShip(ctx, 42, { files: tracked(root), read });
    expect(plan.moves).toEqual([
      { from: `${D}/inbox/0042-a`, to: `${D}/shipped/0042-a` },
      { from: `${D}/outbox/0042-a`, to: `${D}/shipped/0042-a/outbox` },
    ]);
    expect(plan.rewrites).toEqual([{ file: 'README.md', text: `Spec: ${D}/shipped/0042-a/spec.md and ${D}/shipped/0042-a/outbox/settled.md\n` }]);
  });

  it('refuses while an item is open or a drift is unreworked', () => {
    const { root, ctx, read } = makeRepo({ git: true, files: {
      [`${D}/inbox/0042-a/spec.md`]: 'x',
      [`${D}/outbox/0042-a/s1-02-y.md`]: 'an open item',
      [`${D}/outbox/0042-a/settled.md`]: [m.settledOpen('s1-01-x'), '## s1-01-x — drifted', '- Verdict: drifted', '- Closed: no — x', m.settledClose('s1-01-x'), ''].join('\n'),
    } });
    const plan = planShip(ctx, 42, { files: tracked(root), read });
    expect(plan.ok).toBe(false);
    expect(plan.reasons).toEqual([`open outbox item: ${D}/outbox/0042-a/s1-02-y.md`, 'drifted, not reworked: s1-01-x']);
  });

  it('skips a tracked file that is no longer on disk', () => {
    const { root, ctx, read } = makeRepo({ git: true, files: { [`${D}/inbox/0042-a/spec.md`]: 'x', 'gone.md': `${D}/inbox/0042-a/spec.md\n` } });
    rmSync(join(root, 'gone.md'));
    expect(planShip(ctx, 42, { files: tracked(root), read }).rewrites).toEqual([]);
  });

  it('refuses a PRD that is not in the inbox', () => {
    const { root, ctx, read } = makeRepo({ git: true, files: { [`${D}/shipped/0042-a/spec.md`]: 'x' } });
    expect(planShip(ctx, 42, { files: tracked(root), read }).reasons).toEqual(['PRD 42 is not in the inbox (shipped)']);
    expect(planShip(ctx, 9, { files: tracked(root), read }).reasons).toEqual(['PRD 9 is not in the inbox (nowhere)']);
  });
});

describe('applyShip', () => {
  it('moves with git and leaves settled.md byte-identical', () => {
    const { root, ctx } = makeRepo({ git: true, files: {
      [`${D}/inbox/0042-a/spec.md`]: 'x',
      [`${D}/outbox/0042-a/settled.md`]: agreed('s1-01-x'),
    } });
    applyShip(ctx, 42);
    expect(existsSync(join(root, `${D}/inbox/0042-a`))).toBe(false);
    expect(readFileSync(join(root, `${D}/shipped/0042-a/outbox/settled.md`), 'utf8')).toBe(agreed('s1-01-x'));
    expect(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' })).toMatch(/^R /m);
  });

  it('refuses, naming the delivery folder, while it holds uncommitted changes', () => {
    const { root, ctx } = makeRepo({ git: true, files: { [`${D}/inbox/0042-a/spec.md`]: 'x', [`${D}/outbox/0042-a/s1-01-x.md`]: 'open' } });
    rmSync(join(root, `${D}/outbox/0042-a/s1-01-x.md`));
    expect(() => applyShip(ctx, 42)).toThrow(`uncommitted changes under ${D} — commit the settle first`);
    expect(existsSync(join(root, `${D}/inbox/0042-a/spec.md`))).toBe(true);
  });

  it('throws with every reason when the plan refuses', () => {
    const { ctx } = makeRepo({ git: true, files: { [`${D}/inbox/0042-a/spec.md`]: 'x', [`${D}/outbox/0042-a/s1-02-y.md`]: 'open' } });
    expect(() => applyShip(ctx, 42)).toThrow(/open outbox item/);
  });
});
