import { describe, expect, it } from 'vitest';
import { BoardAnswer, boardPath, fullNameOf, lanesOf, type Idea } from './model';

// The board as ideas_board() answers it (PRD 1246, s1): parsed where it comes in, then split into its
// three lanes, each sorted by votes, then by age, with no archived idea.

let n = 0;
const idea = (over: Partial<Idea> & Pick<Idea, 'title'>): Idea => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  pitch: 'A pitch.',
  lane: 'later',
  prd: null,
  created_at: '2026-10-01T09:00:00+00:00',
  votes: 0,
  voted: false,
  archived: false,
  ...over,
});

describe('lanesOf', () => {
  it('puts each idea in its lane, Now, Next then Later', () => {
    const lanes = lanesOf([idea({ title: 'later one' }), idea({ title: 'now one', lane: 'now' }), idea({ title: 'next one', lane: 'next' })]);
    expect(lanes.map((lane) => [lane.lane, lane.ideas.map((i) => i.title)])).toEqual([
      ['now', ['now one']],
      ['next', ['next one']],
      ['later', ['later one']],
    ]);
  });

  it('sorts a lane by votes, most first, then the oldest first', () => {
    const [now] = lanesOf([
      idea({ title: 'young, 3 votes', lane: 'now', votes: 3, created_at: '2026-10-05T09:00:00+00:00' }),
      idea({ title: 'old, 3 votes', lane: 'now', votes: 3, created_at: '2026-10-01T09:00:00+00:00' }),
      idea({ title: 'one vote', lane: 'now', votes: 1, created_at: '2026-09-01T09:00:00+00:00' }),
      idea({ title: 'ten votes', lane: 'now', votes: 10, created_at: '2026-10-07T09:00:00+00:00' }),
    ]);
    expect(now?.ideas.map((i) => i.title)).toEqual(['ten votes', 'old, 3 votes', 'young, 3 votes', 'one vote']);
  });

  it('settles a tie of votes and age by id, so the order never moves', () => {
    const a = idea({ title: 'a', id: '00000000-0000-4000-8000-00000000000a' });
    const b = idea({ title: 'b', id: '00000000-0000-4000-8000-00000000000b' });
    expect(lanesOf([b, a])[2]?.ideas.map((i) => i.title)).toEqual(['a', 'b']);
    expect(lanesOf([a, b])[2]?.ideas.map((i) => i.title)).toEqual(['a', 'b']);
  });

  it('leaves an archived idea out', () => {
    const lanes = lanesOf([idea({ title: 'kept', lane: 'next' }), idea({ title: 'archived', lane: 'next', archived: true, votes: 99 })]);
    expect(lanes.flatMap((lane) => lane.ideas.map((i) => i.title))).toEqual(['kept']);
  });

  it('keeps three lanes when the board is empty', () => {
    expect(lanesOf([]).map((lane) => [lane.lane, lane.ideas.length])).toEqual([['now', 0], ['next', 0], ['later', 0]]);
  });
});

describe('BoardAnswer', () => {
  const answer = {
    repo: 'vertuoza/vertuo-omni-loop',
    public: true,
    member: false,
    ideas: [{ id: '00000000-0000-4000-8000-000000000001', title: 'A', pitch: 'B', lane: 'now', prd: 1246, created_at: '2026-10-01T09:00:00+00:00', votes: 2, voted: false, archived: false }],
  };

  it('parses the board ideas_board() answers', () => {
    expect(BoardAnswer.parse(answer)?.ideas[0]?.prd).toBe(1246);
  });

  it('parses null, a private or missing board', () => {
    expect(BoardAnswer.parse(null)).toBeNull();
  });

  it('refuses a lane other than now, next or later, a negative count, and an unknown key', () => {
    expect(BoardAnswer.safeParse({ ...answer, ideas: [{ ...answer.ideas[0], lane: 'someday' }] }).success).toBe(false);
    expect(BoardAnswer.safeParse({ ...answer, ideas: [{ ...answer.ideas[0], votes: -1 }] }).success).toBe(false);
    expect(BoardAnswer.safeParse({ ...answer, voters: [] }).success).toBe(false);
  });
});

describe('the board\'s address', () => {
  it('is /ideas/<owner>/<repo>', () => {
    expect(boardPath('vertuoza/vertuo-omni-loop')).toBe('/ideas/vertuoza/vertuo-omni-loop');
  });

  it('reads owner/name from the route, in lower case, and refuses anything GitHub would not name', () => {
    expect(fullNameOf('Vertuoza', 'Vertuo-Omni-Loop')).toBe('vertuoza/vertuo-omni-loop');
    expect(fullNameOf('vertuoza', 'pdf.builder_2')).toBe('vertuoza/pdf.builder_2');
    expect(fullNameOf('vert uoza', 'x')).toBeNull();
    expect(fullNameOf('vertuoza', '..%2F')).toBeNull();
    expect(fullNameOf('a'.repeat(40), 'x')).toBeNull();
  });
});
