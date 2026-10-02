import { describe, expect, it } from 'vitest';
import { JEV_DECISIONS, jevEntry } from './index';
import { unknownWorthAsking } from './unknown-worth-asking';

// Unknown worth asking's registry entry (PRD 855 s4): a Noul "a person should be asked this", mapped with
// the decision's threshold (true: worth asking); what it sends Jev (the question, its repository and file,
// the product's confirmed claims); listed on Settings › Jev, made in Galaxy only.

const INPUT = {
  question: 'Do we sell in Luxembourg?',
  repo: 'acme/app',
  file: 'src/NewQuoteForm.tsx',
  claims: ['region#1: Belgium', 'size#3: 2-50'],
};

describe('unknown-worth-asking', () => {
  it('asks a Noul whether a person should be asked', () => {
    const q = unknownWorthAsking.question;
    expect(q.type).toBe('noul');
    if (q.type !== 'noul') return;
    expect(q.statement).toMatch(/person/i);
  });

  it('maps a Noul at or above the threshold to worth asking, under it to not', () => {
    expect(unknownWorthAsking.value(0.5, { threshold: 0.5 })).toBe(true);
    expect(unknownWorthAsking.value(0.12, { threshold: 0.5 })).toBe(false);
    expect(unknownWorthAsking.value('no', { threshold: 0.5 })).toBeNull();
    expect(unknownWorthAsking.value(1.5, { threshold: 0.5 })).toBeNull();
    expect(unknownWorthAsking.show(false)).toBe('false');
  });

  it('sends the question, its repository and file, and the confirmed claims', () => {
    const state = String(unknownWorthAsking.state(INPUT));
    for (const part of [INPUT.question, INPUT.repo, INPUT.file, ...INPUT.claims]) expect(state).toContain(part);
    const bare = String(unknownWorthAsking.state({ question: 'Who?', repo: null, file: null, claims: [] }));
    expect(bare).toContain('Who?');
    expect(bare).toMatch(/no confirmed claim/i);
  });

  it('is made in Galaxy only: a terminal cannot ask it', () => {
    expect(unknownWorthAsking.terminal).toBeUndefined();
  });

  it('is the fourth decision on Settings › Jev, registered, with what it sends', () => {
    const row = JEV_DECISIONS[3]!;
    expect(row.name).toBe('unknown-worth-asking');
    expect(row.title).toBe('Unknown worth asking');
    expect(row.sends).toMatch(/question/i);
    expect(jevEntry('unknown-worth-asking')).toBe(unknownWorthAsking);
  });
});
