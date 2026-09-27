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

describe('planShip — the release-note guard (PRD 262)', () => {
  const ON = { releaseNotes: { enabled: true } };
  const NOTE = (prd, title = 'Jump between work and play in one tap') =>
    `---\nprd: ${prd}\ntitle: ${title}\n---\nOne tap moves you between the reading pages and the game.\n`;

  it('with the switch on, refuses a PRD whose folder has no release note, naming the path', () => {
    const { root, ctx, read } = makeRepo({ git: true, config: ON, files: { [`${D}/inbox/0042-a/spec.md`]: 'x' } });
    expect(planShip(ctx, 42, { files: tracked(root), read })).toEqual({ ok: false, reasons: [`no release note: ${D}/inbox/0042-a/release.md`] });
  });

  it('with the switch on, refuses a note that fails the check, one reason per rule', () => {
    const { root, ctx, read } = makeRepo({
      git: true,
      config: ON,
      files: { [`${D}/inbox/0042-a/spec.md`]: 'x', [`${D}/inbox/0042-a/release.md`]: NOTE(41, 'What PRD 42 brought.') },
    });
    expect(planShip(ctx, 42, { files: tracked(root), read })).toEqual({
      ok: false,
      reasons: [
        "release note: prd 41 is not its folder's number, 42",
        'release note: title ends with a full stop',
        'release note: title names a PRD number ("PRD 42")',
      ],
    });
  });

  it('with the switch on, names the note beside an open item', () => {
    const { root, ctx, read } = makeRepo({
      git: true,
      config: ON,
      files: { [`${D}/inbox/0042-a/spec.md`]: 'x', [`${D}/outbox/0042-a/s1-02-y.md`]: 'an open item' },
    });
    expect(planShip(ctx, 42, { files: tracked(root), read }).reasons).toEqual([
      `open outbox item: ${D}/outbox/0042-a/s1-02-y.md`,
      `no release note: ${D}/inbox/0042-a/release.md`,
    ]);
  });

  it('with the switch on and a good note, plans the same moves, which carry the note', () => {
    const { root, ctx, read } = makeRepo({
      git: true,
      config: ON,
      files: { [`${D}/inbox/0042-a/spec.md`]: 'x', [`${D}/inbox/0042-a/release.md`]: NOTE(42) },
    });
    expect(planShip(ctx, 42, { files: tracked(root), read })).toEqual({ ok: true, moves: [{ from: `${D}/inbox/0042-a`, to: `${D}/shipped/0042-a` }], rewrites: [] });
  });

  it('with the switch off, ships a PRD with no note, or with a note that would fail, as before', () => {
    for (const files of [{}, { [`${D}/inbox/0042-a/release.md`]: NOTE(7) }]) {
      const { root, ctx, read } = makeRepo({ git: true, files: { [`${D}/inbox/0042-a/spec.md`]: 'x', ...files } });
      expect(ctx.config.releaseNotes.enabled).toBe(false);
      expect(planShip(ctx, 42, { files: tracked(root), read })).toEqual({ ok: true, moves: [{ from: `${D}/inbox/0042-a`, to: `${D}/shipped/0042-a` }], rewrites: [] });
    }
  });
});

describe('applyShip', () => {
  it('with the release-note switch on, moves the note to shipped with its folder (PRD 262)', () => {
    const note = '---\nprd: 42\ntitle: Jump between work and play in one tap\n---\nOne tap moves you between the pages.\n';
    const { root, ctx } = makeRepo({
      git: true,
      config: { releaseNotes: { enabled: true } },
      files: { [`${D}/inbox/0042-a/spec.md`]: 'x', [`${D}/inbox/0042-a/release.md`]: note },
    });
    applyShip(ctx, 42);
    expect(existsSync(join(root, `${D}/inbox/0042-a/release.md`))).toBe(false);
    expect(readFileSync(join(root, `${D}/shipped/0042-a/release.md`), 'utf8')).toBe(note);
  });

  it('with the release-note switch on, refuses a PRD with no note and moves nothing (PRD 262)', () => {
    const { root, ctx } = makeRepo({ git: true, config: { releaseNotes: { enabled: true } }, files: { [`${D}/inbox/0042-a/spec.md`]: 'x' } });
    expect(() => applyShip(ctx, 42)).toThrow(`Cannot ship PRD 42:\n  - no release note: ${D}/inbox/0042-a/release.md`);
    expect(existsSync(join(root, `${D}/inbox/0042-a/spec.md`))).toBe(true);
  });

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
