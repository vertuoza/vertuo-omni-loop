import { describe, expect, it } from 'vitest';
import { boardOf, checkIdea, listLines, PITCH_MAX, TITLE_MAX } from './idea.ts';

const idea = (over: Record<string, unknown> = {}) => ({
  id: '00000000-0000-4000-8000-000000000001', title: 'Improve the HUD', pitch: 'More useful facts.', lane: 'now', prd: null, votes: 3, ...over,
});

describe('checkIdea', () => {
  it('takes a title, a pitch and a lane, trimmed, in later when no lane is given', () => {
    expect(checkIdea({ title: '  Improve the HUD ', pitch: ' More facts. ', lane: undefined })).toEqual({
      ok: true, idea: { title: 'Improve the HUD', pitch: 'More facts.', lane: 'later' },
    });
    expect(checkIdea({ title: 'A', pitch: 'B', lane: 'now' })).toEqual({ ok: true, idea: { title: 'A', pitch: 'B', lane: 'now' } });
  });

  it('refuses a lane that is not now, next or later', () => {
    expect(checkIdea({ title: 'A', pitch: 'B', lane: 'soon' })).toEqual({ ok: false, problem: '--lane is now, next or later, not "soon".' });
  });

  it('refuses an empty title or pitch, and one over its length', () => {
    expect(checkIdea({ title: ' ', pitch: 'B', lane: undefined })).toEqual({ ok: false, problem: 'an idea needs a title.' });
    expect(checkIdea({ title: 'A', pitch: '', lane: undefined })).toEqual({ ok: false, problem: 'an idea needs a pitch (--pitch).' });
    expect(checkIdea({ title: 'x'.repeat(TITLE_MAX), pitch: 'y'.repeat(PITCH_MAX), lane: undefined }).ok).toBe(true);
    expect(checkIdea({ title: 'x'.repeat(TITLE_MAX + 1), pitch: 'B', lane: undefined })).toEqual({
      ok: false, problem: `a title holds ${TITLE_MAX} characters at most (this one has ${TITLE_MAX + 1}).`,
    });
    expect(checkIdea({ title: 'A', pitch: 'y'.repeat(PITCH_MAX + 1), lane: undefined })).toEqual({
      ok: false, problem: `a pitch holds ${PITCH_MAX} characters at most (this one has ${PITCH_MAX + 1}).`,
    });
  });
});

describe('boardOf', () => {
  it('reads the list reply, its ideas grouped by lane in the order the app sent them', () => {
    const board = boardOf({
      repo: 'acme/widgets', url: 'https://omni.example/ideas/acme/widgets',
      ideas: [idea({ lane: 'later', title: 'L1' }), idea({ title: 'N1', votes: 5 }), idea({ title: 'N2', votes: 1, prd: 12 })],
    });
    expect(board?.lanes.map(({ lane, ideas }) => [lane, ideas.map((i) => i.title)])).toEqual([
      ['now', ['N1', 'N2']], ['next', []], ['later', ['L1']],
    ]);
    expect(board?.url).toBe('https://omni.example/ideas/acme/widgets');
  });

  it('is null for a reply that is not a board', () => {
    expect(boardOf({})).toBeNull();
    expect(boardOf({ repo: 'acme/widgets', url: 'x', ideas: [idea({ lane: 'soon' })] })).toBeNull();
  });
});

describe('listLines', () => {
  it('prints the lanes, Now, Next then Later, each idea with its votes, a PRD when it has one', () => {
    const board = boardOf({
      repo: 'acme/widgets', url: 'https://omni.example/ideas/acme/widgets',
      ideas: [idea({ title: 'N1', votes: 5 }), idea({ title: 'N2', votes: 1, prd: 12 }), idea({ lane: 'later', title: 'L1', votes: 0 })],
    });
    if (!board) throw new Error('no board');
    expect(listLines(board)).toEqual([
      'acme/widgets — https://omni.example/ideas/acme/widgets',
      'Now',
      '  ▲ 5  N1',
      '  ▲ 1  N2 · PRD #12',
      'Next',
      '  (none)',
      'Later',
      '  ▲ 0  L1',
    ]);
  });
});
