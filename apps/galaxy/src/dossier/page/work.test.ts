import { describe, expect, it } from 'vitest';
import { kindOf, misrouted, ofWork, workPath } from './work';

// Where each kind of dossier is read (PRD 627): /prd, /visual and /bugs, and the redirect from another
// kind's route to its own.

describe('the kind of a dossier', () => {
  it('reads a row without a kind as a PRD', () => {
    expect(kindOf({})).toBe('prd');
    expect(kindOf({ kind: 'visual' })).toBe('visual');
  });

  it('keeps only the rows of a kind, in order', () => {
    const rows = [{ id: 'a' }, { id: 'b', kind: 'visual' as const }, { id: 'c', kind: 'bug' as const }, { id: 'd', kind: 'prd' as const }];
    expect(ofWork(rows, 'prd').map((r) => r.id)).toEqual(['a', 'd']);
    expect(ofWork(rows, 'visual').map((r) => r.id)).toEqual(['b']);
    expect(ofWork(rows, 'bug').map((r) => r.id)).toEqual(['c']);
  });

  it('opens each kind on its own route', () => {
    expect(workPath('prd', 'x1')).toBe('/prd/x1');
    expect(workPath('visual', 'x1')).toBe('/visual/x1');
    expect(workPath('bug', 'x1')).toBe('/bugs/x1');
  });
});

describe('misrouted', () => {
  it('sends a fix opened on /prd/<id> to its own route, the query kept', () => {
    expect(misrouted('visual', 'prd', 'x1')).toBe('/visual/x1');
    expect(misrouted('bug', 'prd', 'x1', { tab: 'questions', v: ['2'] })).toBe('/bugs/x1?tab=questions&v=2');
  });

  it('sends a PRD opened on a fix route to /prd/<id>, and a fix on the other fix route to its own', () => {
    expect(misrouted('prd', 'visual', 'x1', { tab: 'spec' })).toBe('/prd/x1?tab=spec');
    expect(misrouted('prd', 'bug', 'x1')).toBe('/prd/x1');
    expect(misrouted('visual', 'bug', 'x1')).toBe('/visual/x1');
  });

  it('keeps a dossier on its own route', () => {
    expect(misrouted('prd', 'prd', 'x1', { tab: 'spec' })).toBeNull();
    expect(misrouted('visual', 'visual', 'x1')).toBeNull();
    expect(misrouted('bug', 'bug', 'x1')).toBeNull();
  });
});
