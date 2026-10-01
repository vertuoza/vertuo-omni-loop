// @ts-nocheck
// PRD #324, slice s4: the stage of one PRD — shipped, outbox, inbox or in review — with built and
// open items read by the rule of PRD #315, written for one PRD.
import { describe, expect, it } from 'vitest';
import { isBuilt, isOpenItem, openItemCount, stageOf } from './stage.ts';

const DELIVERY = '.omni-loop/delivery';
const FOLDER = '0007-bravo';
const BASE = { inbox: ['0007-bravo', '0009-charlie'], shipped: ['0003-alpha'] };
const NOTHING = { built: false, openItems: 0 };

describe('stageOf', () => {
  it('reads shipped for a folder in the base shipped folder', () => {
    expect(stageOf({ folder: '0003-alpha', base: BASE, feature: NOTHING })).toBe('shipped');
  });

  it('reads outbox for a folder in the base inbox whose feature branch is built', () => {
    expect(stageOf({ folder: FOLDER, base: BASE, feature: { built: true, openItems: 0 } })).toBe('outbox');
  });

  it('reads outbox for open items alone', () => {
    expect(stageOf({ folder: FOLDER, base: BASE, feature: { built: false, openItems: 1 } })).toBe('outbox');
  });

  it('reads inbox for a folder in the base inbox with nothing built and nothing open', () => {
    expect(stageOf({ folder: FOLDER, base: BASE, feature: NOTHING })).toBe('inbox');
    expect(stageOf({ folder: FOLDER, base: BASE, feature: null })).toBe('inbox');
  });

  it('reads in review for a folder on neither folder of the base', () => {
    expect(stageOf({ folder: '0011-delta', base: BASE, feature: { built: true, openItems: 2 } })).toBe('in review');
  });

  it('reads shipped over everything', () => {
    const both = { inbox: ['0003-alpha'], shipped: ['0003-alpha'] };
    expect(stageOf({ folder: '0003-alpha', base: both, feature: { built: true, openItems: 3 } })).toBe('shipped');
  });

  it('reads no stage without a base', () => {
    expect(stageOf({ folder: FOLDER, base: null, feature: { built: true, openItems: 2 } })).toBeNull();
  });
});

describe('stageOf, with the board (slice s6)', () => {
  const board = (...states) => states.map((state, index) => ({ id: `s${index + 1}`, wave: index + 1, state }));

  it.each(['merged', 'in-flight', 'claimed-stale'])('reads outbox for a PRD git reads as inbox, when its board shows a slice %s', (state) => {
    expect(stageOf({ folder: FOLDER, base: BASE, feature: NOTHING, slices: board('runnable', state, 'blocked') })).toBe('outbox');
    expect(stageOf({ folder: FOLDER, base: BASE, feature: null, slices: board(state) })).toBe('outbox');
  });

  it('keeps inbox for a board whose slices are only runnable, blocked or stuck, and without a board', () => {
    expect(stageOf({ folder: FOLDER, base: BASE, feature: NOTHING, slices: board('runnable', 'blocked', 'stuck') })).toBe('inbox');
    expect(stageOf({ folder: FOLDER, base: BASE, feature: NOTHING, slices: [] })).toBe('inbox');
    expect(stageOf({ folder: FOLDER, base: BASE, feature: NOTHING, slices: null })).toBe('inbox');
  });

  it('never lets the board move a shipped PRD, one in review, or one with no base', () => {
    expect(stageOf({ folder: '0003-alpha', base: BASE, feature: NOTHING, slices: board('in-flight') })).toBe('shipped');
    expect(stageOf({ folder: '0011-delta', base: BASE, feature: NOTHING, slices: board('merged') })).toBe('in review');
    expect(stageOf({ folder: FOLDER, base: null, feature: NOTHING, slices: board('merged') })).toBeNull();
  });
});

describe('isBuilt', () => {
  it('is built when a path outside the delivery folder changed since the fork and still differs', () => {
    expect(isBuilt({ forkChanges: ['src/app.mjs', `${DELIVERY}/outbox/${FOLDER}/s1-01-a.md`], stillDiffers: ['src/app.mjs'], delivery: DELIVERY })).toBe(true);
  });

  it('is not built by a phase-0 copy: paths the base now holds byte for byte', () => {
    const copy = [`${DELIVERY}/inbox/${FOLDER}/spec.md`, 'acceptance/bravo.feature.pending'];
    expect(isBuilt({ forkChanges: copy, stillDiffers: [], delivery: DELIVERY })).toBe(false);
  });

  it('is not built by a path changed then brought back in line with the base', () => {
    expect(isBuilt({ forkChanges: ['src/app.mjs'], stillDiffers: [], delivery: DELIVERY })).toBe(false);
  });

  it('is not built by changes inside the delivery folder alone', () => {
    const inside = [`${DELIVERY}/outbox/${FOLDER}/s1-01-a.md`, `${DELIVERY}/inbox/${FOLDER}/plan.md`];
    expect(isBuilt({ forkChanges: inside, stillDiffers: inside, delivery: DELIVERY })).toBe(false);
  });

  it('reads a path that only starts like the delivery folder as outside it', () => {
    expect(isBuilt({ forkChanges: [`${DELIVERY}-notes.md`], stillDiffers: [`${DELIVERY}-notes.md`], delivery: DELIVERY })).toBe(true);
    expect(isBuilt({ forkChanges: ['src/a.mjs'], stillDiffers: ['src/a.mjs'], delivery: `${DELIVERY}/` })).toBe(true);
    expect(isBuilt({ forkChanges: [`${DELIVERY}/x.md`], stillDiffers: [`${DELIVERY}/x.md`], delivery: `${DELIVERY}/` })).toBe(false);
  });

  it('is not built with nothing changed', () => {
    expect(isBuilt({ forkChanges: [], stillDiffers: [], delivery: DELIVERY })).toBe(false);
  });
});

describe('open items', () => {
  it('counts the `.md` files under the PRD outbox folder, as outboxItemFiles does', () => {
    expect(openItemCount(['s1-01-a.md', 's2-01-b.md'])).toBe(2);
    expect(openItemCount(['wave-2/s3-01-c.md'])).toBe(1);
  });

  it('leaves out settled.md, anything under accounts/, and files that are not `.md`', () => {
    expect(isOpenItem('settled.md')).toBe(false);
    expect(isOpenItem('wave-2/settled.md')).toBe(false);
    expect(isOpenItem('accounts/s1.md')).toBe(false);
    expect(isOpenItem('wave-2/accounts/s1.md')).toBe(false);
    expect(isOpenItem('notes.txt')).toBe(false);
    expect(isOpenItem('.gitkeep')).toBe(false);
    expect(openItemCount(['settled.md', 'accounts/s1.md', 'notes.txt', 's1-01-a.md'])).toBe(1);
  });

  it('counts nothing in an empty or missing folder', () => {
    expect(openItemCount([])).toBe(0);
    expect(openItemCount(null)).toBe(0);
  });
});
