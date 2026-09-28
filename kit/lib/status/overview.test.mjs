import { describe, expect, it } from 'vitest';
import { BAR_CELLS, overviewFor } from './overview.mjs';

/** One PRD folder as `readFacts` reads it: `n` becomes `{ prd: n, topic: 't<n>', name: '000n-t<n>' }`. */
const folder = (prd) => ({ prd, topic: `t${prd}`, name: `${String(prd).padStart(4, '0')}-t${prd}` });

/** Facts as `readFacts` returns them, with a PRD per number, no feature or phase-0 branch, no
 * `user.email` and no commit touching a PRD folder. */
function facts({ shipped = [], inbox = [], ...more } = {}) {
  return {
    slug: 'acme/widgets',
    base: 'origin/main',
    fetchedAt: null,
    email: null,
    shallow: false,
    shipped: shipped.map(folder),
    inbox: inbox.map(folder),
    touched: [],
    features: [],
    phase0: [],
    ...more,
  };
}

/** A feature branch as `readFacts` reads it, cut for topic `t<prd>`: the paths outside the
 * delivery folder it changed since it forked (`forked`), those that differ from the base now
 * (`differs`), every file under its PRD's outbox folder (`outbox`), the authors of its commits
 * beyond the base (`authors`) and the PRD folders those commits touched (`touched`). */
const feature = (prd, { forked = [], differs = [], outbox = [], authors = [], touched = [], topic = `t${prd}` } = {}) => ({
  branch: `feat/${topic}`,
  topic,
  forked,
  differs,
  outbox,
  authors,
  touched,
});

/** Code the feature branch changed, still differing from the base: a built branch. */
const CODE = { forked: ['src/widget.mjs'], differs: ['src/widget.mjs'] };

/** A phase-0 branch cut for topic `t<prd>`, whose inbox holds the folders numbered `inbox`, and
 * whose commits beyond the base touched the PRD folders `touched`. */
const phase0 = (prd, { inbox = [prd], topic = `t${prd}`, touched = [] } = {}) => ({ branch: `docs/phase-0-${topic}`, topic, inbox: inbox.map(folder), touched });

/** A commit by `email` touching PRD `prd`'s folder, as `touched` lists it. */
const touch = (prd, email = ME) => ({ prd, email });

const ME = 'me@example.com';
const OTHER = 'other@example.com';

describe('overviewFor — the shipped and inbox stages', () => {
  it('counts the shipped and the inbox folders of the base', () => {
    const overview = overviewFor(facts({ shipped: [1, 2, 3], inbox: [4, 5] }));
    expect(overview.counts).toEqual({ shipped: 3, inbox: 2, outbox: 0, openItems: 0, inReview: 0 });
    expect(overview.inProgress).toEqual({ total: 2, inbox: 2, outbox: 0 });
  });

  it('lists each stage newest first', () => {
    const overview = overviewFor(facts({ shipped: [1, 3, 2], inbox: [4, 6, 5] }));
    expect(overview.stages.shipped.map(({ prd }) => prd)).toEqual([3, 2, 1]);
    expect(overview.stages.inbox.map(({ prd }) => prd)).toEqual([6, 5, 4]);
  });

  it('counts a PRD once, shipped first, when its number sits in both folders', () => {
    const overview = overviewFor(facts({ shipped: [1, 2], inbox: [2, 3] }));
    expect(overview.counts).toMatchObject({ shipped: 2, inbox: 1 });
    expect(overview.stages.inbox.map(({ prd }) => prd)).toEqual([3]);
  });

  it('counts two folders of one PRD number once', () => {
    const overview = overviewFor({ ...facts(), inbox: [{ prd: 7, topic: 'a' }, { prd: 7, topic: 'b' }] });
    expect(overview.counts.inbox).toBe(1);
  });

  it('carries the header facts through', () => {
    const overview = overviewFor(facts({ slug: null, base: 'main', fetchedAt: 1000 }));
    expect(overview).toMatchObject({ slug: null, base: 'main', fetchedAt: 1000 });
  });
});

describe('overviewFor — the bar', () => {
  it('is 30 cells', () => {
    expect(BAR_CELLS).toBe(30);
  });

  it('is delivered against shipped + inbox', () => {
    expect(overviewFor(facts({ shipped: [1, 2, 3], inbox: [4, 5] })).bar).toEqual({ delivered: 3, total: 5, percent: 60, filled: 18 });
  });

  it('rounds the percentage and the filled cells down', () => {
    const shipped = Array.from({ length: 29 }, (_, index) => index + 1);
    expect(overviewFor(facts({ shipped, inbox: [30] })).bar).toEqual({ delivered: 29, total: 30, percent: 96, filled: 29 });
    expect(overviewFor(facts({ shipped: [1, 2], inbox: [3] })).bar).toEqual({ delivered: 2, total: 3, percent: 66, filled: 20 });
    expect(overviewFor(facts({ shipped: [1], inbox: [2, 3, 4, 5, 6, 7] })).bar).toEqual({ delivered: 1, total: 7, percent: 14, filled: 4 });
  });

  it('never reads 100% while anything is in progress', () => {
    const shipped = Array.from({ length: 999 }, (_, index) => index + 1);
    const { bar } = overviewFor(facts({ shipped, inbox: [1000] }));
    expect(bar.percent).toBe(99);
    expect(bar.filled).toBe(29);
  });

  it('is full at 100% when everything shipped', () => {
    expect(overviewFor(facts({ shipped: [1, 2] })).bar).toEqual({ delivered: 2, total: 2, percent: 100, filled: 30 });
  });

  it('is empty at 0% when nothing shipped', () => {
    expect(overviewFor(facts({ inbox: [1] })).bar).toEqual({ delivered: 0, total: 1, percent: 0, filled: 0 });
  });

  it('has a zero total, and no percentage, with no PRD at all', () => {
    const overview = overviewFor(facts());
    expect(overview.counts).toEqual({ shipped: 0, inbox: 0, outbox: 0, openItems: 0, inReview: 0 });
    expect(overview.bar).toEqual({ delivered: 0, total: 0, percent: null, filled: 0 });
    expect(overview.inProgress).toEqual({ total: 0, inbox: 0, outbox: 0 });
  });
});

describe('overviewFor — the outbox (PRD 315, slice s2)', () => {
  it('counts an inbox PRD in the outbox when its feature branch is built, with its open items', () => {
    const overview = overviewFor(facts({
      shipped: [1],
      inbox: [4, 5],
      features: [feature(4, { ...CODE, outbox: ['s1-01-a.md', 's1-02-b.md', 'settled.md', 'accounts/s1.md'] })],
    }));
    expect(overview.counts).toEqual({ shipped: 1, inbox: 1, outbox: 1, openItems: 2, inReview: 0 });
    expect(overview.stages.outbox).toEqual([{ prd: 4, topic: 't4', openItems: 2 }]);
    expect(overview.stages.inbox).toEqual([{ prd: 5, topic: 't5' }]);
  });

  it('reads a feature branch that is only the phase-0 copy of its PRD as inbox, not outbox', () => {
    const copy = feature(4, { forked: ['acceptance/t4.feature'], differs: [] });
    const overview = overviewFor(facts({ inbox: [4], features: [copy] }));
    expect(overview.counts).toMatchObject({ inbox: 1, outbox: 0 });
  });

  it('does not read a feature branch as built when only the base moved on', () => {
    const behind = feature(4, { forked: [], differs: ['src/other.mjs'] });
    expect(overviewFor(facts({ inbox: [4], features: [behind] })).counts).toMatchObject({ inbox: 1, outbox: 0 });
  });

  it('reads it as built when one path it changed still differs from the base, whatever else did not', () => {
    const built = feature(4, { forked: ['acceptance/t4.feature', 'src/widget.mjs'], differs: ['src/widget.mjs', 'src/other.mjs'] });
    expect(overviewFor(facts({ inbox: [4], features: [built] })).counts).toMatchObject({ inbox: 0, outbox: 1, openItems: 0 });
  });

  it('counts a feature branch with one open item and no code in the outbox', () => {
    const overview = overviewFor(facts({ inbox: [4], features: [feature(4, { outbox: ['s1-01-a.md'] })] }));
    expect(overview.counts).toMatchObject({ inbox: 0, outbox: 1, openItems: 1 });
    expect(overview.stages.outbox).toEqual([{ prd: 4, topic: 't4', openItems: 1 }]);
  });

  it('counts a built feature branch with no open item in the outbox, none open', () => {
    const overview = overviewFor(facts({ inbox: [4], features: [feature(4, { ...CODE, outbox: ['settled.md'] })] }));
    expect(overview.stages.outbox).toEqual([{ prd: 4, topic: 't4', openItems: 0 }]);
  });

  it('counts open items by the rule outboxItemFiles applies', () => {
    const outbox = [
      's2-01-a.md',
      'wave-2/s2-02-b.md',
      'settled.md',
      'wave-2/settled.md',
      'accounts/s2.md',
      'wave-2/accounts/s2.md',
      'notes.txt',
    ];
    expect(overviewFor(facts({ inbox: [4], features: [feature(4, { outbox })] })).counts.openItems).toBe(2);
  });

  it('sums the open items of every PRD in the outbox, and lists the outbox newest first', () => {
    const overview = overviewFor(facts({
      inbox: [4, 5, 6],
      features: [feature(4, { outbox: ['a.md'] }), feature(6, { outbox: ['a.md', 'b.md'] })],
    }));
    expect(overview.counts).toMatchObject({ inbox: 1, outbox: 2, openItems: 3 });
    expect(overview.stages.outbox.map(({ prd }) => prd)).toEqual([6, 4]);
  });

  it('ignores the feature branch of a shipped PRD, and one whose topic names no inbox folder', () => {
    const overview = overviewFor(facts({
      shipped: [1],
      inbox: [2],
      features: [feature(1, CODE), feature(9, { ...CODE, outbox: ['a.md'] })],
    }));
    expect(overview.counts).toEqual({ shipped: 1, inbox: 1, outbox: 0, openItems: 0, inReview: 0 });
  });

  it('keeps an outbox PRD in progress in the bar', () => {
    const overview = overviewFor(facts({ shipped: [1, 2, 3], inbox: [4, 5], features: [feature(5, CODE)] }));
    expect(overview.bar).toEqual({ delivered: 3, total: 5, percent: 60, filled: 18 });
    expect(overview.inProgress).toEqual({ total: 2, inbox: 1, outbox: 1 });
  });
});

describe('overviewFor — in review (PRD 315, slice s2)', () => {
  it('counts a phase-0 branch whose PRD is in neither folder of the base', () => {
    const overview = overviewFor(facts({ shipped: [1], inbox: [2], phase0: [phase0(9, { inbox: [2, 9] })] }));
    expect(overview.counts).toEqual({ shipped: 1, inbox: 1, outbox: 0, openItems: 0, inReview: 1 });
    expect(overview.stages.inReview).toEqual([{ prd: 9, topic: 't9' }]);
  });

  it('keeps in review out of the bar and out of the progress', () => {
    const overview = overviewFor(facts({ shipped: [1, 2, 3], inbox: [4, 5], phase0: [phase0(9)] }));
    expect(overview.bar).toEqual({ delivered: 3, total: 5, percent: 60, filled: 18 });
    expect(overview.inProgress).toEqual({ total: 2, inbox: 2, outbox: 0 });
  });

  it('ignores a phase-0 branch whose PRD shipped or is in the inbox, and one whose topic names no folder on it', () => {
    const overview = overviewFor(facts({
      shipped: [1],
      inbox: [2],
      phase0: [phase0(1), phase0(2), phase0(9, { inbox: [9], topic: 'elsewhere' })],
    }));
    expect(overview.counts.inReview).toBe(0);
    expect(overview.counts).toMatchObject({ shipped: 1, inbox: 1 });
  });

  it('counts a PRD once when two phase-0 branches hold it, and lists in review newest first', () => {
    const overview = overviewFor(facts({ phase0: [phase0(8), phase0(9), { ...phase0(9), branch: 'docs/phase-0-t9-again' }] }));
    expect(overview.stages.inReview.map(({ prd }) => prd)).toEqual([9, 8]);
    expect(overview.counts.inReview).toBe(2);
  });

  it('shows nothing yet in the bar when the only PRD is in review', () => {
    expect(overviewFor(facts({ phase0: [phase0(9)] })).bar).toEqual({ delivered: 0, total: 0, percent: null, filled: 0 });
  });
});

describe('overviewFor — yours (PRD 315, slice s3)', () => {
  /** The PRD numbers of each row of yours, and of your shipped list. */
  const numbers = ({ rows, shipped }) => ({ rows: rows.map(({ stage, prd }) => `${stage} ${prd}`), shipped: shipped.map(({ prd }) => prd) });

  it('lists the PRDs whose folder a commit of yours touched on the base, and none of anyone else\'s', () => {
    const overview = overviewFor(facts({
      email: ME,
      shipped: [1, 2],
      inbox: [3, 4],
      touched: [touch(1), touch(2, OTHER), touch(3), touch(4, OTHER)],
    }));
    expect(overview.yours).toMatchObject({ state: 'known', email: ME });
    expect(numbers(overview.yours)).toEqual({ rows: ['inbox 3'], shipped: [1] });
  });

  it('counts a folder commit of yours on a feature or a phase-0 branch', () => {
    const overview = overviewFor(facts({
      email: ME,
      inbox: [3, 4],
      features: [feature(4, { outbox: ['a.md'], authors: [OTHER], touched: [touch(4)] })],
      phase0: [phase0(9, { touched: [touch(9)] }), phase0(8, { touched: [touch(8, OTHER)] })],
    }));
    expect(numbers(overview.yours)).toEqual({ rows: ['outbox 4', 'inReview 9'], shipped: [] });
  });

  it('counts the PRD whose feature branch carries a commit of yours beyond the base, folder untouched', () => {
    const overview = overviewFor(facts({
      email: ME,
      inbox: [3, 4, 5],
      touched: [touch(3, OTHER), touch(4, OTHER), touch(5, OTHER)],
      features: [feature(4, { ...CODE, authors: [OTHER, ME] }), feature(5, { ...CODE, authors: [OTHER] })],
    }));
    expect(numbers(overview.yours)).toEqual({ rows: ['outbox 4'], shipped: [] });
  });

  it('counts a feature branch of yours for its inbox PRD even while it is not built', () => {
    const overview = overviewFor(facts({ email: ME, inbox: [4], features: [feature(4, { authors: [ME] })] }));
    expect(numbers(overview.yours)).toEqual({ rows: ['inbox 4'], shipped: [] });
  });

  it('compares the email ignoring case', () => {
    const overview = overviewFor(facts({
      email: 'Me@Example.com',
      inbox: [3, 4],
      touched: [touch(3, 'ME@EXAMPLE.COM')],
      features: [feature(4, { authors: ['me@EXAMPLE.com'] })],
    }));
    expect(overview.yours.email).toBe('Me@Example.com');
    expect(numbers(overview.yours)).toEqual({ rows: ['inbox 4', 'inbox 3'], shipped: [] });
  });

  it('compares the email exactly otherwise', () => {
    const overview = overviewFor(facts({ email: ME, inbox: [3, 4], touched: [touch(3, 'me@example.co'), touch(4, 'xme@example.com')] }));
    expect(overview.yours.rows).toEqual([]);
  });

  it('lists the outbox, then the inbox, then in review, each newest first, then the shipped newest first', () => {
    const overview = overviewFor(facts({
      email: ME,
      shipped: [1, 3, 2],
      inbox: [4, 7, 5, 6],
      touched: [1, 2, 3, 4, 5, 6, 7].map((prd) => touch(prd)),
      features: [feature(4, { outbox: ['a.md', 'b.md'] }), feature(6, CODE)],
      phase0: [phase0(8, { touched: [touch(8)] }), phase0(9, { touched: [touch(9)] })],
    }));
    expect(overview.yours.rows).toEqual([
      { stage: 'outbox', prd: 6, topic: 't6', openItems: 0 },
      { stage: 'outbox', prd: 4, topic: 't4', openItems: 2 },
      { stage: 'inbox', prd: 7, topic: 't7' },
      { stage: 'inbox', prd: 5, topic: 't5' },
      { stage: 'inReview', prd: 9, topic: 't9' },
      { stage: 'inReview', prd: 8, topic: 't8' },
    ]);
    expect(overview.yours.shipped).toEqual([{ prd: 3, topic: 't3' }, { prd: 2, topic: 't2' }, { prd: 1, topic: 't1' }]);
  });

  it('lists a PRD once, in the stage it is counted in', () => {
    const overview = overviewFor(facts({
      email: ME,
      shipped: [1],
      inbox: [1, 4],
      touched: [touch(1), touch(4), touch(4)],
      features: [feature(4, { ...CODE, authors: [ME], touched: [touch(4)] })],
      phase0: [phase0(4, { touched: [touch(4)] })],
    }));
    expect(numbers(overview.yours)).toEqual({ rows: ['outbox 4'], shipped: [1] });
  });

  it('leaves out a PRD of yours that is in no stage, and a feature branch whose topic names no inbox PRD', () => {
    const overview = overviewFor(facts({
      email: ME,
      shipped: [1],
      inbox: [2],
      touched: [touch(7)],
      features: [feature(1, { ...CODE, authors: [ME] }), feature(9, { ...CODE, authors: [ME] })],
      phase0: [phase0(8, { inbox: [8], topic: 'elsewhere', touched: [touch(8)] })],
    }));
    expect(numbers(overview.yours)).toEqual({ rows: [], shipped: [] });
  });

  it('has no row and no shipped PRD when none is yours', () => {
    const overview = overviewFor(facts({ email: ME, shipped: [1], inbox: [2], touched: [touch(1, OTHER), touch(2, OTHER)] }));
    expect(overview.yours).toEqual({ state: 'known', email: ME, rows: [], shipped: [] });
  });

  it('cannot tell without an email', () => {
    const overview = overviewFor(facts({ shipped: [1], touched: [touch(1)] }));
    expect(overview.yours).toEqual({ state: 'no-email', email: null, rows: [], shipped: [] });
    expect(overview.counts.shipped).toBe(1);
  });

  it('cannot tell in a shallow clone', () => {
    const overview = overviewFor(facts({ email: ME, shallow: true, shipped: [1], touched: [touch(1)] }));
    expect(overview.yours).toEqual({ state: 'shallow', email: ME, rows: [], shipped: [] });
    expect(overview.bar).toEqual({ delivered: 1, total: 1, percent: 100, filled: 30 });
  });
});
