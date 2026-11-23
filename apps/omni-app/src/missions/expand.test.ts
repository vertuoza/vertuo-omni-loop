import { describe, expect, it } from 'vitest';
import { parsePrd, parseProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { parseBrief } from 'omni-loop/kit/lib/mission/brief.ts';
import { expandMissionScope, heldBy, heldWords, rowsOfRoadmap, type ScopeRow } from './expand.ts';

// A mission's scope, products included (PRD omni-loop-21 s7): a product roadmap expands into its rows in wave order, each held
// until its blockers joined the mission branch, as /omni:drive --roadmap holds them.

const id = parseProductPrdId;

/** omni-loop-R3 as the server holds it: its waves written out of order in the table, a repository PRD among its rows. */
const R3 = [
  '---',
  'roadmap: omni-loop-R3',
  'title: The fleet takes products',
  'milestone: A mission delivers a product roadmap.',
  '---',
  '',
  '## PRDs',
  '',
  '| id | PRD | title | blocked by | why | wave |',
  '|---|---|---|---|---|---|',
  '| P3 | omni-loop-17 | Landing | P1, P2 | lands both | 3 |',
  '| P1 | omni-loop-15 | The scope | – | – | 1 |',
  '| P2 | omni-loop-16 | The plan | P1 | reads the scope | 2 |',
  '| P4 | #2896 | Own branch | – | – | 1 |',
  '',
].join('\n');

const BRIEF = [
  '---',
  'mission: 3150',
  'title: The fleet takes products',
  'fleet: night-shift',
  'goal: A mission delivers a product roadmap on its own.',
  'scope:',
  '  prds: [omni-loop-20]',
  '  roadmaps: [omni-loop-R3]',
  'mandate:',
  '  level: alone',
  '---',
  '',
].join('\n');

const rowsOf = (text: string): ScopeRow[] => {
  const read = rowsOfRoadmap(text);
  if (!read.ok) throw new Error(read.why);
  return read.rows;
};

describe('expandMissionScope: the scope\'s PRDs, a product roadmap expanded into its rows', () => {
  it('AC-1: a brief whose roadmap is omni-loop-R3 expands into its rows in wave order, after the PRDs named alone', () => {
    const brief = parseBrief(BRIEF);
    expect(brief.ok && brief.brief.scope).toEqual({ prds: ['omni-loop-20'], roadmaps: ['omni-loop-R3'] });
    if (!brief.ok) return;
    const prds = brief.brief.scope.prds;
    expect(expandMissionScope(prds, [rowsOf(R3)])).toEqual([
      { prd: id('omni-loop-20'), blockers: [] },
      { prd: id('omni-loop-15'), blockers: [] },
      { prd: parsePrd(2896), blockers: [] },
      { prd: id('omni-loop-16'), blockers: [id('omni-loop-15')] },
      { prd: id('omni-loop-17'), blockers: [id('omni-loop-15'), id('omni-loop-16')] },
    ]);
  });

  it('keeps a PRD named twice once, where it came first, with every blocker either names', () => {
    const rows: ScopeRow[] = [
      { id: 'A', prd: id('omni-loop-15'), blockedBy: [], wave: 1 },
      { id: 'B', prd: id('omni-loop-16'), blockedBy: ['A'], wave: 2 },
    ];
    const other: ScopeRow[] = [
      { id: 'X', prd: parsePrd(2896), blockedBy: [], wave: 1 },
      { id: 'Y', prd: id('omni-loop-16'), blockedBy: ['X'], wave: 1 },
    ];
    expect(expandMissionScope([id('omni-loop-16')], [rows, other])).toEqual([
      { prd: id('omni-loop-16'), blockers: [id('omni-loop-15'), parsePrd(2896)] },
      { prd: id('omni-loop-15'), blockers: [] },
      { prd: parsePrd(2896), blockers: [] },
    ]);
  });

  it('reads no blocker from a row id the roadmap does not hold, nor a PRD as its own blocker', () => {
    const rows: ScopeRow[] = [
      { id: 'A', prd: id('omni-loop-15'), blockedBy: ['Z', 'A'], wave: 1 },
    ];
    expect(expandMissionScope([], [rows])).toEqual([{ prd: id('omni-loop-15'), blockers: [] }]);
  });

  it('reads a scope of repository numbers alone as before: each PRD, no blocker', () => {
    expect(expandMissionScope([parsePrd(2803), parsePrd(2804)], [])).toEqual([
      { prd: parsePrd(2803), blockers: [] },
      { prd: parsePrd(2804), blockers: [] },
    ]);
  });
});

describe('rowsOfRoadmap: a product roadmap\'s rows, from the file its page holds', () => {
  it('reads each row\'s id, PRD, blockers and wave', () => {
    expect(rowsOf(R3)).toEqual([
      { id: 'P3', prd: id('omni-loop-17'), blockedBy: ['P1', 'P2'], wave: 3 },
      { id: 'P1', prd: id('omni-loop-15'), blockedBy: [], wave: 1 },
      { id: 'P2', prd: id('omni-loop-16'), blockedBy: ['P1'], wave: 2 },
      { id: 'P4', prd: parsePrd(2896), blockedBy: [], wave: 1 },
    ]);
  });

  it('refuses a file that does not read, saying its first fault', () => {
    const read = rowsOfRoadmap('no front matter');
    expect(read.ok).toBe(false);
    expect(!read.ok && read.why).toContain('no front matter');
  });
});

describe('heldBy: a row held until its blockers joined the mission branch', () => {
  const entry = { prd: id('omni-loop-17'), blockers: [id('omni-loop-15'), id('omni-loop-16')] };

  it('holds a row while a blocker has not joined, naming each that has not', () => {
    expect(heldBy(entry, new Set())).toEqual([id('omni-loop-15'), id('omni-loop-16')]);
    expect(heldBy(entry, new Set([id('omni-loop-15')]))).toEqual([id('omni-loop-16')]);
  });

  it('frees it once every blocker joined', () => {
    expect(heldBy(entry, new Set([id('omni-loop-15'), id('omni-loop-16')]))).toEqual([]);
  });

  it('says what it waits on, in words', () => {
    expect(heldWords(entry.prd, [id('omni-loop-16')], 'mission/3150-the-fleet')).toBe('PRD omni-loop-17 waits for PRD omni-loop-16 to join mission/3150-the-fleet');
    expect(heldWords(entry.prd, [id('omni-loop-15'), id('omni-loop-16')], null)).toBe('PRD omni-loop-17 waits for PRD omni-loop-15, PRD omni-loop-16 to join the mission branch');
  });
});
