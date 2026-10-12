// PRD 790, slice s1: a feature PR's care state. PRD 1665, s4: read from the loop's facts — one change
// with its review and its conversation's comments, as `LoopReads` answers them.
import { describe, expect, it } from 'vitest';
import { careState } from './state.ts';
import type { CareFacts } from './state.ts';
import { assertDefined } from '../../test/assert.ts';
import { parseCommentId, parsePr } from '../ids.ts';
import type { LoopChangeDetail } from '../loop-reads/contract.ts';

const STATUS = '<!-- omni-outbox-status -->';
const OPTIONS = { statusMarker: STATUS, needsFixLabel: 'omni:needs-fix', gateContexts: ['outbox', 'inbox'] };

type Review = LoopChangeDetail['review'];
type Thread = Review['threads'][number];

const comment = (author: string, body: string, createdAt: string) => ({ author, body, createdAt });

const thread = (id: string, comments: Thread['comments'], { resolved = false } = {}): Thread => ({ id, resolved, path: 'src/a.mjs', line: 3, comments });

/** One change and its comments, with `over` merged into the change and `review` into its review. */
function facts(over: Partial<LoopChangeDetail> = {}, review: Partial<Review> = {}, comments: CareFacts['comments'] = []): CareFacts {
  return {
    change: {
      number: parsePr(9),
      title: 'Widgets',
      head: 'feat/widgets',
      base: 'main',
      state: 'open',
      createdAt: '2026-09-30T09:00:00Z',
      updatedAt: '2026-09-30T09:00:00Z',
      mergedAt: null,
      labels: [],
      body: '',
      url: 'https://github.com/acme/widgets/pull/9',
      author: 'pm',
      lastCommitAt: null,
      files: [],
      review: { checks: [{ name: 'test', state: 'success' }], mergeable: true, threads: [], ...review },
      ...over,
    },
    comments,
  };
}

const statusComment = (id: number, body: string) => ({ id: parseCommentId(id), body });

describe('careState — checks', () => {
  it('reads every check passed as green', () => {
    expect(careState(facts(), OPTIONS).checks).toEqual({ state: 'green', failed: [], stuck: false, fixable: false });
    const quiet = facts({}, { checks: [{ name: 'a', state: 'neutral' }, { name: 'b', state: 'skipped' }, { name: 'c', state: 'success' }] });
    expect(careState(quiet, OPTIONS).checks.state).toBe('green');
  });

  it('reads a failed check as red, naming every failed one, with no link to read', () => {
    const checks: Review['checks'] = [
      { name: 'test', state: 'failure' },
      { name: 'lint', state: 'success' },
      { name: 'vercel', state: 'failure' },
      { name: 'e2e', state: 'pending' },
    ];
    expect(careState(facts({}, { checks }), OPTIONS).checks).toEqual({
      state: 'red',
      failed: [
        { name: 'test', url: null },
        { name: 'vercel', url: null },
      ],
      stuck: false,
      fixable: true,
    });
  });

  it('reads a pending check as running, and none when there is no check', () => {
    expect(careState(facts({}, { checks: [{ name: 'test', state: 'pending' }, { name: 'lint', state: 'success' }] }), OPTIONS).checks.state).toBe('running');
    expect(careState(facts({}, { checks: [] }), OPTIONS).checks).toEqual({ state: 'none', failed: [], stuck: false, fixable: false });
  });

  it('does not call red fixable when only the outbox or inbox gate is red', () => {
    const checks: Review['checks'] = [{ name: 'outbox', state: 'failure' }, { name: 'inbox', state: 'failure' }];
    expect(careState(facts({}, { checks }), OPTIONS).checks).toMatchObject({ state: 'red', fixable: false });
    expect(careState(facts({}, { checks: [...checks, { name: 'test', state: 'failure' }] }), OPTIONS).checks.fixable).toBe(true);
  });

  it('reads the needs-fix label as stuck, and no label as not stuck', () => {
    const red = facts({ labels: ['omni:needs-fix'] }, { checks: [{ name: 'test', state: 'failure' }] });
    expect(careState(red, OPTIONS).checks).toMatchObject({ state: 'red', stuck: true });
    expect(careState(red, { ...OPTIONS, needsFixLabel: null }).checks.stuck).toBe(false);
  });
});

describe('careState — the pull request', () => {
  it('reads its number, state, branches, labels and mergeable state', () => {
    const state = careState(facts({ labels: ['omni:feature'] }, { mergeable: false }), OPTIONS);
    expect(state.pr).toEqual({
      number: 9,
      url: 'https://github.com/acme/widgets/pull/9',
      state: 'OPEN',
      isDraft: false,
      base: 'main',
      head: 'feat/widgets',
      labels: ['omni:feature'],
    });
    expect(state.mergeable).toBe('CONFLICTING');
  });

  it('names its state as GitHub did: a draft is open, merged and closed as they are', () => {
    const named = (state: LoopChangeDetail['state']) => careState(facts({ state }), OPTIONS).pr;
    expect(named('draft')).toMatchObject({ state: 'OPEN', isDraft: true });
    expect(named('merged')).toMatchObject({ state: 'MERGED', isDraft: false });
    expect(named('closed')).toMatchObject({ state: 'CLOSED', isDraft: false });
  });

  it('reads mergeable as MERGEABLE, CONFLICTING or UNKNOWN', () => {
    expect(careState(facts(), OPTIONS).mergeable).toBe('MERGEABLE');
    expect(careState(facts({}, { mergeable: null }), OPTIONS).mergeable).toBe('UNKNOWN');
  });
});

describe('careState — review threads', () => {
  const ask = comment('rev', 'Please remove the duplicated block.', '2026-09-30T10:00:00Z');

  it('lists an unresolved thread with no care reply as unhandled, to judge', () => {
    const [t] = careState(facts({}, { threads: [thread('T1', [ask])] }), OPTIONS).threads;
    assertDefined(t, 't');
    expect(t).toMatchObject({ id: 'T1', url: null, resolved: false, verdict: null, reason: null, needs: 'judge', path: 'src/a.mjs', line: 3 });
    expect(t.comments).toEqual([{ author: 'rev', avatarUrl: null, body: ask.body, createdAt: ask.createdAt, url: null, verdict: null }]);
  });

  it('leaves out a thread a person resolved without care', () => {
    expect(careState(facts({}, { threads: [thread('T1', [ask], { resolved: true })] }), OPTIONS).threads).toEqual([]);
  });

  it.each(['fixed', 'pushed-back'])('reads a resolved thread with a %s reply as handled, with its reason', (verdict) => {
    const reply = comment('bot', `Because.\n\n<!-- omni-care: ${verdict} -->`, '2026-09-30T10:05:00Z');
    const [t] = careState(facts({}, { threads: [thread('T1', [ask, reply], { resolved: true })] }), OPTIONS).threads;
    expect(t).toMatchObject({ resolved: true, verdict, reason: 'Because.', needs: null });
  });

  it('reads an asked thread as asked and handled, even when more is said after', () => {
    const reply = comment('bot', 'The PM will decide.\n\n<!-- omni-care: asked -->', '2026-09-30T10:05:00Z');
    const more = comment('rev', 'ok', '2026-09-30T10:07:00Z');
    const [t] = careState(facts({}, { threads: [thread('T1', [ask, reply, more])] }), OPTIONS).threads;
    expect(t).toMatchObject({ verdict: 'asked', needs: null, reason: 'The PM will decide.' });
  });

  it('makes a thread asked when a person writes after a care reply: the reviewer keeps the last word', () => {
    const reply = comment('bot', 'Low value.\n\n<!-- omni-care: pushed-back -->', '2026-09-30T10:05:00Z');
    const again = comment('rev', 'I still want it.', '2026-09-30T10:07:00Z');
    const [t] = careState(facts({}, { threads: [thread('T1', [ask, reply, again], { resolved: true })] }), OPTIONS).threads;
    expect(t).toMatchObject({ verdict: 'asked', needs: 'mark-asked' });
  });

  it('makes a thread asked when a person reopens a thread care resolved', () => {
    const reply = comment('bot', 'Fixed in abc123: dedupe.\n\n<!-- omni-care: fixed -->', '2026-09-30T10:05:00Z');
    const [t] = careState(facts({}, { threads: [thread('T1', [ask, reply], { resolved: false })] }), OPTIONS).threads;
    expect(t).toMatchObject({ verdict: 'asked', needs: 'mark-asked' });
  });
});

describe('careState — the status comment', () => {
  it('reads the care line of the status comment', () => {
    const comments = [
      statusComment(1, 'hello'),
      statusComment(42, `${STATUS}\n**Agent status** · updated x\n\n- PR care: watching since 2026-09-30 10:00 UTC · last round 2026-09-30 10:25 UTC\n`),
    ];
    expect(careState(facts({}, {}, comments), OPTIONS).status).toEqual({
      commentId: 42,
      watchingSince: '2026-09-30 10:00 UTC',
      lastRound: '2026-09-30 10:25 UTC',
    });
  });

  it('reads a status comment with no care line, and none at all', () => {
    expect(careState(facts({}, {}, [statusComment(7, `${STATUS}\n- state: done`)]), OPTIONS).status).toEqual({ commentId: 7, watchingSince: null, lastRound: null });
    expect(careState(facts(), OPTIONS).status).toBeNull();
    expect(careState(facts({}, {}, [statusComment(7, `${STATUS}\n- state: done`)]), { ...OPTIONS, statusMarker: null }).status).toBeNull();
  });
});

describe('careState — waits on another repository (PRD 1118)', () => {
  it('reads the waits-on line of the status comment', () => {
    const comments = [statusComment(8, `${STATUS}\n- PR care: watching since a · last round b\n- waits on acme/backend#41\n`)];
    expect(careState(facts({}, {}, comments), OPTIONS).status).toEqual({
      commentId: 8,
      watchingSince: 'a',
      lastRound: 'b',
      waitsOn: { slug: 'acme/backend', pr: 41 },
    });
  });

  it('reads a status comment without the line as not waiting', () => {
    const comments = [statusComment(8, `${STATUS}\n- PR care: watching since a · last round b\n`)];
    expect(careState(facts({}, {}, comments), OPTIONS).status).not.toHaveProperty('waitsOn');
  });

  it('reads no waits-on line outside the status comment', () => {
    const comments = [statusComment(1, 'waits on acme/backend#41'), statusComment(8, `${STATUS}\n- state: done`)];
    expect(careState(facts({}, {}, comments), OPTIONS).status).not.toHaveProperty('waitsOn');
  });
});
