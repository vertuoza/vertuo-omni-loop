import { describe, expect, it } from 'vitest';
import { BUG_RISK_LEVELS, bugRisk } from './bug-risk';
import { sure } from '../../arcade/sure';

// The bug risk's registry entry (PRD 812 s5): a Score over low, medium, high and critical (lowest
// first, as the client reads a Score), each level worded as the bug-fixing form defines it; what it
// sends Jev (decision 10: the issue's title and body, the reproduction's path, the domain and the
// agent's own one-sentence risk); and the state and old answer a terminal may send.

const TUNING = { threshold: 0.5 };
const STATE = {
  title: 'Bug: saving twice duplicates the row',
  body: 'Click Save twice quickly and the list shows the entry twice.',
  reproduction: 'apps/galaxy/src/ask/store.test.ts',
  domain: 'ask rounds',
  risk: 'A member sees a duplicated round; deleting one is the workaround.',
};

describe('bug-risk', () => {
  it('asks a Score whose levels are low, medium, high and critical, lowest first', () => {
    const q = bugRisk.question;
    expect(q.type).toBe('score');
    if (q.type !== 'score') return;
    expect(q.levels.map((l) => l.key)).toEqual(['low', 'medium', 'high', 'critical']);
    expect(BUG_RISK_LEVELS).toEqual(['low', 'medium', 'high', 'critical']);
    expect(q.instructions).toMatch(/risk/i);
  });

  it('words each level as the bug-fixing form defines it', () => {
    const q = bugRisk.question;
    if (q.type !== 'score') throw new Error('not a Score');
    const wording = Object.fromEntries(q.levels.map((l) => [l.key, l.description]));
    expect(wording.critical).toMatch(/data loss, security, money, or a whole surface down for every user/);
    expect(wording.high).toMatch(/a main flow broken with no workaround/);
    expect(wording.medium).toMatch(/a flow broken with a workaround, or a secondary flow broken/);
    expect(wording.low).toMatch(/cosmetic, or a minor inconvenience/);
  });

  it('maps each level to itself, and refuses anything else', () => {
    for (const level of BUG_RISK_LEVELS) expect(bugRisk.value(level, TUNING)).toBe(level);
    expect(bugRisk.value('severe', TUNING)).toBeNull();
    expect(bugRisk.value('High', TUNING)).toBeNull();
    expect(bugRisk.value(0.9, TUNING)).toBeNull();
    expect(bugRisk.show('high')).toBe('high');
  });

  it('gives Jev the issue, the reproduction, the domain and the agent\'s sentence', () => {
    const state = bugRisk.state(STATE);
    expect(typeof state).toBe('string');
    expect(state).toContain('Issue: Bug: saving twice duplicates the row');
    expect(state).toContain('Click Save twice quickly');
    expect(state).toContain('Reproduction: apps/galaxy/src/ask/store.test.ts');
    expect(state).toContain('Domain: ask rounds');
    expect(state).toContain('Agent\'s risk: A member sees a duplicated round');
  });

  it('reads a state from a terminal, and refuses a malformed one', () => {
    const terminal = sure(bugRisk.terminal, 'bugRisk.terminal');
    expect(terminal.input(STATE)).toEqual(STATE);
    expect(terminal.input({ title: 'Only a title.' })).toEqual({ title: 'Only a title.', body: '', reproduction: null, domain: null, risk: null });
    expect(terminal.input({ ...STATE, title: '' })).toBeNull();
    expect(terminal.input({ ...STATE, body: 7 })).toBeNull();
    expect(terminal.input({ ...STATE, secret: 'x' })).toBeNull();
    expect(terminal.input('text')).toBeNull();
    expect(terminal.input(null)).toBeNull();
  });

  it('reads the agent\'s own level as the old answer', () => {
    const terminal = sure(bugRisk.terminal, 'bugRisk.terminal');
    for (const level of BUG_RISK_LEVELS) expect(terminal.old(level)).toBe(level);
    expect(terminal.old('severe')).toBeNull();
    expect(terminal.old('')).toBeNull();
  });
});
